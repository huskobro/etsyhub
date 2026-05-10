// IA Phase 16 — review master prompt criteria-block compose system.
//
// CLAUDE.md Madde O: master prompt tek parça sabit string DEĞİLDİR;
// her kriter ayrı bir bloktur. Compose mantığı **aktif** ve **bağlama
// uyan** blokları seçer; pasif veya bağlam dışı bloklar prompttan
// çıkarılır. Compose edilmiş final prompt review-design.worker tarafında
// snapshot'lanır (audit / reproducibility).
//
// Bu modül:
//   • Builtin criterion bloklarını tanımlar (yeni feature day-1)
//   • `composeReviewPrompt(input)` = aktif kriterlere göre final prompt
//   • Versioning: builtin sürüm artarsa REVIEW_PROMPT_VERSION bump
//
// İleride DB-tabanlı yönetim:
//   • Yeni model `ReviewCriterion { id, key, label, blockText,
//                                   active, productTypeScopes[],
//                                   weight?, version }`
//   • Admin UI builtin'leri override edebilir; `getActiveCriteria`
//     once DB'yi sorgular, override yoksa builtin döner.
//
// Drift koruması: kriter `id` alanı `ReviewRiskFlagType` (sabit 8
// taksonomi) ile bire bir hizalı; UI checklist taksonomisi de
// buradan beslenir. Yeni risk flag eklenince builtin'e satır
// eklenmek **zorunlu** — typescript hatası verir.

import type { ReviewRiskFlagType } from "@/providers/review/types";

export type ReviewCriterion = {
  /** Risk flag taksonomisi ile bire bir. UI checklist sözlüğü ve
   *  provider response schema bu id'yi kullanır. */
  id: ReviewRiskFlagType;
  /** Operatör görünür kısa etiket (TR). EvaluationPanel checklist'i
   *  bu label'i okur. */
  label: string;
  /** Master prompt'a giren talimat satırı (TR). Provider bu blokları
   *  okur ve karşılığında riskFlag çıkarır. */
  blockText: string;
  /** Aktif mi — pasif kriterler prompttan çıkarılır. Builtin default
   *  true; admin override ile false yapılabilir. */
  active: boolean;
  /** Ürün-tip kapsamı; null ⇒ tüm ürünlerde geçerli. Ör. transparent
   *  background kuralı yalnız clipart/sticker/transparent_png için.
   *  Compose context.productType match etmiyorsa blok atlanır. */
  productTypes: ReadonlyArray<string> | null;
  /** Builtin sürüm — değişikliği prompt versiyonunu etkiler. */
  version: string;
};

export const BUILTIN_CRITERIA: ReadonlyArray<ReviewCriterion> = [
  {
    id: "watermark_detected",
    label: "Watermark / damga yok",
    blockText:
      "watermark_detected: görselde yarı saydam imza/watermark izi var",
    active: true,
    productTypes: null,
    version: "1.0",
  },
  {
    id: "signature_detected",
    label: "İmza yok",
    blockText:
      "signature_detected: sanatçı imzası veya el yazısı görünüyor",
    active: true,
    productTypes: null,
    version: "1.0",
  },
  {
    id: "visible_logo_detected",
    label: "Görünür marka logosu yok",
    blockText:
      "visible_logo_detected: marka/şirket logosu görünüyor",
    active: true,
    productTypes: null,
    version: "1.0",
  },
  {
    id: "celebrity_face_detected",
    label: "Tanınmış yüz yok",
    blockText:
      "celebrity_face_detected: tanınmış bir ünlünün yüzü var",
    active: true,
    productTypes: null,
    version: "1.0",
  },
  {
    id: "no_alpha_channel",
    label: "Alfa kanalı uygun",
    blockText:
      "no_alpha_channel: transparent ürün hedefi olmasına rağmen alfa kanalı yok",
    active: true,
    // Yalnız transparent ürünlerde anlamlı; aksi halde compose dışı.
    productTypes: ["clipart", "sticker", "transparent_png"],
    version: "1.0",
  },
  {
    id: "transparent_edge_artifact",
    label: "Transparent kenar temiz",
    blockText:
      "transparent_edge_artifact: transparent görselde kenar kalıntıları var",
    active: true,
    productTypes: ["clipart", "sticker", "transparent_png"],
    version: "1.0",
  },
  {
    id: "text_detected",
    label: "Yazı içermiyor",
    blockText:
      "text_detected: görselde yazı var (info amaçlı, risk olmayabilir)",
    active: true,
    productTypes: null,
    version: "1.0",
  },
  {
    id: "gibberish_text_detected",
    label: "Anlamsız yazı yok",
    blockText:
      "gibberish_text_detected: görseldeki yazı anlamsız/bozuk",
    active: true,
    productTypes: null,
    version: "1.0",
  },
];

