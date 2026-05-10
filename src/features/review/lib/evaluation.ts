// IA Phase 16 — unified evaluation contract.
//
// Sistem skoru çıplak sayı değil; lifecycle taşıyan açıklanabilir bir
// **değerlendirme**dir (CLAUDE.md Madde M — sistem skor contract'ı).
// Bu modül kaynak-bağımsız bir `Evaluation` shape'i ile lifecycle
// sınıflandırıcısını tanımlar; UI hem AI Generated hem Local Library
// için aynı contract'ı okur.
//
// Uçlar:
//   • READY — `reviewedAt` doldu + score sayı; checksPassed + risk
//             flags türetilebilir.
//   • PENDING — review pipeline'a girmemiş veya henüz işlenmemiş
//               (reviewedAt null AND providerSnapshot null).
//   • SCORING — kuyruğa girmiş (provider snapshot doluysa ama
//               reviewedAt yoksa — pratikte rare; defansif).
//   • ERROR — provider başarısız olmuş (UI bunu ayrıca eski
//             reviewProviderSnapshot ile birleştirebilir; bu
//             modülde minimum lifecycle yeter).
//   • NA — uygulanabilir değil (ileride video/3D vb. için).
//
// `Check` sözlüğü `ReviewRiskFlagType`'tan türer; bir kontrolün
// "geçti" sayılması için ilgili risk flag yok demek yeterli (negatif
// uzaydan pozitif türev). Bu UI dilini "passed checks" ekseninde
// tutarlı yapar — yeni flag tipi eklendiğinde otomatik kontrol satırı
// olur (CLAUDE.md'deki "drift koruması — tek kaynaklı sözlük"
// prensibi).

import type {
  AnyReviewCriterionId,
  ReviewRiskFlagType,
} from "@/providers/review/types";
import { REVIEW_RISK_FLAG_TYPES } from "@/providers/review/types";
import {
  BUILTIN_CRITERIA,
  evaluateAllCriteria,
  type ReviewComposeContext,
  type ReviewCriterion,
} from "@/providers/review/criteria";

/**
 * Lifecycle states (CLAUDE.md Madde N — dürüst ayrım):
 *   • not_queued — asset henüz hiç review job'ına alınmadı
 *   • queued     — Job tablosunda QUEUED state
 *   • running    — Job RUNNING (provider yanıtı bekleniyor)
 *   • ready      — provider response başarıyla persist'lendi
 *   • failed     — Job FAILED veya CANCELLED
 *   • na         — uygulanabilir değil
 *
 * Eski isimler (`pending`, `scoring`, `error`) geriye uyum için
 * alias olarak yaşar; yeni kod yeni isimleri kullanır.
 */
export type EvaluationLifecycle =
  | "ready"
  | "not_queued"
  | "queued"
  | "running"
  | "failed"
  | "na"
  // Legacy aliases — caller's haven't migrated yet.
  | "pending"
  | "scoring"
  | "error";

/** Per-check applicability state (CLAUDE.md Madde O — neutral state). */
export type CheckState =
  | "passed"   // applicable + risk flag absent
  | "failed"   // applicable + risk flag present
  | "neutral"; // not applicable to this asset's context

export type EvaluationCheck = {
  /** Kontrol id — risk flag taksonomisinden gelir (semantic veya
   *  technical). */
  id: AnyReviewCriterionId;
  /** Operator-facing English label. */
  label: string;
  /** State for the UI (passed / failed / neutral). */
  state: CheckState;
  /** Backwards-compat — true when state === "passed" or "neutral".
   *  Older UI sites that only knew about pass/fail still work. */
  passed: boolean;
  /** Failed olduysa provider'ın verdiği gerekçe — aksi halde null. */
  reason?: string | null;
  /** Why neutral — short EN explanation (e.g. "Not applicable for JPEG"). */
  neutralReason?: string | null;
  /** Severity from the criterion (info / warning / blocker). */
  severity?: "info" | "warning" | "blocker";
  /** Score weight contribution (admin pane / explainability). */
  weight?: number;
};

