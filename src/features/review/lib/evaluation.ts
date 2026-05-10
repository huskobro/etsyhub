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

import type { ReviewRiskFlagType } from "@/providers/review/types";
import { REVIEW_RISK_FLAG_TYPES } from "@/providers/review/types";
import {
  BUILTIN_CRITERIA,
  type ReviewCriterion,
} from "@/providers/review/criteria";

export type EvaluationLifecycle =
  | "ready"
  | "pending"
  | "scoring"
  | "error"
  | "na";

export type EvaluationCheck = {
  /** Kontrol id — risk flag taksonomisinden gelir. */
  id: ReviewRiskFlagType;
  /** Operatöre görünür kısa etiket (TR). */
  label: string;
  /** Bu check passed mi (= ilgili risk flag yok)? */
  passed: boolean;
  /** Failed olduysa provider'ın verdiği gerekçe — aksi halde null. */
  reason?: string | null;
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
};

const CHECK_LABEL: Record<ReviewRiskFlagType, string> = {
  watermark_detected: "Watermark / damga yok",
  signature_detected: "İmza yok",
  visible_logo_detected: "Görünür marka logosu yok",
  celebrity_face_detected: "Tanınmış yüz yok",
  no_alpha_channel: "Alfa kanalı uygun",
  transparent_edge_artifact: "Transparent kenar temiz",
  text_detected: "Yazı içermiyor",
  gibberish_text_detected: "Anlamsız yazı yok",
};

export function checkLabel(id: ReviewRiskFlagType): string {
  return CHECK_LABEL[id];
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
  /** IA Phase 16 — criteria-aware checklist. Verilirse `BUILTIN_CRITERIA`
   *  arasından `productType` bağlamına uygun olan **aktif** kriterler
   *  görünür; kontrolü yalnız bağlamda anlamlı olanlar oluşturur (ör.
   *  alpha satırları yalnız transparent target ürünlerde). Verilmezse
   *  tüm 8 sabit taksonomi gösterilir (legacy, geriye uyum). */
  criteriaContext?: { productType: string };
  /** Aktif kriter listesi caller tarafından hazırlanmışsa bu kullanılır;
   *  aksi halde `BUILTIN_CRITERIA` üzerinden filtreleme yapılır. */
  activeCriteria?: ReadonlyArray<ReviewCriterion>;
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
    criteriaContext,
    activeCriteria,
  } = input;

  // Failed checks — risk flag entries; index by kind.
  const failedReasons = new Map<string, string | null>();
  for (const f of riskFlags) {
    const k = readKind(f);
    if (!k) continue;
    failedReasons.set(k, readReason(f));
  }

  // Build the canonical check list. CLAUDE.md Madde O — kriter blokları
  // bağlama göre filtrelenir; activeCriteria > criteriaContext > legacy
  // sıralı önceliği.
  const sourceCriteria: ReadonlyArray<{ id: ReviewRiskFlagType; label: string }> =
    activeCriteria !== undefined
      ? activeCriteria
      : criteriaContext
        ? BUILTIN_CRITERIA.filter((c) => {
            if (!c.active) return false;
            if (c.productTypes === null) return true;
            return c.productTypes.includes(criteriaContext.productType);
          })
        : REVIEW_RISK_FLAG_TYPES.map((id) => ({ id, label: CHECK_LABEL[id] }));

  const checks: EvaluationCheck[] = sourceCriteria.map((c) => {
    const isFailed = failedReasons.has(c.id);
    return {
      id: c.id,
      label: c.label,
      passed: !isFailed,
      reason: isFailed ? failedReasons.get(c.id) ?? null : null,
    };
  });

  let lifecycle: EvaluationLifecycle;
  if (forceLifecycle) {
    lifecycle = forceLifecycle;
  } else if (reviewedAt && reviewScore !== null) {
    lifecycle = "ready";
  } else if (reviewProviderSnapshot && !reviewedAt) {
    lifecycle = "scoring";
  } else {
    lifecycle = "pending";
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
  };
}

/**
 * Operator-facing TR caption for each lifecycle. UI sağ panelde
 * lifecycle satırına bunu yazar; sahte sayı göstermez.
 */
export function lifecycleCaption(lifecycle: EvaluationLifecycle): string {
  switch (lifecycle) {
    case "ready":
      return "Değerlendirme tamamlandı";
    case "scoring":
      return "Değerlendiriliyor…";
    case "pending":
      return "Değerlendirme bekleniyor";
    case "error":
      return "Değerlendirme başarısız";
    case "na":
      return "Uygulanabilir değil";
  }
}
