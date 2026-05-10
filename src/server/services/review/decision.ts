import { ReviewStatus } from "@prisma/client";
import type { ReviewRiskFlag } from "@/providers/review/types";
import type { ReviewCriterion } from "@/providers/review/criteria";

/**
 * Phase 6 review karar kuralı (R8) — pure / deterministic / stateless.
 *
 * Bu fonksiyon Task 4 (Gemini provider) ve Task 5 (sharp alpha-checks)
 * çıktılarını birleştirir; aşağı katmanlar tarafından (Task 8 worker)
 * çağrılır. Worker daha sonra Task 7 sticky helper ile USER override
 * koruması yapar.
 *
 * KURAL ZINCIRI:
 *   1) risk_flags > 0           ⇒ NEEDS_REVIEW (her durumda öncelikli)
 *   2) score < 60               ⇒ NEEDS_REVIEW
 *   3) score >= 90 + risk yok   ⇒ APPROVED
 *   4) aksi (60–89 + risk yok)  ⇒ NEEDS_REVIEW (güvenli varsayılan)
 *
 * "Güvenli varsayılan" gerekçesi (60–89 bandı):
 * - Gemini gibi LLM çıktıları %5–10 dalgalanabilir; aynı görsel için 88
 *   ve 91 dönmesi mümkün.
 * - Bu bantta otomatik APPROVED kullanıcıyı yanıltır (riskli yakın-eşik
 *   tasarımları gözden geçirme şansı kaybolur).
 * - Bu bantta otomatik REJECT da haksız (skor zaten orta-üst); kullanıcı
 *   "Approve anyway" demek isteyebilir.
 * - NEEDS_REVIEW iki seçeneği de açık tutar: USER override sticky
 *   (Task 7) ile kullanıcı manuel APPROVED veya REJECTED yazabilir.
 *
 * IA Phase 27 (CLAUDE.md Madde R) — thresholds artık settings-driven.
 * Builtin defaults (60/90) admin override yokken etkili olur; helper'lar
 * çağrı bazında `thresholds` parametresi alır. Service/pipeline kodunda
 * sabit constant okumak YASAK.
 *
 * Score input'u 0–100 arası VALIDATED kabul edilir (Task 4 Zod schema
 * `z.number().int().min(0).max(100)` ile zorlar). Burada ekstra clamp/
 * range guard YOK — out-of-range koruması başka katmanın sözleşmesi.
 */
export const REVIEW_THRESHOLD_LOW = 60;
export const REVIEW_THRESHOLD_HIGH = 90;
export const DEFAULT_REVIEW_THRESHOLDS: ReviewThresholds = {
  low: REVIEW_THRESHOLD_LOW,
  high: REVIEW_THRESHOLD_HIGH,
};

export type ReviewThresholds = {
  low: number;
  high: number;
};

export type ReviewDecisionInput = {
  score: number;
  riskFlags: ReviewRiskFlag[];
};

export function decideReviewStatus(
  input: ReviewDecisionInput,
  thresholds: ReviewThresholds = DEFAULT_REVIEW_THRESHOLDS,
): ReviewStatus {
  // 1) Risk flag her durumda öncelikli — score yüksek olsa bile
  if (input.riskFlags.length > 0) return ReviewStatus.NEEDS_REVIEW;

  // 2) Düşük skor — düşük kalite işareti
  if (input.score < thresholds.low) return ReviewStatus.NEEDS_REVIEW;

  // 3) Yüksek skor + risk yok — otomatik onay güvenli
  if (input.score >= thresholds.high) return ReviewStatus.APPROVED;

  // 4) low–(high-1) + risk yok — orta band, güvenli varsayılan NEEDS_REVIEW
  //    (yukarıdaki doc-block'ta gerekçe; LLM dalgalanması + USER override)
  return ReviewStatus.NEEDS_REVIEW;
}

/**
 * IA Phase 17 — explainable scoring math (CLAUDE.md Madde O).
 *
 * Final score = max(0, providerRaw − sum(criterion.weight) for each
 * failed warning-level criterion) where:
 *   • severity="info"     → never subtracts (informational only)
 *   • severity="warning"  → subtracts up to weight (cumulative, clamped)
 *   • severity="blocker"  → forces NEEDS_REVIEW regardless of score
 *
 * Provider raw score is persisted alongside the policy-adjusted score
 * so audit + UI can show both. Admin pane sees the math live.
 *
 * Returns a breakdown object the worker writes to the audit row.
 */
export type ScoringBreakdown = {
  /** Provider's raw 0–100 score. */
  providerRaw: number;
  /** Final policy-adjusted score (clamped to [0,100]). */
  finalScore: number;
  /** Contribution per criterion (positive = subtraction from
   *  providerRaw because the check failed; 0 = passed or info-only). */
  contributions: Array<{
    id: string;
    severity: "info" | "warning" | "blocker";
    weight: number;
    /** Was this criterion failed (risk flag matched)? */
    failed: boolean;
    /** Weight subtracted from the score (warning-level fails only). */
    subtracted: number;
  }>;
  /** True when at least one blocker-severity criterion failed. */
  hasBlockerFail: boolean;
};

/**
 * IA Phase 25 — explainable decision (CLAUDE.md Madde M+). Carries
 * the canonical machine-readable outcome + a one-line operator
 * reason that the right panel renders directly. UI never has to
 * synthesize "why is this NEEDS_REVIEW" — server is the source of
 * truth.
 */
