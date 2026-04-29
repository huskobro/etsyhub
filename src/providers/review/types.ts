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

export type ReviewRiskFlag = {
  type: ReviewRiskFlagType;
  /** 0-1 arası provider güveni. Doğrulaması Task 4 parse katmanında yapılır. */
  confidence: number;
  /** Kısa, kullanıcıya görünür açıklama. */
  reason: string;
};

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
  kind: ReviewProviderKind;
  review: (input: ReviewInput, options: ReviewProviderRunOptions) => Promise<ReviewOutput>;
}
