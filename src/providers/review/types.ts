/**
 * ReviewProvider — Phase 6 AI Quality Review.
 *
 * Bu interface bir REVIEW SIGNAL PRODUCER'dır, hard reject motoru değildir.
 * Provider çıktısı `ReviewOutput` olarak döner; karar verme (approved /
 * needs_review) ve sticky semantiği (USER override) ayrı katmanlarda
 * (decision rule + sticky helper) yapılır.
 *
 * Şu an tek kind: "vision" (multimodal LLM). Gelecekte deterministic /
 * heuristic / hibrit kind eklenebilir; o zaman discriminated union'a
 * genişletilir.
 */

/**
 * Risk flag türleri — DRIFT KORUMASI: tek kaynaklı sabit sözlük.
 * Provider parse katmanı (Task 4 Gemini impl) bu listeyi `z.enum()` ile
 * doğrular; bilinmeyen type ⇒ explicit throw.
 */
export const REVIEW_RISK_FLAG_TYPES = [
  "watermark_detected",
  "signature_detected",
  "visible_logo_detected",
  "celebrity_face_detected",
  "no_alpha_channel",
  "transparent_edge_artifact",
  "text_detected",
  "gibberish_text_detected",
] as const;

export type ReviewRiskFlagType = (typeof REVIEW_RISK_FLAG_TYPES)[number];

export function isReviewRiskFlagType(value: string): value is ReviewRiskFlagType {
  return (REVIEW_RISK_FLAG_TYPES as readonly string[]).includes(value);
}

/**
 * IA Phase 23 — technical criteria taksonomisi (CLAUDE.md Madde O,
 * teknik kalite kuralları). Server-side evaluator bu id'leri
 * üretir; provider response schema'sına dahil değildir (provider
 * yalnızca REVIEW_RISK_FLAG_TYPES'tan dönüt verir). UI iki
 * taksonomiyi tek criterion list'inde birleştirir.
 */
export const TECHNICAL_REVIEW_FLAG_TYPES = [
  "tech_min_dpi",
  "tech_min_resolution",
  "tech_format_whitelist",
  "tech_aspect_ratio",
  "tech_transparency_required",
] as const;

export type TechnicalReviewFlagType =
  (typeof TECHNICAL_REVIEW_FLAG_TYPES)[number];

/** Combined id namespace — UI/state uses both families. Provider
 *  response stays narrowed to ReviewRiskFlagType. */
export type AnyReviewCriterionId =
  | ReviewRiskFlagType
  | TechnicalReviewFlagType;

export function isTechnicalReviewFlagType(
  value: string,
): value is TechnicalReviewFlagType {
  return (TECHNICAL_REVIEW_FLAG_TYPES as readonly string[]).includes(value);
}

export type ReviewRiskFlag = {
  /**
   * Risk flag türü. Drift #5 (2026-04-30) sonrası alan adı `kind`.
   * Önceki ad `type` idi; KIE strict JSON schema validator'ı
   * `properties.type` shape'ini reserved word çakışması olarak reddetti
   * (HTTP 200 + envelope 422). 3 curl probe'la kanıtlandı: alan adı
   * `kind` olunca KIE 200 dönüyor.
   *
   * Geçiş modeli (kullanıcı yön kararı C — Hibrit):
   *   - Yazma (write-new): yeni review output'larında `kind` üretilir.
   *   - Okuma (read-both): tüketiciler `readRiskFlagKind` helper'ı ile
   *     önce `kind`, yoksa legacy `type` okur (DB'deki eski row'lar için).
   */
  kind: ReviewRiskFlagType;
  /** 0-1 arası provider güveni. Doğrulaması Task 4 parse katmanında yapılır. */
  confidence: number;
  /** Kısa, kullanıcıya görünür açıklama. */
  reason: string;
};