export type Evaluation = {
  lifecycle: EvaluationLifecycle;
  /** lifecycle === "ready" iken 0–100 sayı; aksi halde null. */
  score: number | null;
  /** Provider'ın özet cümlesi — TR. lifecycle === "ready" iken dolar. */
  summary: string | null;
  /** Provider snapshot ("provider@iso-date"). lifecycle gösterimi
   *  için ayrıca kullanılır. */
  provider: string | null;
  /** Review prompt versiyonu — gelecekte admin yönetimine alındığında
   *  burası güncel sürümü gösterir. Şimdilik input'tan opsiyonel. */
  promptVersion: string | null;
  /** Operator override sinyali — sistem skoruna karışmaz, sağ panelde
   *  ayrı satırda durur. */
  operatorOverride: boolean;
  /** Sıralı kontrol listesi — UI checklist olarak render eder. */
  checks: EvaluationCheck[];
  /** Risk flag count (UI'da kart hint'i + panel başlığı). */
  riskFlagCount: number;
  /** IA Phase 25 — decision outcome (CLAUDE.md Madde M+).
   *  Lifecycle === "ready" iken dolu; UI Decision/Outcome
   *  bloğunda render edilir. Reason kategorisi tone'u, reason
   *  string'i kopyayı belirler. */
  decisionOutcome: {
    status: "APPROVED" | "REJECTED" | "NEEDS_REVIEW" | "PENDING";
    reasonKind:
      | "blocker_fail"
      | "low_score"
      | "mid_band_safe_default"
      | "auto_approved"
      | "operator_override";
    reason: string;
  } | null;
};

/** EN labels — fallback when caller has no resolved criteria list.
 *  Keep in sync with BUILTIN_CRITERIA labels. */
const CHECK_LABEL: Record<ReviewRiskFlagType, string> = {
  watermark_detected: "No watermark or stamp",
  signature_detected: "No artist signature",
  visible_logo_detected: "No visible brand logo",
  celebrity_face_detected: "No recognizable face",
  no_alpha_channel: "Alpha channel suitable",
  transparent_edge_artifact: "Clean transparent edges",
  text_detected: "No embedded text",
  gibberish_text_detected: "No gibberish text",
};

export function checkLabel(id: ReviewRiskFlagType): string {
  return CHECK_LABEL[id];
}

/** Build a short EN reason for a neutral (not-applicable) state.
 *  Used when applicability rules exclude a criterion from the active
 *  context (e.g. transparent rule on a JPEG). */
function neutralReasonFor(
  c: ReviewCriterion,
  ctx?: ReviewComposeContext,
): string {
  if (!ctx) return "Not applicable in this context";
  const a = c.applicability;
  if (a.formats !== null && !a.formats.includes(ctx.format)) {
    return `Not applicable for ${ctx.format.toUpperCase()}`;
  }
  if (a.productTypes !== null && !a.productTypes.includes(ctx.productType)) {
    return `Not applicable for ${ctx.productType}`;
  }
  if (a.transparency !== null && ctx.hasAlpha !== null) {
    return ctx.hasAlpha
      ? "Not applicable for opaque images"
      : "Not applicable without alpha";
  }
  if (a.requiresAnyTransform !== null && a.requiresAnyTransform.length > 0) {
    return "Pending an image transform";
  }
  return "Not applicable in this context";
}

type RawRiskFlag = {
  kind?: string;
  type?: string;
  reason?: string;
  confidence?: number;
};

function readKind(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const o = entry as RawRiskFlag;
  if (typeof o.kind === "string") return o.kind;
  if (typeof o.type === "string") return o.type;
  return null;
}

function readReason(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const o = entry as RawRiskFlag;
  return typeof o.reason === "string" ? o.reason : null;
}

