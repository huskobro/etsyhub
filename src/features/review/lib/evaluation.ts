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

// Import from canonical lifecycle module — single source of truth.
// Re-exported so callers (EvaluationPanel, ReviewCard) don't depend on
// the server-only lifecycle module directly.
import type { NotQueuedReason as _NotQueuedReason } from "@/server/services/review/lifecycle";
export type NotQueuedReason = _NotQueuedReason;

export type Evaluation = {
  lifecycle: EvaluationLifecycle;
  /** IA-39 — present when lifecycle === "not_queued". Drives targeted
   *  UI copy so the operator knows what action to take. */
  notQueuedReason?: NotQueuedReason;
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
   *  string'i kopyayı belirler.
   *
   *  IA Phase 28 (CLAUDE.md Madde S) — bu artık **stored decision**
   *  contract'ıdır. Operatör override ise reasonKind =
   *  operator_override; aksi halde reasonKind, persisted score +
   *  policy snapshot'ında geçerli olan eşiklere göre sistem
   *  decision'ı (audit row'da yazılı). UI canonical truth olarak
   *  burayı render eder. */
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
  /** IA Phase 28 (CLAUDE.md Madde S) — current policy preview.
   *  Same item re-evaluated against today's thresholds. Filled
   *  yalnız stored decision'dan **farklı** olduğunda; aynıysa
   *  null. UI bunu sadece bilgi amaçlı, açık bir "preview"
   *  etiketiyle gösterir; persisted state'i değiştirmez. */
  currentPolicyPreview: {
    status: "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
    reasonKind:
      | "blocker_fail"
      | "low_score"
      | "mid_band_safe_default"
      | "auto_approved";
    reason: string;
    /** Kullanıcıya gösterilecek hint — örn. "with current
     *  thresholds (70/85)". UI başlığa basar. */
    thresholds: { low: number; high: number };
  } | null;
  /** IA-29 (CLAUDE.md Madde V) — AI advisory layer. Worker'ın
   *  "Auto-approved would suggest" / "Needs review (blocker)" /
   *  "Needs review (low score)" değerlendirmesi. Operatörü BAĞLAMAZ;
   *  UI'da sadece advisory chip + tooltip olarak görünür.
   *  null → AI henüz advisory üretmedi. */
  aiSuggestion: {
    status: "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
    reasonKind:
      | "blocker_fail"
      | "low_score"
      | "mid_band_safe_default"
      | "auto_approved";
    reason: string;
  } | null;
};

/** IA Phase 28 — operator-facing label for a persisted reviewStatus.
 *  Used in the stored decision reason cümlesi. */
function humanStatus(s: "APPROVED" | "REJECTED" | "NEEDS_REVIEW" | "PENDING"): string {
  switch (s) {
    case "APPROVED": return "Approved";
    case "REJECTED": return "Rejected";
    case "NEEDS_REVIEW": return "Needs review";
    default: return "Pending";
  }
}

/** IA Phase 27 (CLAUDE.md Madde R) — builtin defaults that match
 *  the server-side `DEFAULT_REVIEW_THRESHOLDS`. UI never blocks on
 *  a missing payload; fallback runs once with a dev warn so we
 *  notice if a route forgets to include `policy.thresholds`. */