/**
 * Drift #5 read-both helper — DB'deki review row'ları runtime'da iki shape
 * taşıyabilir:
 *   - Yeni: { kind: "watermark_detected", ... }
 *   - Legacy: { type: "watermark_detected", ... }
 *
 * Bu fonksiyon herhangi bir flag entry'sinden kategori string'ini güvenli
 * çıkarır (önce `kind`, yoksa `type`). Geçersiz / null / non-object girişler
 * `null` döner. Tüketiciler (review-mapper, queue route, decisions API)
 * tek noktadan import eder — duplicate mantık YASAK.
 *
 * Not: Bu helper string döner; type guard değildir. `REVIEW_RISK_FLAG_TYPES`
 * üyeliği kontrolü çağrı tarafının sorumluluğu (`isReviewRiskFlagType`).
 */
export function readRiskFlagKind(entry: unknown): string | null {
  if (entry === null || entry === undefined) return null;
  if (typeof entry !== "object") return null;
  const obj = entry as { kind?: unknown; type?: unknown };
  if (typeof obj.kind === "string") return obj.kind;
  if (typeof obj.type === "string") return obj.type;
  return null;
}

/**
 * Görsel kaynağı — tek code path için discriminated union.
 *
 * Local mode (LocalLibraryAsset): kind: "local-path", filePath: "/Users/.../file.png"
 * AI mode (cloud R2/S3 asset): kind: "remote-url", url: "https://..."
 *
 * Her iki durumda image-loader.ts inlineData base64'e çevirir.
 * Files API / fileData.fileUri kullanılmıyor (Phase 6 kararı).
 */
export type ImageInput =
  | { kind: "local-path"; filePath: string }
  | { kind: "remote-url"; url: string };

export type ReviewInput = {
  image: ImageInput;
  /** Ürün tipi slug, örn. "clipart" | "wall_art". */
  productType: string;
  /** Transparent ürün hedefi mi (clipart/sticker/transparent_png). Alpha checks bu flag'e bağlı. */
  isTransparentTarget: boolean;
};

/**
 * Provider çağrı opsiyonları. Provider stateless tutulur; caller (Task 8 worker)
 * api key'i per-user settings'ten resolve eder ve buradan geçer.
 *
 * İleride eklenebilir: modelOverride, timeoutMs, traceId.
 */
export type ReviewProviderRunOptions = {
  apiKey: string;
};

export type ReviewOutput = {
  /** 0-100 kalite skoru. Decision rule (Task 6) eşik kontrolü için kullanır. */
  score: number;
  textDetected: boolean;
  gibberishDetected: boolean;
  /** Boş array ⇒ risk yok. */
  riskFlags: ReviewRiskFlag[];
  /** Kısa özet, detay panel ve audit için. */
  summary: string;
  /**
   * Conservative estimate (Phase 6). Minimum hesap birimi 1 cent (CostUsage
   * Int alan). Fractional fiyatlar (örn. ~$0.001/Gemini çağrısı) yuvarlanır;
   * gerçek faturalama DEĞİLDİR. Real-time pricing carry-forward:
   * `cost-real-time-pricing` (Phase 7+).
   *
   * Provider doldurmazsa caller (worker) defansif fallback kullanır.
   */
  costCents?: number;
};

/**
 * Şu an tek kind: "vision". Gelecekte deterministic eklenebilir
 * (örn. sharp tabanlı alpha-only producer); o zaman discriminated union.
 */
export type ReviewProviderKind = "vision";

export interface ReviewProvider {
  /** Snapshot string'inde model parçası olarak görünür, örn. "gemini-2-5-flash". */
  id: string;
  /**
   * Provider'ın altta tükettiği gerçek model string'i (örn. "gemini-2.5-flash").
   * Provider id ile aynı olmak zorunda değil — KIE id "kie-gemini-flash" iken
   * modelId "gemini-2.5-flash" olur. Audit/log/CostUsage için kanonik kaynak;
   * aynı model birden fazla transport (KIE / direct Google) altında çalışabilir.
   */
  modelId: string;
  kind: ReviewProviderKind;
  review: (input: ReviewInput, options: ReviewProviderRunOptions) => Promise<ReviewOutput>;
}
