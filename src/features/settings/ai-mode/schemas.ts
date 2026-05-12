// User Settings — ai-mode — Phase 5 §8 + Phase 6 Aşama 1
//
// kieApiKey + geminiApiKey encrypted at rest (CLAUDE.md güvenlik kuralı).
// Service katmanı transparent encrypt/decrypt yapar; caller plain string görür.
//
// Phase 6 Aşama 1: `reviewProvider` runtime seçim (KIE vs Google direct).
// Migration YOK — UserSetting.value Json field; mevcut row'larda field
// eksikse Zod parse default `"kie"` döndürür (backwards compat).

import { z } from "zod";

/** Review provider runtime seçimi — Phase 6 Aşama 1. */
export const ReviewProviderChoiceSchema = z.enum(["kie", "google-gemini"]);
export type ReviewProviderChoice = z.infer<typeof ReviewProviderChoiceSchema>;

/**
 * Batch-first Phase 7 — default image generation provider seçimi.
 *
 * Provider-first ürün dili: kullanıcı batch başlattığında bu varsayılan
 * provider seçili gelir; A6 modal veya AI mode form'da override edilebilir.
 *
 * Şimdilik:
 *   - "midjourney" — Midjourney bridge (default, kullanıcının kararı)
 *   - "kie-gpt-image-1.5" — Kie GPT Image 1.5 (image-to-image)
 *   - "kie-z-image" — Kie Z-Image (text-to-image)
 *
 * Yeni provider ekleme: enum'a yeni id eklemek + provider registry'e
 * implementation eklemek yeterli. Schema-zero — UserSetting.value Json.
 */
export const ImageProviderChoiceSchema = z.enum([
  "midjourney",
  "kie-gpt-image-1.5",
  "kie-z-image",
]);
export type ImageProviderChoice = z.infer<typeof ImageProviderChoiceSchema>;

export const AiModeSettingsSchema = z.object({
  kieApiKey: z.string().nullable(), // encrypted at rest in service layer
  geminiApiKey: z.string().nullable(),
  // Default "kie" — bugünkü ürün gerçeği (KIE.ai üzerinden Gemini 2.5 Flash).
  // Aşama 2'ye kadar bu provider STUB durumda; default user review job FAIL
  // olur (yön mesajıyla). Kullanıcı "google-gemini"ye geçebilir.
  reviewProvider: ReviewProviderChoiceSchema.default("kie"),
  // Phase 7 — Default image provider. Midjourney varsayılan (kullanıcı
  // kararı); batch creation surface'leri bu değeri okur ve seçili getirir.
  defaultImageProvider: ImageProviderChoiceSchema.default("midjourney"),
});

export type AiModeSettings = z.infer<typeof AiModeSettingsSchema>;

/**
 * Persisted (stored) JSON shape parser — kullanıcının DB satırından okunan
 * raw JSON `value`'sini parse eder.
 *
 * Hardening (Task 12): bilinmeyen alanlar PARSE FAIL — service `as` cast yerine
 * bunu çağırır (Task 11 carry-forward, asimetri kapanır). Bozuk persist
 * (örn. tip değişikliği veya elle düzenlenmiş JSON) → fail-fast throw.
 *
 * Phase 6 Aşama 1: `reviewProvider` opsiyonel + default "kie". Mevcut row'lar
 * (alan yokken yazılmış) hata vermeden default'a düşer; migration gerekmiyor.
 */
export const StoredAiModeSettingsSchema = z
  .object({
    kieApiKey: z.string().nullable(),
    geminiApiKey: z.string().nullable(),
    reviewProvider: ReviewProviderChoiceSchema.default("kie"),
    defaultImageProvider: ImageProviderChoiceSchema.default("midjourney"),
  })
  .strict();

export type StoredAiModeSettings = z.infer<typeof StoredAiModeSettingsSchema>;
