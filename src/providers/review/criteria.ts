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

import type {
  AnyReviewCriterionId,
  ReviewRiskFlagType,
} from "@/providers/review/types";

/**
 * Severity / fail behavior — CLAUDE.md Madde O. Bir kriter geçmediğinde
 * ne olur:
 *   • "info"     — uyarı, skor düşmez (text_detected gibi)
 *   • "warning"  — skor weight kadar düşer
 *   • "blocker"  — fail durumunda decision NEEDS_REVIEW'a düşürülür
 *                   (binary fail gate)
 * Builtin defaults review prompt'u ile uyumlu; admin override ile
 * kriter bazında değişebilir.
 */
export type CriterionSeverity = "info" | "warning" | "blocker";

/**
 * Image transparency state — applicability rule key. asset.hasAlpha
 * sinyalinden türev; null ise "any" olarak değerlendirilir.
 */
export type ImageTransparencyState = "with_alpha" | "no_alpha";

/**
 * Applicability rules — kompozit AND filter. Tüm boyutlar **null
 * ⇒ "any"** semantiği taşır; en az bir kuralın eşleşmediği context
 * için kriter not-applicable döner.
 */
export type CriterionApplicability = {
  /** Ürün-tip listesi; null ⇒ tüm product type'lar. */
  productTypes: ReadonlyArray<string> | null;
  /** Image format (mime sub-type, lowercase): "png" | "webp" | "jpeg"
   *  | "jpg" | "gif" | "tiff". null ⇒ tüm format'lar. */
  formats: ReadonlyArray<string> | null;
  /** Image transparency state — `no_alpha` ürünlerde transparent
   *  kuralı applicable değildir. null ⇒ farketmez. */
  transparency: ImageTransparencyState | null;
  /** Kaynak tip — "design" (AI variation), "local-library", null ⇒ ikisi. */
  sourceKinds: ReadonlyArray<"design" | "local-library"> | null;
  /** Yalnız bu transform'lardan biri uygulanmışsa applicable. Boş
   *  array ⇒ transform şartı yok (default builtin). */
  requiresAnyTransform: ReadonlyArray<string> | null;
};

/**
 * Criterion family — CLAUDE.md Madde O.
 *   • "semantic"  — provider (Gemini) cevap döndürür; riskFlag
 *                   varsa fail. Master prompt'a blockText eklenir.
 *   • "technical" — server-side evaluator asset metadata'sını okur
 *                   ve technicalRule kuralını uygular. Provider
 *                   çağrısı gerekmez; promptta görünmez.
 *
 * Aynı UI iki aileye de açıktır (label/weight/severity/
 * applicability/active). Operator family chip'i ile hangi tarafın
 * çalıştırdığını görür.
 */
export type CriterionFamily = "semantic" | "technical";

/**
 * Technical rule payload — `family === "technical"` kriterin
 * server-side evaluator parametresi. Discriminated union; her tip
 * kendi config alanlarını taşır.
 *
 * Yeni kural tipi eklemek için: (1) buraya variant ekle, (2)
 * server/services/review/technical-eval.ts evaluate() switch'ine
 * implement, (3) builtin satırı criteria.ts BUILTIN_CRITERIA'a
 * ekle. Drift koruması — type ile evaluator senkron kalır.
 */
export type TechnicalRule =
  | {
      kind: "min_dpi";
      /** Minimum DPI (e.g. 300 for print-ready). */
      minDpi: number;
    }
  | {
      kind: "min_resolution";
      /** Minimum pixel count on the smaller side. */
      minMinSidePx: number;
    }
  | {
      kind: "format_whitelist";
      /** Lowercase format names (png/webp/jpeg/jpg/tiff/gif). */
      allowed: ReadonlyArray<string>;
    }
  | {
      kind: "aspect_ratio";
      /** Target ratio (width / height). */
      target: number;
      /** Acceptable absolute deviation (e.g. 0.02 = ±2 %). */
      tolerance: number;
    }
  | {
      kind: "transparency_required";
      // No payload; rule fails when hasAlpha === false.
    };

