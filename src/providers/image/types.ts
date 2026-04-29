// Image provider contracts (Phase 5 §2.2).
//
// Bu katman text/AI providers'tan AYRI tutulur. Görsel üretim
// capability-aware'dır: bir provider yalnız belirli sözleşmelerle çalışır
// (image-to-image, text-to-image). Registry pattern (R17.3): hardcoded
// model lookup YASAK; sessiz fallback YOK.
import type { VariationState } from "@prisma/client";

export type ImageCapability = "image-to-image" | "text-to-image";

export type ImageAspectRatio =
  | "1:1"
  | "2:3"
  | "3:2"
  | "4:3"
  | "3:4"
  | "16:9"
  | "9:16";

export type ImageGenerateInput = {
  prompt: string;
  /**
   * Reference image URLs for image-to-image capability providers.
   *
   * SÖZLEŞME (R17.2 — local→AI bridge yok):
   *   - YALNIZ public HTTP(S) URL kabul edilir
   *   - Local file path YASAK (örn. "/Users/foo/img.png")
   *   - file:// URI YASAK
   *   - data: URI / base64 YASAK
   *   - Buffer / Blob YASAK
   *
   * Local mode bu provider'ları HİÇ çağırmaz; AI mode yalnız upload edilmiş
   * (URL'ye dönüşmüş) referansları kabul eder. Bu kural kasıtlı — local
   * library'den AI'ya bridge AÇILMAZ; iki dünya tamamen ayrı.
   */
  referenceUrls?: string[];
  aspectRatio: ImageAspectRatio;
  quality?: "medium" | "high";
};

export type ImageGenerateOutput = {
  providerTaskId: string;
  state: VariationState;
};

export type ImagePollOutput = {
  state: VariationState;
  imageUrls?: string[];
  error?: string;
};

/**
 * Provider çağrı opsiyonları (Phase 5 closeout settings-aware hotfix —
 * 2026-04-29). Provider stateless tutulur; caller (worker) per-user
 * `kieApiKey` setting'ini decrypt'leyip buradan geçer.
 *
 * Phase 6 review provider'ı (`ReviewProviderRunOptions`) ile simetrik
 * pattern: env var bağımlılığı YASAK; multi-tenant izolasyon korunur.
 */
export type ImageGenerateOptions = {
  /** Per-user encrypted KIE API key — settings.aiMode.kieApiKey decrypt'lenmiş hali. */
  apiKey: string;
};

export type ImagePollOptions = {
  /** Per-user encrypted KIE API key — settings.aiMode.kieApiKey decrypt'lenmiş hali. */
  apiKey: string;
};

export interface ImageProvider {
  readonly id: string;
  readonly capabilities: ReadonlyArray<ImageCapability>;
  generate(
    input: ImageGenerateInput,
    options: ImageGenerateOptions,
  ): Promise<ImageGenerateOutput>;
  poll(
    providerTaskId: string,
    options: ImagePollOptions,
  ): Promise<ImagePollOutput>;
}