/**
 * Build an `Evaluation` from a queue item / detail row. Null inputs
 * resolve to `pending` lifecycle (the operator sees an honest
 * "Henüz değerlendirilmedi" state instead of a fake 0/null score).
 *
 * Decision rules:
 *   1. reviewedAt present + score number ⇒ ready
 *   2. reviewedAt null + providerSnapshot present ⇒ scoring
 *      (snapshot olduğu halde reviewedAt yoksa pipeline çalışıyor)
 *   3. reviewedAt null + provider null ⇒ pending (sırada bile değil)
 *
 * Error state'i bu modül girdiden türetmez; explicit lifecycle
 * "error" caller tarafından geçilirse onurlanır (gelecek follow-up:
 * worker fail audit log'a yazıp queue endpoint bunu döndürebilir).
 */
export function buildEvaluation(input: {
  reviewedAt: string | null;
  reviewScore: number | null;
  reviewSummary: string | null;
  reviewProviderSnapshot: string | null;
  riskFlags: unknown[];
  operatorOverride: boolean;
  /** Optional override — caller knows lifecycle is "error" / "na". */
  forceLifecycle?: EvaluationLifecycle;
  promptVersion?: string | null;
  /** Compose context for full applicability evaluation (CLAUDE.md
   *  Madde O). When passed, every active builtin criterion appears
   *  in the checklist as either passed / failed / neutral; criteria
   *  outside the context still render as neutral with an EN reason
   *  ("Not applicable for JPEG", etc.) so the operator sees the
   *  full picture. */
  composeContext?: ReviewComposeContext;
  /** Caller may pass a resolved criteria list (e.g. settings-merged
   *  view from worker); otherwise BUILTIN_CRITERIA is used. */
  resolvedCriteria?: ReadonlyArray<ReviewCriterion>;
  /** Backend-resolved lifecycle (CLAUDE.md Madde N). When set,
   *  buildEvaluation honours this directly instead of inferring from
   *  reviewedAt/snapshot fields. Server returns this from queue
   *  endpoint per asset. */
  backendLifecycle?: EvaluationLifecycle;
}): Evaluation {
  const {
    reviewedAt,
    reviewScore,
    reviewSummary,
    reviewProviderSnapshot,
    riskFlags,
    operatorOverride,
    forceLifecycle,
    promptVersion,
    composeContext,
    resolvedCriteria,
  } = input;

  // Failed checks — risk flag entries; index by kind.
  const failedReasons = new Map<string, string | null>();
  for (const f of riskFlags) {
    const k = readKind(f);
    if (!k) continue;
    failedReasons.set(k, readReason(f));
  }

  // CLAUDE.md Madde O — full evaluation: every active criterion
  // appears with passed / failed / neutral state. Compose context
  // drives applicability; absent context falls back to legacy 8-row
  // taxonomy view (geriye uyum, neutral state yok).
  let checks: EvaluationCheck[];
  if (composeContext) {
    const list = evaluateAllCriteria(composeContext, resolvedCriteria);
    checks = list.map(({ criterion, applicable }) => {
      if (!applicable) {
        return {
          id: criterion.id,
          label: criterion.label,
          state: "neutral" as const,
          passed: true, // backwards-compat: do not subtract from "passed" counts
          reason: null,
          neutralReason: neutralReasonFor(criterion, composeContext),
          severity: criterion.severity,
          weight: criterion.weight,
        };
      }
      const failed = failedReasons.has(criterion.id);
      return {
        id: criterion.id,
        label: criterion.label,
        state: failed ? ("failed" as const) : ("passed" as const),
        passed: !failed,
        reason: failed ? failedReasons.get(criterion.id) ?? null : null,
        severity: criterion.severity,
        weight: criterion.weight,
      };
    });
  } else {
    checks = REVIEW_RISK_FLAG_TYPES.map((id) => {
      const failed = failedReasons.has(id);
      return {
        id,
        label: CHECK_LABEL[id],
        state: failed ? ("failed" as const) : ("passed" as const),
        passed: !failed,
        reason: failed ? failedReasons.get(id) ?? null : null,
      };
    });
  }

  // Lifecycle resolution priority:
  //   1. Explicit forceLifecycle (caller knows error/na)
  //   2. backendLifecycle (server-resolved Job state)
  //   3. Asset state inference (legacy fallback for clients that
  //      don't pass backendLifecycle yet)
  let lifecycle: EvaluationLifecycle;
  if (forceLifecycle) {
    lifecycle = forceLifecycle;
  } else if (input.backendLifecycle) {
    lifecycle = input.backendLifecycle;
  } else if (reviewedAt && reviewScore !== null) {
    lifecycle = "ready";
  } else if (reviewProviderSnapshot && !reviewedAt) {
    lifecycle = "running";
  } else {
    lifecycle = "not_queued";
  }

  // IA Phase 25 — decision outcome resolve (CLAUDE.md Madde M+).
  // Operatör override aktifse outcome USER damgasını yansıtır;
  // aksi halde failed checks + score'a bakılarak server decision
  // kuralının aynısı client tarafında türetilir.
  let decisionOutcome: Evaluation["decisionOutcome"] = null;
  if (lifecycle === "ready" && reviewScore !== null) {
    if (operatorOverride) {
      decisionOutcome = {
        status: "PENDING", // outer caller knows the actual reviewStatus; reason categorical
        reasonKind: "operator_override",
        reason:
          "Decided by the operator. The system evaluation above stays as reference.",
      };
    } else {
      const blockerFailed = checks.some(
        (c) => c.state === "failed" && c.severity === "blocker",
      );
      const REVIEW_THRESHOLD_LOW = 60;
      const REVIEW_THRESHOLD_HIGH = 90;
      if (blockerFailed) {
        decisionOutcome = {
          status: "NEEDS_REVIEW",
          reasonKind: "blocker_fail",
          reason:
            "Needs review because at least one blocker-severity criterion failed.",
        };
      } else if (reviewScore < REVIEW_THRESHOLD_LOW) {
        decisionOutcome = {
          status: "NEEDS_REVIEW",
          reasonKind: "low_score",
          reason: `Needs review because the final score (${reviewScore}) is below the auto-approve threshold (${REVIEW_THRESHOLD_LOW}).`,
        };
      } else if (reviewScore >= REVIEW_THRESHOLD_HIGH) {
        decisionOutcome = {
          status: "APPROVED",
          reasonKind: "auto_approved",
          reason: `Auto-approved — no blocker fails and the final score (${reviewScore}) reached the high threshold (${REVIEW_THRESHOLD_HIGH}).`,
        };
      } else {
        decisionOutcome = {
          status: "NEEDS_REVIEW",
          reasonKind: "mid_band_safe_default",
          reason: `Needs review because the final score (${reviewScore}) sits in the mid-band (${REVIEW_THRESHOLD_LOW}–${REVIEW_THRESHOLD_HIGH - 1}); the safe default routes it to manual review even when no checks failed.`,
        };
      }
    }
  }

  return {
    lifecycle,
    score: lifecycle === "ready" ? reviewScore : null,
    summary: lifecycle === "ready" ? reviewSummary : null,
    provider: reviewProviderSnapshot,
    promptVersion: promptVersion ?? null,
    operatorOverride,
    checks,
    riskFlagCount: failedReasons.size,
    decisionOutcome,
  };
}

/**
 * Operator-facing TR caption for each lifecycle. UI sağ panelde
 * lifecycle satırına bunu yazar; sahte sayı göstermez.
 */
export function lifecycleCaption(lifecycle: EvaluationLifecycle): string {
  switch (lifecycle) {
    case "ready":
      return "Evaluation ready";
    case "queued":
      return "Queued for review";
    case "running":
    case "scoring":
      return "Waiting for AI response";
    case "not_queued":
    case "pending":
      return "Not queued yet";
    case "failed":
    case "error":
      return "Review failed";
    case "na":
      return "Not applicable";
  }
}
