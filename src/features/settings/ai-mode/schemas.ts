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
