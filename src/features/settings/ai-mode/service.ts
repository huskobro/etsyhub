// User Settings — ai-mode — Phase 5 §8 + Phase 6 Aşama 1
//
// kieApiKey + geminiApiKey encrypted at rest (CLAUDE.md güvenlik kuralı).
// Service katmanı transparent encrypt/decrypt yapar; caller plain string görür.
// UserSetting tablosu key="aiMode" altında { kieApiKey: cipher,
// geminiApiKey: cipher, reviewProvider: "kie"|"google-gemini" } tutar.
//
// Phase 6 Aşama 1: `reviewProvider` plain string yazılır (encryption gereksiz
// — sır değil, runtime tercih). Default "kie" — Zod parse fallback.
//
// NOT: requireApiKey() (kie-shared) hâlâ process.env.KIE_AI_API_KEY okuyor —
// runtime provider env→setting geçişi sonraki task'te. Bu modül yalnız
// persistence zemini.

import { db } from "@/server/db";
import { encryptSecret, decryptSecret } from "@/lib/secrets";
import {
  AiModeSettingsSchema,
  StoredAiModeSettingsSchema,
  type AiModeSettings,
} from "./schemas";

const SETTING_KEY = "aiMode";

export async function getUserAiModeSettings(userId: string): Promise<AiModeSettings> {
  const row = await db.userSetting.findUnique({
    where: { userId_key: { userId, key: SETTING_KEY } },
  });
  if (!row) {
    // Hiç row yoksa default'lar — reviewProvider Zod default "kie".
    return { kieApiKey: null, geminiApiKey: null, reviewProvider: "kie" };
  }
  // Task 12: parse asimetri kapatılıyor — `as` cast yerine zod parse.
  // Bozuk persist (yanlış tip / bilinmeyen alan) → fail-fast throw.
  // Aşama 1: reviewProvider field'ı eski row'larda yoksa Zod default "kie".
  const raw = StoredAiModeSettingsSchema.parse(row.value);
  return {
    kieApiKey: raw.kieApiKey ? decryptSecret(raw.kieApiKey) : null,
    geminiApiKey: raw.geminiApiKey ? decryptSecret(raw.geminiApiKey) : null,
    reviewProvider: raw.reviewProvider,
  };
}

export async function updateUserAiModeSettings(
  userId: string,
  input: AiModeSettings,
): Promise<AiModeSettings> {
  const parsed = AiModeSettingsSchema.parse(input);
  const persisted = {
    kieApiKey: parsed.kieApiKey ? encryptSecret(parsed.kieApiKey) : null,
    geminiApiKey: parsed.geminiApiKey ? encryptSecret(parsed.geminiApiKey) : null,
    // reviewProvider sır değil; plain string olarak tutulur.
    reviewProvider: parsed.reviewProvider,
  };
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: persisted },
    create: { userId, key: SETTING_KEY, value: persisted },
  });
  return parsed;
}
