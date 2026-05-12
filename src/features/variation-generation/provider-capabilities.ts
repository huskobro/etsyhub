// Batch-first Phase 9 — Provider capability registry (UI-side).
//
// AMAÇ: variation form'unda provider seçimine göre aspect ratio / quality
// dropdown options dinamikleştirmek. Yeni big abstraction DEĞİL — mevcut
// hardcoded `MODELS` array'i (`ai-mode-form.tsx`) zenginleştiren minimal
// registry. Server-side `ImageProvider.capabilities` ile uyumlu ama
// UI'dan client-side accessible (her şey static literal).
//
// PROVIDER SCOPE NOTU:
//   - "midjourney" UI'da görünür ama disabled (Phase 5/6 karar; MJ bridge
//     ayrı admin akışı). Capabilities yine de declare edildi — gelecek
//     expansion için.
//   - "kie-gpt-image-1.5" image-to-image, ratios + quality.
//   - "kie-z-image" text-to-image only, geniş ratio set, quality YOK
//     (kie-z-image.ts:47-53 sözleşmesi).

import type { ImageCapability, ImageAspectRatio } from "@/providers/image/types";

export type ImageProviderUiId = "midjourney" | "kie-gpt-image-1.5" | "kie-z-image";

export type ProviderCapability = {
  /** Provider id — settings.aiMode.defaultImageProvider ile aynı namespace. */
  id: ImageProviderUiId;
  /** Kullanıcı-facing label (formatProviderLabel pattern). */
  label: string;
  /** Form'dan tetiklenebilir mi (Midjourney şu an "separate admin flow"). */
  available: boolean;
  /** Available değilse operatör için açıklama. */
  helperText?: string;
  /** Bu provider'ın desteklediği capability'ler. */
  capabilities: ReadonlyArray<ImageCapability>;
  /**
   * Form'da gösterilebilecek aspect ratio seçenekleri. Server-side
   * `ImageGenerateInput.aspectRatio` ile uyumlu. Provider seçimi değince
   * form dropdown bu liste ile günceller.
   */
  supportedAspectRatios: ReadonlyArray<ImageAspectRatio>;
  /**
   * Quality desteği. Boş array → form quality dropdown'ı disabled
   * (provider'ın quality parametresi yok — örn. Kie · Z-Image).
   */
  supportedQualities: ReadonlyArray<"medium" | "high">;
};

export const PROVIDER_CAPABILITIES: ReadonlyArray<ProviderCapability> = [
  {
    id: "midjourney",
    label: "Midjourney",
    available: false,
    helperText:
      "Midjourney runs through the operator browser bridge (separate admin flow). Pick a Kie provider here to launch from this form.",
    capabilities: ["image-to-image", "text-to-image"],
    // Midjourney bridge ratio set'i — UI gelecek expansion için declare
    // edildi; şu an form'dan tetiklenmez.
    supportedAspectRatios: ["1:1", "2:3", "3:2"],
    supportedQualities: ["medium", "high"],
  },
  {
    id: "kie-gpt-image-1.5",
    label: "Kie · GPT Image 1.5",
    available: true,
    capabilities: ["image-to-image"],
    supportedAspectRatios: ["1:1", "2:3", "3:2"],
    supportedQualities: ["medium", "high"],
  },
  {
    id: "kie-z-image",
    label: "Kie · Z-Image",
    available: false,
    helperText:
      "Coming soon — text-to-image provider, wider aspect ratios. Reference image not used.",
    capabilities: ["text-to-image"],
    // kie-z-image.ts:47-53 sözleşmesi — aspect ratio kümesi daha geniş,
    // 2:3/3:2 YOK.
    supportedAspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    // Z-Image quality parametresi taşımıyor — dropdown disabled.
    supportedQualities: [],
  },
];

export function getProviderCapability(
  id: string,
): ProviderCapability | null {
  return (
    PROVIDER_CAPABILITIES.find((p) => p.id === (id as ImageProviderUiId)) ??
    null
  );
}

/**
 * Verilen aspect ratio bu provider tarafından destekleniyor mu?
 * Form provider değişikliğinde mevcut state'i validate eder; geçersizse
 * destekli ilk değere düşer.
 */
export function isAspectRatioSupported(
  providerId: string,
  ratio: ImageAspectRatio,
): boolean {
  const cap = getProviderCapability(providerId);
  if (!cap) return false;
  return cap.supportedAspectRatios.includes(ratio);
}

/**
 * Provider değişikliğinde mevcut aspect ratio invalid ise destekli ilk
 * değere fallback yap. Boş set → ilk supported, yine boşsa "1:1".
 */
export function resolveDefaultAspectRatio(
  providerId: string,
  currentRatio: ImageAspectRatio,
): ImageAspectRatio {
  if (isAspectRatioSupported(providerId, currentRatio)) return currentRatio;
  const cap = getProviderCapability(providerId);
  return cap?.supportedAspectRatios[0] ?? "1:1";
}
