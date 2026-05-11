import { ReviewStatus } from "@prisma/client";
import type { ReviewRiskFlag } from "@/providers/review/types";
import {
  isCriterionApplicable,
  type ReviewCriterion,
  type ReviewComposeContext,
} from "@/providers/review/criteria";

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
 * IA-29 + IA-38 (CLAUDE.md Madde V) — deterministic, severity-agnostic
 * system score.
 *
 * **Final formül** (IA-38 — gizli kural yok, sürpriz yok):
 *
 *   finalScore = clamp(0, 100, 100 − Σ weight(failed applicable criteria))
 *
 * Severity (`blocker` / `warning`) **score'u etkilemez**:
 *   • blocker = UI tone + AI suggestion önem sinyali (presentation
 *     layer)
 *   • warning = daha hafif tone
 *   • score etkisi yalnız `weight` üzerinden
 *
 * Operatör bir kriterin skoru sıfırlamasını istiyorsa admin paneline
 * gidip o kriterin `weight`'ini 100'e set eder; davranış admin'de
 * görünür ve düzenlenebilir kalır. Eski "blockerForce = 100 hidden
 * zero" davranışı IA-38'de KALDIRILDI — kullanıcı şikâyeti: gizli
 * auto-zero ürün sözleşmesini ihlal ediyordu.
 *
 * Sonuç:
 *   • Aynı failed criteria + aynı weight = aynı score (deterministic).
 *   • Provider raw fluctuation skoru ETKİLEMEZ (audit/debug only).
 *   • Birden çok failed criterion weight'leri toplanır; clamp 0'da
 *     tutar.
 *   • blocker fail → AI suggestion outcome NEEDS_REVIEW (advisory)
 *     ama score üzerinde **direkt etki yok**.
 */
export function computeScoringBreakdown(args: {
  providerRaw: number;
  riskFlagKinds: ReadonlyArray<string>;
  criteria: ReadonlyArray<ReviewCriterion>;
  /** IA-38b — Applicability context (opsiyonel). Geçildiğinde N/A
   *  kriterler score'a düşmez; detail panel "Not applicable" diye
   *  gösterilen aynı kriterler score'a girmez. Caller geçirmezse
   *  geriye dönük davranış: TÜM aktif kriterler (legacy). */
  composeContext?: ReviewComposeContext;
}): ScoringBreakdown {
  const { providerRaw, riskFlagKinds, criteria, composeContext } = args;
  // IA-38b — duplicate kind'lar Set ile unique'leştirilir (DB'de aynı
  // kind iki kez yazılmış olabilir; provider snapshot duplicate
  // göndermiş). Skor iki kez sayılmaz.
  const failedSet = new Set(riskFlagKinds);
  let totalPenalty = 0;
  let hasBlockerFail = false;
  const contributions: ScoringBreakdown["contributions"] = [];
  for (const c of criteria) {
    // IA-38b — N/A kriterler atlanır. Detail panel'in "Not applicable"
    // diye gösterdiği kriterler score'a girmez; kullanıcıya görünen
    // failed applicable checks = score deductions birebir eşit olur.
    if (composeContext && !isCriterionApplicable(c, composeContext)) {
      continue;
    }
    const failed = failedSet.has(c.id);
    let subtracted = 0;
    if (failed) {
      // IA-38 — Severity-agnostic weight subtraction. Hem warning
      // hem blocker kriterler aynı kurala uyar: weight kadar düşer.
      // `hasBlockerFail` yalnız AI suggestion presentation katmanı
      // için (`decideReviewOutcomeFromBreakdown` advisory NEEDS_REVIEW
      // tetikleyebilir) — score üzerinde direkt etki YOK.
      subtracted = c.weight;
      totalPenalty += c.weight;
      if (c.severity === "blocker") hasBlockerFail = true;
    }
    contributions.push({
      id: c.id,
      severity: c.severity,
      weight: c.weight,
      failed,
      subtracted,
    });
  }
  // Sadece weight tabanlı; clamp 0..100. Eski blockerForce KALDIRILDI.
  const finalScore = Math.max(
    0,
    Math.min(100, Math.round(100 - totalPenalty)),
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
