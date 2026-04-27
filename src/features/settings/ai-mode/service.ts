// User Settings — ai-mode — Phase 5 §8
//
// kieApiKey + geminiApiKey encrypted at rest (CLAUDE.md güvenlik kuralı).
// Service katmanı transparent encrypt/decrypt yapar; caller plain string görür.
// UserSetting tablosu key="aiMode" altında { kieApiKey: cipher, geminiApiKey: cipher } tutar.
//
// NOT: requireApiKey() (kie-shared) hâlâ process.env.KIE_AI_API_KEY okuyor —
// runtime provider env→setting geçişi sonraki task'te. Bu modül yalnız
// persistence zemini.

import { db } from "@/server/db";
import { encryptSecret, decryptSecret } from "@/lib/secrets";
import { AiModeSettingsSchema, type AiModeSettings } from "./schemas";

const SETTING_KEY = "aiMode";

export async function getUserAiModeSettings(userId: string): Promise<AiModeSettings> {
  const row = await db.userSetting.findUnique({
    where: { userId_key: { userId, key: SETTING_KEY } },
  });
  if (!row) return { kieApiKey: null, geminiApiKey: null };
  const raw = row.value as { kieApiKey?: string | null; geminiApiKey?: string | null };
  return {
    kieApiKey: raw.kieApiKey ? decryptSecret(raw.kieApiKey) : null,
    geminiApiKey: raw.geminiApiKey ? decryptSecret(raw.geminiApiKey) : null,
  };
}

export async function updateUserAiModeSettings(
  userId: string,
  input: AiModeSettings,
): Promise<AiModeSettings> {
  const parsed = AiModeSettingsSchema.parse(input);
  const encrypted = {
    kieApiKey: parsed.kieApiKey ? encryptSecret(parsed.kieApiKey) : null,
    geminiApiKey: parsed.geminiApiKey ? encryptSecret(parsed.geminiApiKey) : null,
  };
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: encrypted },
    create: { userId, key: SETTING_KEY, value: encrypted },
  });
  return parsed;
}