export type ReviewCriterion = {
  /** Risk flag taksonomisi (semantic için ReviewRiskFlagType; technical
   *  için TechnicalReviewFlagType). Provider response yalnız semantic
   *  id'leri döner; technical id'ler server-side evaluator tarafından
   *  üretilir. */
  id: AnyReviewCriterionId;
  /** Family — semantic vs technical. Default semantic (geriye
   *  uyumlu). */
  family: CriterionFamily;
  /** Operator-facing English label. EvaluationPanel checklist
   *  reads this directly. */
  label: string;
  /** Operator-facing English description (admin pane'de detay). */
  description: string;
  /** Master prompt block — provider reads this English instruction.
   *  Technical kriterler için boş string ("not used in compose"). */
  blockText: string;
  /** Active flag — inactive blocks excluded from compose & UI. */
  active: boolean;
  /** 0–100 weight (score contribution upper bound). Failed
   *  warning-level criterion subtracts up to this from a 100 base
   *  (cumulative; clamped to ≥0). Blocker fail → NEEDS_REVIEW
   *  regardless of weight. Info-level fails do not subtract. */
  weight: number;
  /** Severity / fail behavior. */
  severity: CriterionSeverity;
  /** Composite applicability filter. */
  applicability: CriterionApplicability;
  /** Technical rule payload. Yalnız family === "technical" iken
   *  dolu; semantic kriterlerde undefined. */
  technicalRule?: TechnicalRule;
  /** Builtin sürüm — değişikliği prompt versiyonunu etkiler. */
  version: string;
};

/** Default applicability — applies to every context. */
const APPLY_TO_ALL: CriterionApplicability = {
  productTypes: null,
  formats: null,
  transparency: null,
  sourceKinds: null,
  requiresAnyTransform: null,
};

/** Transparency-target applicability. Active only when productType is
 *  transparent-target AND image format/state supports alpha. JPEG
 *  is excluded (no alpha channel possible) — for JPEG these criteria
 *  show as not-applicable in UI. */
const APPLY_TO_TRANSPARENT_TARGET: CriterionApplicability = {
  productTypes: ["clipart", "sticker", "transparent_png"],
  formats: ["png", "webp", "tiff"],
  transparency: null,
  sourceKinds: null,
  requiresAnyTransform: null,
};

