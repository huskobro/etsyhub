// R8 — Scrapers pane settings (UserSetting key="scrapers", encrypted).
//
// Apify + Firecrawl token + rate-limit ayarı. ai-mode service'i ile
// aynı encryption pattern (cipher at rest, plain in memory).

import { z } from "zod";
import { db } from "@/server/db";
import { encryptSecret, decryptSecret } from "@/lib/secrets";
import { logger } from "@/lib/logger";

const SETTING_KEY = "scrapers";

export const ScrapersSettingsSchema = z.object({
  apifyToken: z.string().nullable().default(null),
  firecrawlToken: z.string().nullable().default(null),
  /** Maksimum eş zamanlı scrape isteği (workspace-wide hint). */
  maxConcurrency: z.number().int().min(1).max(10).default(2),
  /** Saat başına global scrape rate limit (politeness). */
  hourlyRateLimit: z.number().int().min(10).max(2000).default(200),
});

const StoredScrapersSchema = z.object({
  apifyToken: z.string().nullable().default(null),
  firecrawlToken: z.string().nullable().default(null),
  maxConcurrency: z.number().default(2),
  hourlyRateLimit: z.number().default(200),
});

export type ScrapersSettings = z.infer<typeof ScrapersSettingsSchema>;

const DEFAULTS: ScrapersSettings = {
  apifyToken: null,
  firecrawlToken: null,
  maxConcurrency: 2,
  hourlyRateLimit: 200,
};

function safeDecrypt(cipher: string | null, field: string): string | null {
  if (!cipher) return null;
  try {
    return decryptSecret(cipher);
  } catch (err) {
    logger.warn(
      { field, err: (err as Error).message },
      "scrapers secret decrypt failed",
    );
    return null;
  }
}

export async function getScrapersSettings(
  userId: string,
): Promise<ScrapersSettings> {
  const row = await db.userSetting.findUnique({
    where: { userId_key: { userId, key: SETTING_KEY } },
  });
  if (!row) return DEFAULTS;
  const parsed = StoredScrapersSchema.safeParse(row.value);
  if (!parsed.success) return DEFAULTS;
  return {
    apifyToken: safeDecrypt(parsed.data.apifyToken, "apifyToken"),
    firecrawlToken: safeDecrypt(parsed.data.firecrawlToken, "firecrawlToken"),
    maxConcurrency: parsed.data.maxConcurrency,
    hourlyRateLimit: parsed.data.hourlyRateLimit,
  };
}

/**
 * Kısmi update. Boş string sentinel = "değiştirme" (mevcut değer korunur).
 * null = "tokeni temizle".
 */
export async function updateScrapersSettings(
  userId: string,
  input: Partial<{
    apifyToken: string | null;
    firecrawlToken: string | null;
    maxConcurrency: number;
    hourlyRateLimit: number;
  }>,
): Promise<ScrapersSettings> {
  const current = await getScrapersSettings(userId);
  const next: ScrapersSettings = {
    apifyToken:
      input.apifyToken === undefined
        ? current.apifyToken
        : input.apifyToken,
    firecrawlToken:
      input.firecrawlToken === undefined
        ? current.firecrawlToken
        : input.firecrawlToken,
    maxConcurrency: input.maxConcurrency ?? current.maxConcurrency,
    hourlyRateLimit: input.hourlyRateLimit ?? current.hourlyRateLimit,
  };
  ScrapersSettingsSchema.parse(next);
  const persisted = {
    apifyToken: next.apifyToken ? encryptSecret(next.apifyToken) : null,
    firecrawlToken: next.firecrawlToken
      ? encryptSecret(next.firecrawlToken)
      : null,
    maxConcurrency: next.maxConcurrency,
    hourlyRateLimit: next.hourlyRateLimit,
  };
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: persisted },
    create: { userId, key: SETTING_KEY, value: persisted },
  });
  return next;
}