export type DecisionOutcome = {
  status: ReviewStatus;
  /** Canonical category for the reason — UI maps to copy/colour. */
  reasonKind:
    | "blocker_fail"
    | "low_score"
    | "mid_band_safe_default"
    | "auto_approved";
  /** One-line English explanation of the decision. */
  reason: string;
};

/**
 * IA-29 (CLAUDE.md Madde V) — deterministic system score.
 *
 * Önceki davranış: `finalScore = providerRaw − Σweight(failed)`. Provider
 * iki benzer item'a 105/95 raw verdiğinde aynı tek warning -20 ile 85/75
 * gibi adaletsiz farklar üretiyordu. Provider raw artık SADECE audit/
 * debug katmanında (DesignReview.responseSnapshot._providerRaw +
 * GeneratedDesign.reviewProviderRawScore).
 *
 * Yeni model — pure rule-based:
 *   • Active warning kriteri sayısı = W
 *   • Failed warning kriteri ağırlık toplamı = Σwf
 *   • Active blocker kriteri sayısı = B
 *   • Failed blocker = HB (true/false; hasBlockerFail forces NEEDS_REVIEW)
 *
 *   finalScore = clamp(0, 100, 100 − Σwf − BlockerPenalty)
 *   BlockerPenalty: failed blocker varsa 100'e clamped (yani score 0
 *     veya altına düşer; blocker zaten NEEDS_REVIEW zorlar).
 *
 * Sonuç:
 *   • Aynı failed flags = aynı score (deterministic).
 *   • Provider raw fluctuation skoru ETKİLEMEZ.
 *   • Threshold'a karşı adil ve açıklanabilir.
 */
export function computeScoringBreakdown(args: {
  providerRaw: number;
  riskFlagKinds: ReadonlyArray<string>;
  criteria: ReadonlyArray<ReviewCriterion>;
}): ScoringBreakdown {
  const { providerRaw, riskFlagKinds, criteria } = args;
  const failedSet = new Set(riskFlagKinds);
  let warningPenalty = 0;
  let hasBlockerFail = false;
  const contributions: ScoringBreakdown["contributions"] = [];
  for (const c of criteria) {
    const failed = failedSet.has(c.id);
    let subtracted = 0;
    if (failed) {
      if (c.severity === "blocker") hasBlockerFail = true;
      if (c.severity === "warning") {
        subtracted = c.weight;
        warningPenalty += c.weight;
      }
    }
    contributions.push({
      id: c.id,
      severity: c.severity,
      weight: c.weight,
      failed,
      subtracted,
    });
  }
  // System score: 100 baz − warning penaltıları − blocker varsa zorla 0
  const blockerForce = hasBlockerFail ? 100 : 0;
  const finalScore = Math.max(
    0,
    Math.min(100, Math.round(100 - warningPenalty - blockerForce)),
  );
  return { providerRaw, finalScore, contributions, hasBlockerFail };
}

/**
 * Decision driven by the breakdown. Same axis as decideReviewStatus
 * but also considers blocker fails — even a high score is forced
 * to NEEDS_REVIEW when a blocker-severity criterion fails.
 */
export function decideReviewStatusFromBreakdown(
  breakdown: ScoringBreakdown,
  thresholds: ReviewThresholds = DEFAULT_REVIEW_THRESHOLDS,
): ReviewStatus {
  return decideReviewOutcomeFromBreakdown(breakdown, thresholds).status;
}

/**
 * IA Phase 25 — explainable variant. Returns the same canonical
 * status plus a `reasonKind` + human-readable English `reason`.
 * Worker persists this to the audit row; queue endpoint surfaces
 * it; UI right panel renders it as Decision/Outcome.
 *
 * IA Phase 27 (CLAUDE.md Madde R) — thresholds are settings-driven.
 * Caller passes the resolved `{ low, high }`; defaults fall back to
 * the builtin pair when no override is set.
 */
export function decideReviewOutcomeFromBreakdown(
  breakdown: ScoringBreakdown,
  thresholds: ReviewThresholds = DEFAULT_REVIEW_THRESHOLDS,
): DecisionOutcome {
  if (breakdown.hasBlockerFail) {
    return {
      status: ReviewStatus.NEEDS_REVIEW,
      reasonKind: "blocker_fail",
      reason:
        "Needs review because at least one blocker-severity criterion failed.",
    };
  }
  if (breakdown.finalScore < thresholds.low) {
    return {
      status: ReviewStatus.NEEDS_REVIEW,
      reasonKind: "low_score",
      reason: `Needs review because the final score (${breakdown.finalScore}) is below the auto-approve threshold (${thresholds.low}).`,
    };
  }
  if (breakdown.finalScore >= thresholds.high) {
    return {
      status: ReviewStatus.APPROVED,
      reasonKind: "auto_approved",
      reason: `Auto-approved — no blocker fails and the final score (${breakdown.finalScore}) reached the high threshold (${thresholds.high}).`,
    };
  }
  return {
    status: ReviewStatus.NEEDS_REVIEW,
    reasonKind: "mid_band_safe_default",
    reason: `Needs review because the final score (${breakdown.finalScore}) sits in the mid-band (${thresholds.low}–${thresholds.high - 1}); the safe default routes it to manual review even when no checks failed.`,
  };
}
