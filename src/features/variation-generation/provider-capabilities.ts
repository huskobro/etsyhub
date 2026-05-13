// Batch-first Phase 9 — Provider capability registry (UI-side).
// Phase 60 — Midjourney görünürlük + provider-aware form metadata.
//
// AMAÇ: variation form'unda provider seçimine göre aspect ratio / quality
// dropdown options + reference parameter chips + üretim modu seçimi
// dinamikleştirmek. Yeni big abstraction DEĞİL — mevcut hardcoded
// `MODELS` array'i (`ai-mode-form.tsx`) zenginleştiren minimal registry.
// Server-side `ImageProvider.capabilities` ile uyumlu ama UI'dan
// client-side accessible (her şey static literal).
//
// PROVIDER SCOPE NOTU (Phase 60):
//   - "midjourney" UI'da artık `available: true` görünür ve **default**
//     provider olarak işlenir (operator preference: "Midjourney-first
//     experience"). Server-side `createMidjourneyJob` (kind=GENERATE)
//     reference URL'lerden /imagine + --sref/oref/cref destekliyor
//     (Pass 65 referenceUrls + kind=GENERATE schema). launchBatch
//     dispatcher Phase 60 scope'unda yalnız Kie'yi çağırıyor; Midjourney
//     selected iken UI honest disclosure gösterir ("MJ handoff in
//     Phase 61"), Kie fallback link sunar. Fake disabled CTA DEĞİL —
//     operator tıklayınca ne olacağını / olmayacağını biliyor.
//   - "kie-gpt-image-1.5" image-to-image, ratios + quality.
//   - "kie-z-image" text-to-image only, geniş ratio set, quality YOK
//     (kie-z-image.ts:47-53 sözleşmesi).

import type { ImageCapability, ImageAspectRatio } from "@/providers/image/types";

export type ImageProviderUiId = "midjourney" | "kie-gpt-image-1.5" | "kie-z-image";

/**
 * Phase 60 — Midjourney generation modes (reference parameter mapping).
 *
 * Midjourney /imagine + --sref/oref/cref + describe modları için UI
 * form'unda mode picker render edilir. Diğer provider'lar bu alanı
 * kullanmaz (Kie image-to-image yalnız reference asset + brief).
 *
 *   - "imagine": Pure prompt-based generation. Reference asset opsiyonel
 *     (sadece bağlam için describe çıktısı kullanılabilir).
 *   - "sref": Style reference — reference URL --sref olarak inject edilir;
 *     prompt zorunlu (stil aktarımı yapılır, içerik prompt'tan gelir).
 *   - "oref": Object reference — referans nesnesi/karakter --oref olarak.
 *   - "cref": Character reference — Midjourney v6+ character consistency.
 *   - "image-prompt": Klasik image prompt (URL'i prompt başına yerleştir).
 *   - "describe": Reference URL'den prompt üret (no generation; describe
 *     pipeline). Form prompt'u opsiyonel yapar.
 */
export type MidjourneyMode =
  | "imagine"
  | "image-prompt"
  | "sref"
  | "oref"
  | "cref"
  | "describe";

export type ProviderFormFields = {
  /** Prompt input alanı görünür mü? */
  showPrompt: boolean;
  /** Prompt zorunlu mu? (false = opsiyonel; describe modunda hiç gerekmeyebilir). */
  promptRequired: boolean;
  /** Mode picker görünür mü? (Midjourney için aktif). */
  showModeSelector: boolean;
  /** Reference parameter chips (sref/oref/cref) görünür mü? */
  showReferenceParameters: boolean;
  /** Quality dropdown görünür mü? */
  showQuality: boolean;
  /** Variation count slider/segmented görünür mü? */
  showCount: boolean;
  /** Brief textarea (Kie'de tek prompt input rolünü oynar). */
  showBrief: boolean;
};

export type ProviderCapability = {
  /** Provider id — settings.aiMode.defaultImageProvider ile aynı namespace. */
  id: ImageProviderUiId;
  /** Kullanıcı-facing label (formatProviderLabel pattern). */
  label: string;
  /** Form'dan tetiklenebilir mi. */
  available: boolean;
  /**
   * Phase 60 — Launch endpoint backend dispatcher henüz hazır mı?
   * UI Midjourney'i seçtiğinde `available: true` ama
   * `launchBackendReady: false` ise honest disclosure gösterir
   * ("MJ handoff coming next phase").
   */
  launchBackendReady: boolean;
  /** launchBackendReady=false durumunda operatör için ne yapacağı. */
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
  /**
   * Phase 60 — Provider-aware form field visibility.
   * Form provider switch ettiğinde alan setini buraya göre dinamikleştirir.
   */
  formFields: ProviderFormFields;
  /**
   * Phase 60 — Midjourney özelinde desteklenen modlar.
   * Diğer provider'larda undefined.
   */
  midjourneyModes?: ReadonlyArray<MidjourneyMode>;
};

