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
// Phase 5 closeout hotfix (2026-04-29): KIE image provider artık
// settings-aware — `kie-shared.requireApiKey()` env helper'ı SİLİNDİ ve
// `createVariationJobs` (+ retry route) bu modülden `kieApiKey` resolve
// edip enqueue payload'una koyar. Phase 6 review provider'ıyla simetrik;
// artık AI mode variation generation per-user key kullanır.

import type { z } from "zod";
import { db } from "@/server/db";
import { encryptSecret, decryptSecret } from "@/lib/secrets";
import { logger } from "@/lib/logger";
import {
  AiModeSettingsSchema,
  StoredAiModeSettingsSchema,
  type AiModeSettings,
} from "./schemas";

const SETTING_KEY = "aiMode";

/**
 * Cipher format/key mismatch fail-safe: SECRETS_ENCRYPTION_KEY rotasyonu veya
 * elle düzenlenmiş bozuk persist sonrası decrypt fail oluyorsa, kullanıcının
 * UI'da kalıcı 500 görmemesi için null fallback. Schema OK ama cipher decrypt
 * fail = recoverable case (kullanıcı yeni key girip üzerine yazabilir). Schema
 * corruption (parse fail) ise fail-fast bırakılır (sysadmin müdahale).
 */
function safeDecrypt(cipher: string | null, field: string): string | null {
  if (!cipher) return null;
  try {
    return decryptSecret(cipher);
  } catch (err) {
    logger.warn(
      { field, err: (err as Error).message },
      "ai-mode secret decrypt failed; returning null fallback (key rotation veya bozuk cipher)",
    );
    return null;
  }
}

export async function getUserAiModeSettings(userId: string): Promise<AiModeSettings> {
  const row = await db.userSetting.findUnique({
    where: { userId_key: { userId, key: SETTING_KEY } },
  });
  if (!row) {
    // Hiç row yoksa default'lar — reviewProvider Zod default "kie",
    // defaultImageProvider Zod default "midjourney" (Phase 7).
    return {
      kieApiKey: null,
      geminiApiKey: null,
      reviewProvider: "kie",
      defaultImageProvider: "midjourney",
    };
  }
  // Task 12: parse asimetri kapatılıyor — `as` cast yerine zod parse.
  // Bozuk persist (yanlış tip / bilinmeyen alan) → fail-fast throw.
  // Aşama 1: reviewProvider field'ı eski row'larda yoksa Zod default "kie".
  // Phase 7: defaultImageProvider field'ı eski row'larda yoksa default
  // "midjourney" — backwards compat, migration yok.
  const raw = StoredAiModeSettingsSchema.parse(row.value);
  return {
    kieApiKey: safeDecrypt(raw.kieApiKey, "kieApiKey"),
    geminiApiKey: safeDecrypt(raw.geminiApiKey, "geminiApiKey"),
    reviewProvider: raw.reviewProvider,
    defaultImageProvider: raw.defaultImageProvider,
  };
}

export async function updateUserAiModeSettings(
  userId: string,
  input: z.input<typeof AiModeSettingsSchema>,
): Promise<AiModeSettings> {
  const parsed = AiModeSettingsSchema.parse(input);
  const persisted = {
    kieApiKey: parsed.kieApiKey ? encryptSecret(parsed.kieApiKey) : null,
    geminiApiKey: parsed.geminiApiKey ? encryptSecret(parsed.geminiApiKey) : null,
    // reviewProvider sır değil; plain string olarak tutulur.
    reviewProvider: parsed.reviewProvider,
    // Phase 7 — defaultImageProvider plain enum; sır değil.
    defaultImageProvider: parsed.defaultImageProvider,
  };
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: persisted },
    create: { userId, key: SETTING_KEY, value: persisted },
  });
  return parsed;
}
