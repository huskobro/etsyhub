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

export const AiModeSettingsSchema = z.object({
  kieApiKey: z.string().nullable(), // encrypted at rest in service layer
  geminiApiKey: z.string().nullable(),
  // Default "kie" — bugünkü ürün gerçeği (KIE.ai üzerinden Gemini 2.5 Flash).
  // Aşama 2'ye kadar bu provider STUB durumda; default user review job FAIL
  // olur (yön mesajıyla). Kullanıcı "google-gemini"ye geçebilir.
  reviewProvider: ReviewProviderChoiceSchema.default("kie"),
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
  })
  .strict();

export type StoredAiModeSettings = z.infer<typeof StoredAiModeSettingsSchema>;