export const BUILTIN_CRITERIA: ReadonlyArray<ReviewCriterion> = [
  {
    id: "watermark_detected",
    label: "No watermark or stamp",
    description:
      "Image must not contain semi-transparent signatures or watermarks.",
    blockText:
      "watermark_detected: a translucent signature or watermark trace is visible.",
    active: true,
    weight: 30,
    severity: "blocker",
    applicability: APPLY_TO_ALL,
    family: "semantic",
    version: "1.1",
  },
  {
    id: "signature_detected",
    label: "No artist signature",
    description:
      "A handwritten signature or artist mark would conflict with commercial use.",
    blockText:
      "signature_detected: an artist signature or handwriting is visible.",
    active: true,
    weight: 20,
    severity: "blocker",
    applicability: APPLY_TO_ALL,
    family: "semantic",
    version: "1.1",
  },
  {
    id: "visible_logo_detected",
    label: "No visible brand logo",
    description:
      "Branded logos pose a trademark risk for digital downloads.",
    blockText:
      "visible_logo_detected: a brand or company logo is visible.",
    active: true,
    weight: 25,
    severity: "blocker",
    applicability: APPLY_TO_ALL,
    family: "semantic",
    version: "1.1",
  },
  {
    id: "celebrity_face_detected",
    label: "No recognizable face",
    description:
      "A celebrity face creates IP and right-of-publicity risk.",
    blockText:
      "celebrity_face_detected: a recognizable celebrity face is present.",
    active: true,
    weight: 25,
    severity: "blocker",
    applicability: APPLY_TO_ALL,
    family: "semantic",
    version: "1.1",
  },
  {
    id: "no_alpha_channel",
    label: "Alpha channel suitable",
    description:
      "Transparent target products must ship with a real alpha channel.",
    blockText:
      "no_alpha_channel: the image lacks an alpha channel even though the target product is transparent.",
    active: true,
    weight: 20,
    severity: "warning",
    applicability: APPLY_TO_TRANSPARENT_TARGET,
    family: "semantic",
    version: "1.1",
  },
  {
    id: "transparent_edge_artifact",
    label: "Clean transparent edges",
    description:
      "Edges should not show jagged remnants from poor masking.",
    blockText:
      "transparent_edge_artifact: the transparent image has edge artefacts.",
    active: true,
    weight: 15,
    severity: "warning",
    applicability: APPLY_TO_TRANSPARENT_TARGET,
    family: "semantic",
    version: "1.1",
  },
  {
    id: "text_detected",
    label: "No embedded text",
    description:
      "Embedded text limits resale flexibility and may be off-policy.",
    blockText:
      "text_detected: text or words appear in the image (informational; not always a risk).",
    active: true,
    weight: 10,
    severity: "warning",
    applicability: APPLY_TO_ALL,
    family: "semantic",
    version: "1.1",
  },
  {
    id: "gibberish_text_detected",
    label: "No gibberish text",
    description:
      "AI-generated images often contain malformed letters; these must not ship.",
    blockText:
      "gibberish_text_detected: text in the image is malformed or unreadable.",
    active: true,
    weight: 25,
    severity: "blocker",
    applicability: APPLY_TO_ALL,
    family: "semantic",
    version: "1.1",
  },
  // ──────────────────────────────────────────────────────────────────
  // IA Phase 23 — technical criteria (CLAUDE.md Madde O — teknik
  // kalite kuralları). Server-side evaluator runs these against
  // asset metadata; provider call not needed. Same UI knobs as
  // semantic criteria (active/weight/severity/applicability) +
  // a `technicalRule` payload that the evaluator switches on.
  // ──────────────────────────────────────────────────────────────────
  {
    id: "tech_min_dpi",
    label: "Minimum DPI",
    description:
      "Image DPI metadata must meet the threshold (300 by default for print-ready outputs).",
    blockText: "",
    active: true,
    weight: 15,
    severity: "warning",
    applicability: APPLY_TO_ALL,
    family: "technical",
    technicalRule: { kind: "min_dpi", minDpi: 300 },
    version: "1.0",
  },
  {
    id: "tech_min_resolution",
    label: "Minimum resolution",
    description:
      "Smaller-side pixel count must meet the threshold (1800 px by default — sufficient for premium print).",
    blockText: "",
    active: true,
    weight: 20,
    severity: "warning",
    applicability: APPLY_TO_ALL,
    family: "technical",
    technicalRule: { kind: "min_resolution", minMinSidePx: 1800 },
    version: "1.0",
  },
  {
    id: "tech_format_whitelist",
    label: "Allowed file format",
    description:
      "Image format must be one of the allowed list. Defaults: PNG / WebP / JPEG / TIFF.",
    blockText: "",
    active: true,
    weight: 25,
    severity: "blocker",
    applicability: APPLY_TO_ALL,
    family: "technical",
    technicalRule: {
      kind: "format_whitelist",
      allowed: ["png", "webp", "jpeg", "jpg", "tiff"],
    },
    version: "1.0",
  },
  {
    id: "tech_aspect_ratio",
    label: "Aspect ratio target",
    description:
      "Image aspect ratio must match the target within tolerance (1:1 default, ±2 %).",
    blockText: "",
    active: false,
    weight: 10,
    severity: "info",
    applicability: APPLY_TO_ALL,
    family: "technical",
    technicalRule: { kind: "aspect_ratio", target: 1, tolerance: 0.02 },
    version: "1.0",
  },
  {
    id: "tech_transparency_required",
    label: "Transparency required",
    description:
      "Asset must carry a real alpha channel (Sharp probe). Applicable only to transparent target product types.",
    blockText: "",
    active: true,
    weight: 25,
    severity: "blocker",
    applicability: APPLY_TO_TRANSPARENT_TARGET,
    family: "technical",
    technicalRule: { kind: "transparency_required" },
    version: "1.0",
  },
];

/**
 * Compose context — kompozit applicability filter girdisi. Caller
 * her boyutu açıkça doldurur; null/undefined kullanmaz (UI/worker
 * her ikisi de buna güvenir).
 */
