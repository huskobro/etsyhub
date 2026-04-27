// User Settings — ai-mode — Phase 5 §8
//
// kieApiKey + geminiApiKey encrypted at rest (CLAUDE.md güvenlik kuralı).
// Service katmanı transparent encrypt/decrypt yapar; caller plain string görür.

import { z } from "zod";

export const AiModeSettingsSchema = z.object({
  kieApiKey: z.string().nullable(), // encrypted at rest in service layer
  geminiApiKey: z.string().nullable(),
});

export type AiModeSettings = z.infer<typeof AiModeSettingsSchema>;

/**
 * Persisted (stored) JSON shape parser — kullanıcının DB satırından okunan
 * raw JSON `value`'sini parse eder. Mevcut shape ile birebir aynı (kieApiKey
 * ve geminiApiKey "string|null" — encrypted ya da plain fark etmez).
 *
 * Hardening (Task 12): bilinmeyen alanlar OPSİYONEL olarak silinir;
 * tanımlı alanlar yanlış tipte gelirse PARSE FAIL — service `as` cast yerine
 * bunu çağırır (Task 11 carry-forward, asimetri kapanır). Bozuk persist
 * (örn. tip değişikliği veya elle düzenlenmiş JSON) → fail-fast throw.
 */
export const StoredAiModeSettingsSchema = z
  .object({
    kieApiKey: z.string().nullable(),
    geminiApiKey: z.string().nullable(),
  })
  .strict();

export type StoredAiModeSettings = z.infer<typeof StoredAiModeSettingsSchema>;