export const PROVIDER_CAPABILITIES: ReadonlyArray<ProviderCapability> = [
  {
    id: "midjourney",
    label: "Midjourney",
    // Phase 60 — UI'da görünür. Operator default tercihi; backend
    // dispatcher Phase 61'de bağlanana kadar launchBackendReady=false.
    available: true,
    launchBackendReady: false,
    helperText:
      "Midjourney /imagine + --sref/--oref/--cref backend is wired; launch dispatcher arrives in Phase 61. For now, switch to Kie · GPT Image 1.5 to launch the batch immediately, or keep the form filled and wait for the handoff.",
    capabilities: ["image-to-image", "text-to-image"],
    supportedAspectRatios: ["1:1", "2:3", "3:2"],
    supportedQualities: ["medium", "high"],
    formFields: {
      showPrompt: true,
      promptRequired: false, // describe mode'da gerekmez; rest mode'larda strongly recommended
      showModeSelector: true,
      showReferenceParameters: true,
      showQuality: true,
      showCount: true,
      showBrief: false, // Midjourney'in brief'i prompt'tur, ayrı alana gerek yok
    },
    midjourneyModes: ["imagine", "image-prompt", "sref", "oref", "cref", "describe"],
  },
  {
    id: "kie-gpt-image-1.5",
    label: "Kie · GPT Image 1.5",
    available: true,
    launchBackendReady: true,
    capabilities: ["image-to-image"],
    supportedAspectRatios: ["1:1", "2:3", "3:2"],
    supportedQualities: ["medium", "high"],
    formFields: {
      showPrompt: false,
      promptRequired: false,
      showModeSelector: false,
      showReferenceParameters: false,
      showQuality: true,
      showCount: true,
      showBrief: true,
    },
  },
  {
    id: "kie-z-image",
    label: "Kie · Z-Image",
    available: false,
    launchBackendReady: false,
    helperText:
      "Coming soon — text-to-image provider, wider aspect ratios. Reference image not used.",
    capabilities: ["text-to-image"],
    supportedAspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    supportedQualities: [],
    formFields: {
      showPrompt: true,
      promptRequired: true,
      showModeSelector: false,
      showReferenceParameters: false,
      showQuality: false,
      showCount: true,
      showBrief: false,
    },
  },
];

/**
 * Phase 60 — Default provider helper.
 * UI form'larında provider state initial value'su:
 *   - Settings'ten gelen `defaultImageProvider` varsa onu (operator override)
 *   - Yoksa: ilk `available: true` provider → "midjourney" (Midjourney-first
 *     experience)
 *
 * Not: launchBackendReady=false olsa bile default kalır — operatör
 * Midjourney'i seçili görür, alanları görür, honest disclosure ile
 * "MJ launch coming next phase" bilgisi alır. Sessiz Kie fallback YOK.
 */
export function resolveDefaultProvider(
  settingsDefault?: string | null,
): ImageProviderUiId {
  if (settingsDefault) {
    const match = PROVIDER_CAPABILITIES.find((p) => p.id === settingsDefault);
    if (match && match.available) return match.id;
  }
  const firstAvail = PROVIDER_CAPABILITIES.find((p) => p.available);
  return firstAvail?.id ?? "midjourney";
}

/**
 * Phase 60 — Midjourney mode → form field requirements mapper.
 *
 * Hangi mod hangi alanları gerektirir?
 *   - "imagine": prompt strongly recommended, reference URL opsiyonel
 *   - "image-prompt": prompt zorunlu + reference URL prompt'a inject
 *   - "sref"/"oref"/"cref": prompt opsiyonel ama önerilir
 *     (Midjourney --sref ile başka prompt verebilirsin); reference URL zorunlu
 *   - "describe": prompt YASAK (sadece describe çıktısı üretilir)
 */
export function midjourneyModeRequirements(mode: MidjourneyMode): {
  promptRequired: boolean;
  promptDisabled: boolean;
  hint: string;
} {
  switch (mode) {
    case "imagine":
      return {
        promptRequired: true,
        promptDisabled: false,
        hint: "Pure /imagine — operator writes the full prompt. Reference URL is not injected.",
      };
    case "image-prompt":
      return {
        promptRequired: true,
        promptDisabled: false,
        hint: "Reference URL prepended to prompt as an image prompt. Style + composition flow from the source.",
      };
    case "sref":
      return {
        promptRequired: false,
        promptDisabled: false,
        hint: "Style reference (--sref). Reference URL drives palette + brushwork; prompt drives content. Either is fine.",
      };
    case "oref":
      return {
        promptRequired: false,
        promptDisabled: false,
        hint: "Object reference (--oref). Reference image carries the object identity; prompt frames the scene.",
      };
    case "cref":
      return {
        promptRequired: false,
        promptDisabled: false,
        hint: "Character reference (--cref). Reference image carries character likeness; prompt drives action + setting.",
      };
    case "describe":
      return {
        promptRequired: false,
        promptDisabled: true,
        hint: "Describe pipeline — Midjourney reads the reference and returns 4 prompt suggestions. No generation occurs.",
      };
  }
}

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