const BUILTIN_THRESHOLDS = { low: 60, high: 90 } as const;
let warnedMissingThresholds = false;
function FALLBACK_THRESHOLDS_WITH_WARN(): { low: number; high: number } {
  if (
    !warnedMissingThresholds &&
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production"
  ) {
    warnedMissingThresholds = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[buildEvaluation] thresholds missing from caller — using builtin (60/90). Pass `thresholds` from queue endpoint `policy.thresholds` to honour admin overrides.",
    );
  }
  return BUILTIN_THRESHOLDS;
}

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
  /** IA-39 — why is the asset not_queued? Present when
   *  backendLifecycle === "not_queued". Passed through to Evaluation
   *  so UI can show targeted copy (pending_mapping, ignored, etc.). */
  notQueuedReason?: NotQueuedReason;
  /** IA Phase 27 (CLAUDE.md Madde R) — admin-resolved decision
   *  thresholds. Caller pulls these from the queue endpoint
   *  `policy.thresholds`; absent triggers a dev console warn and
   *  the builtin default pair (60/90) takes over so the UI never
   *  blocks on a missing payload. */
  thresholds?: { low: number; high: number };
  /** IA Phase 28 (CLAUDE.md Madde S) — persisted reviewStatus from
   *  the database row. Stored decision UI'da canonical truth
   *  olarak buradan okunur; client-side derivation yalnız
   *  current policy preview için kullanılır. */
  storedReviewStatus?: "PENDING" | "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
  /** IA-29 — AI advisory karar (worker yazar). null → AI henüz
   *  değerlendirmedi. */
  aiSuggestedStatus?: "APPROVED" | "NEEDS_REVIEW" | "REJECTED" | null;
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

  // IA-29 (CLAUDE.md Madde V) — iki ayrı katman:
  //
  //   • decisionOutcome = STORED OPERATOR DECISION. Canonical truth.
  //     storedReviewStatus PENDING → operatör henüz aksiyon almamış
  //     (decisionOutcome null). USER source → operator_override
  //     reasonKind. APPROVED/REJECTED/PENDING burada görünür.
  //
  //   • aiSuggestion = AI ADVISORY. Worker'ın "auto-approved would
  //     suggest" değerlendirmesi. Lifecycle ready iken her zaman
  //     dolu; UI'da sadece advisory chip + tooltip. Operatör kararına
  //     dokunmaz.
  //
  //   • currentPolicyPreview = bugünkü thresholds ile aynı item
  //     yeniden değerlendirilseydi ne olurdu — yalnız aiSuggestion'dan
  //     farklıysa dolar (örn. operatör threshold'u değiştirdi).
  let decisionOutcome: Evaluation["decisionOutcome"] = null;
  let aiSuggestion: Evaluation["aiSuggestion"] = null;
  let currentPolicyPreview: Evaluation["currentPolicyPreview"] = null;

  // Operator decision (canonical truth) — operator damgası varsa
  // (USER source veya status PENDING dışında bir şey) burası dolar.
  const storedStatus = input.storedReviewStatus;
  if (operatorOverride && storedStatus && storedStatus !== "PENDING") {
    decisionOutcome = {
      status: storedStatus,
      reasonKind: "operator_override",
      reason: "Operator marked this item.",
    };
  }

  // AI advisory — lifecycle ready iken hesapla. aiSuggestedStatus
  // server-side worker değerinden gelir; yoksa lokal türev (geriye
  // uyum için).
  if (lifecycle === "ready" && reviewScore !== null) {
    const blockerFailed = checks.some(
      (c) => c.state === "failed" && c.severity === "blocker",
    );
    const thresholds = input.thresholds ?? FALLBACK_THRESHOLDS_WITH_WARN();

    const derive = (
      t: { low: number; high: number },
    ): {
      status: "APPROVED" | "NEEDS_REVIEW";
      reasonKind:
        | "blocker_fail"
        | "low_score"
        | "mid_band_safe_default"
        | "auto_approved";
      reason: string;
    } => {
      if (blockerFailed) {
        return {
          status: "NEEDS_REVIEW",
          reasonKind: "blocker_fail",
          reason:
            "AI flagged a blocker-severity criterion. Operator review recommended.",
        };
      }
      if (reviewScore < t.low) {
        return {
          status: "NEEDS_REVIEW",
          reasonKind: "low_score",
          reason: `AI score (${reviewScore}) is below the auto-approve floor (${t.low}). Operator review recommended.`,
        };
      }
      if (reviewScore >= t.high) {
        return {
          status: "APPROVED",
          reasonKind: "auto_approved",
          reason: `AI score (${reviewScore}) clears the auto-approve threshold (${t.high}). Looks good.`,
        };
      }
      return {
        status: "NEEDS_REVIEW",
        reasonKind: "mid_band_safe_default",
        reason: `AI score (${reviewScore}) sits in the mid band (${t.low}–${t.high - 1}). Operator review recommended.`,
      };
    };

    const derivedNow = derive(thresholds);

    // aiSuggestion: server-side aiSuggestedStatus varsa onu, yoksa
    // derived. Mevcut thresholds farklı olabilir — server karar
    // verdiğindeki thresholds eski olabilir. Dürüst gösterim için
    // aiSuggestion her zaman derived ile uyumlu (bugünkü policy).
    // Server suggested farklıysa preview alanı zaten ayrı.
    aiSuggestion = {
      status: derivedNow.status,
      reasonKind: derivedNow.reasonKind,
      reason: derivedNow.reason,
    };

    // Server'ın advisory karar farklıysa (eski thresholds ile yazılmış)
    // currentPolicyPreview alanı bu farkı gösterir.
    if (
      input.aiSuggestedStatus &&
      input.aiSuggestedStatus !== derivedNow.status
    ) {
      currentPolicyPreview = {
        status: derivedNow.status,
        reasonKind: derivedNow.reasonKind,
        reason: `Stored AI suggestion was recorded under different thresholds; current policy would land on "${humanStatus(derivedNow.status)}".`,
        thresholds,
      };
    }
  }

  return {
    lifecycle,
    ...(lifecycle === "not_queued" && input.notQueuedReason !== undefined
      ? { notQueuedReason: input.notQueuedReason }
      : {}),
    score: lifecycle === "ready" ? reviewScore : null,
    summary: lifecycle === "ready" ? reviewSummary : null,
    provider: reviewProviderSnapshot,
    promptVersion: promptVersion ?? null,
    operatorOverride,
    checks,
    riskFlagCount: failedReasons.size,
    decisionOutcome,
    currentPolicyPreview,
    aiSuggestion,
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