export type ReviewComposeContext = {
  productType: string;
  /** Image MIME sub-type, lowercase: "png" | "webp" | "jpeg" | "jpg"
   *  | "gif" | "tiff". `image/png` → `png`. */
  format: string;
  /** Sharp probe sonucu — alpha kanalı var mı. null = bilinmiyor
   *  (legacy row); applicability transparency koşulu varsa bu
   *  bilinmediğinde "uygulanabilir" sayılır. */
  hasAlpha: boolean | null;
  /** Source kind — design (AI variation) / local-library. */
  sourceKind: "design" | "local-library";
  /** Asset üzerinde uygulanmış transform listesi (background_removed,
   *  cropped, vb.). invalidation helper sözlüğüyle aynı sözcükler. */
  transformsApplied: ReadonlyArray<string>;
};

/**
 * Bir kriter context'e uygulanabilir mi? CLAUDE.md Madde O — kompozit
 * AND filter. Uymazsa kriter "not-applicable" olarak işaretlenir
 * (compose dışı + UI neutral state).
 */
export function isCriterionApplicable(
  c: ReviewCriterion,
  ctx: ReviewComposeContext,
): boolean {
  if (!c.active) return false;
  const a = c.applicability;
  if (a.productTypes !== null && !a.productTypes.includes(ctx.productType)) {
    return false;
  }
  if (a.formats !== null && !a.formats.includes(ctx.format)) {
    return false;
  }
  if (a.transparency !== null) {
    if (ctx.hasAlpha === null) {
      // Bilinmeyen alfa — defansif: kuralı uygulanabilir tut. Sharp
      // probe legacy row'lar için null; UI neutral state göstermek
      // yerine kontrol etmeyi tercih eder.
    } else {
      const want = a.transparency === "with_alpha" ? true : false;
      if (ctx.hasAlpha !== want) return false;
    }
  }
  if (a.sourceKinds !== null && !a.sourceKinds.includes(ctx.sourceKind)) {
    return false;
  }
  if (a.requiresAnyTransform !== null && a.requiresAnyTransform.length > 0) {
    const matches = a.requiresAnyTransform.some((t) =>
      ctx.transformsApplied.includes(t),
    );
    if (!matches) return false;
  }
  return true;
}

/**
 * Aktif + applicable kriter listesi. Compose ve UI checklist aynı
 * kaynaktan beslenir.
 */
export function selectActiveCriteria(
  ctx: ReviewComposeContext,
  source: ReadonlyArray<ReviewCriterion> = BUILTIN_CRITERIA,
): ReviewCriterion[] {
  return source.filter((c) => isCriterionApplicable(c, ctx));
}

/**
 * Tüm kriterleri (active veya not-applicable) UI-ready bir
 * "applicability decision" ile döner. UI bu listeyi okur:
 * applicable === true ⇒ checklist satırı; false + active ⇒ neutral
 * state ("Not applicable for this asset"); active === false ⇒ hiç
 * gösterilmez.
 */
export function evaluateAllCriteria(
  ctx: ReviewComposeContext,
  source: ReadonlyArray<ReviewCriterion> = BUILTIN_CRITERIA,
): Array<{ criterion: ReviewCriterion; applicable: boolean }> {
  return source
    .filter((c) => c.active)
    .map((c) => ({ criterion: c, applicable: isCriterionApplicable(c, ctx) }));
}

/**
 * Default core master prompt — admin can override the spine via
 * settings (key="reviewMasterPrompt"). Two placeholders:
 *
 *   {{CRITERIA_BLOCK_LIST}} — replaced with active applicable
 *                              criterion block lines
 *
 * The placeholder discipline keeps the JSON schema invariant outside
 * the editable area; admins edit only the spine, never the response
 * contract. Worker validates that {{CRITERIA_BLOCK_LIST}} exists in
 * the override; missing placeholder → fallback to builtin core.
 */