/**
 * Compose context — bağlama göre filtreleme.
 */
export type ReviewComposeContext = {
  productType: string;
  /** Transparent target (alpha-checks ile uyumlu). Builtin'lerde
   *  zaten productTypes filter'ı bu sinyalle eşleniyor; explicit
   *  alan defansif. */
  isTransparentTarget: boolean;
};

/**
 * Bağlama uyan aktif kriterlerin listesi. Admin UI / DB override
 * gelene kadar builtin'lerden filtre.
 */
export function selectActiveCriteria(
  ctx: ReviewComposeContext,
  source: ReadonlyArray<ReviewCriterion> = BUILTIN_CRITERIA,
): ReviewCriterion[] {
  return source.filter((c) => {
    if (!c.active) return false;
    if (c.productTypes === null) return true;
    return c.productTypes.includes(ctx.productType);
  });
}

/**
 * Final master prompt — block compose. Worker bu çıktıyı provider'a
 * verir, snapshot'lar audit alır. Pasif/bağlam dışı bloklar
 * prompta girmez (CLAUDE.md Madde O).
 */
export function composeReviewSystemPrompt(
  ctx: ReviewComposeContext,
  source: ReadonlyArray<ReviewCriterion> = BUILTIN_CRITERIA,
): { systemPrompt: string; selectedCriterionIds: ReviewRiskFlagType[] } {
  const selected = selectActiveCriteria(ctx, source);
  const blockLines = selected.map((c) => `- ${c.blockText}`).join("\n");

  const systemPrompt = `Sen bir Etsy print-on-demand görsel kalite denetçisisin.
Verilen tek görsel için yalnızca aşağıdaki JSON şemasında dönüt ver:

{
  "score": 0-100 arası tam sayı (genel kalite),
  "textDetected": boolean (görselde herhangi bir yazı/kelime var mı),
  "gibberishDetected": boolean (var olan yazı anlamsız/hatalı mı),
  "riskFlags": [{ "kind": <aşağıdaki sabit kind'lardan biri>, "confidence": 0-1, "reason": kısa açıklama }],
  "summary": kısa cümle
}

Sabit risk flag kind'ları (yalnız bu listeden seç):
${blockLines}

KESİN KURAL: JSON anahtarlarını ASLA Türkçeleştirme. Anahtar isimleri tam olarak şu olmalı:
"score", "textDetected", "gibberishDetected", "riskFlags", "kind", "confidence", "reason", "summary".
Sadece "reason" ve "summary" değerleri Türkçe yazılabilir; her şey İngilizce kalır.
KURAL: Hiçbir risk yoksa riskFlags = []. JSON dışında metin yazma.`;

  return {
    systemPrompt,
    selectedCriterionIds: selected.map((c) => c.id),
  };
}

/**
 * Compose surrogate version — builtin sürümlerin hash'i + aktif
 * id listesi. PROMPT_VERSION snapshot'lanırken bu surrogate'i de
 * audit'e ekleyebiliriz; ileride DB tabanlı override geldiğinde
 * compose deterministically değişir, snapshot drift'i tespit edilir.
 */
export function composeVersionToken(
  ctx: ReviewComposeContext,
  source: ReadonlyArray<ReviewCriterion> = BUILTIN_CRITERIA,
): string {
  const selected = selectActiveCriteria(ctx, source);
  const parts = selected.map((c) => `${c.id}@${c.version}`);
  return parts.join("|");
}