export const BUILTIN_CORE_MASTER_PROMPT = `You are a quality reviewer for Etsy print-on-demand digital downloads.
For a single image, return ONLY the following JSON shape:

{
  "score": integer 0-100 (overall quality),
  "textDetected": boolean (any words in the image),
  "gibberishDetected": boolean (text is malformed),
  "riskFlags": [{ "kind": <one of the listed kinds>, "confidence": 0-1, "reason": short note }],
  "summary": single English sentence
}

Risk flag kinds — choose only from this list:
{{CRITERIA_BLOCK_LIST}}

Strict rules:
- Use the JSON keys exactly: "score", "textDetected", "gibberishDetected", "riskFlags", "kind", "confidence", "reason", "summary".
- "reason" and "summary" values MUST be written in English ONLY. Do not respond in Turkish, German, French, or any other language under any circumstances.
- If no risks, return riskFlags = [].
- Output JSON only — no prose outside the object.`;

const CRITERIA_PLACEHOLDER = "{{CRITERIA_BLOCK_LIST}}";

/**
 * Compose options — admin override hook.
 *   • coreMasterPrompt: alternative spine (editable). Validated:
 *     must contain {{CRITERIA_BLOCK_LIST}}; otherwise builtin core
 *     is used and a `coreOverrideRejected` flag returns true.
 *   • criteria: alternative criterion list (admin override stored
 *     by id; worker merges builtin + override before passing here).
 */
export type ReviewComposeOptions = {
  coreMasterPrompt?: string;
  criteria?: ReadonlyArray<ReviewCriterion>;
};

export type ReviewComposeResult = {
  systemPrompt: string;
  /** Active applicable criterion ids (= UI checklist). */
  /** Compose semantic kriterleri seçer; technical id'leri içermez.
   *  Tip union geniş tutuluyor çünkü AnyReviewCriterionId narrowing'i
   *  caller (worker) ortak listede tüketiyor. */
  selectedCriterionIds: AnyReviewCriterionId[];
  /** Stable signature (id@version|... over selected criteria) used for
   *  snapshot audit. UI does not show this raw — admin pane shows it
   *  as "Active block fingerprint" under Developer / Audit details. */
  fingerprint: string;
  /** True when the admin core override was rejected (placeholder
   *  missing). Worker surfaces this in the audit response so admin
   *  pane can warn. */
  coreOverrideRejected: boolean;
};

/**
 * Final master prompt — block compose. Worker calls this; output
 * snapshot'lanır. Pasif/bağlam dışı bloklar prompta girmez.
 */
export function composeReviewSystemPrompt(
  ctx: ReviewComposeContext,
  options: ReviewComposeOptions = {},
): ReviewComposeResult {
  const source = options.criteria ?? BUILTIN_CRITERIA;
  // CLAUDE.md Madde O — yalnız semantic kriterler master prompta
  // girer. Technical kriterler server-side evaluator tarafından
  // uygulanır; provider response'a karışmaz.
  const selected = selectActiveCriteria(ctx, source).filter(
    (c) => c.family === "semantic",
  );
  const blockLines = selected.map((c) => `- ${c.blockText}`).join("\n");

  let core = BUILTIN_CORE_MASTER_PROMPT;
  let coreOverrideRejected = false;
  if (options.coreMasterPrompt !== undefined) {
    if (options.coreMasterPrompt.includes(CRITERIA_PLACEHOLDER)) {
      core = options.coreMasterPrompt;
    } else {
      coreOverrideRejected = true;
    }
  }

  const systemPrompt = core.replace(CRITERIA_PLACEHOLDER, blockLines);
  const fingerprint = selected
    .map((c) => `${c.id}@${c.version}`)
    .join("|");

  return {
    systemPrompt,
    selectedCriterionIds: selected.map((c) => c.id),
    fingerprint,
    coreOverrideRejected,
  };
}

/**
 * Backwards-compat alias — early IA-15/16 callers used this name.
 * Returns just the fingerprint string (= old "compose token").
 */
export function composeVersionToken(
  ctx: ReviewComposeContext,
  source: ReadonlyArray<ReviewCriterion> = BUILTIN_CRITERIA,
): string {
  return composeReviewSystemPrompt(ctx, { criteria: source }).fingerprint;
}
