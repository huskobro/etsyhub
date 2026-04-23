import { db } from "@/server/db";
import { encryptSecret, decryptSecret } from "@/lib/secrets";
import type { ScraperProviderName } from "./types";

/**
 * Scraper provider isimlerinin tek kaynağı (factory + admin UI + testler import eder).
 * Enum çıplak string olarak başka yerde yeniden tanımlanmasın.
 */
export const SCRAPER_PROVIDER_NAMES = [
  "self-hosted",
  "apify",
  "firecrawl",
] as const satisfies readonly ScraperProviderName[];

export type ProviderConfig = {
  active: ScraperProviderName;
  apifyToken: string | null; // null = not configured
  firecrawlToken: string | null;
};

/**
 * Admin UI'a dönük maskelenmiş config — plain API key ASLA dönmez.
 * Yalnızca "var/yok" bilgisi taşınır.
 */
export type ScraperConfigView = {
  activeProvider: ScraperProviderName;
  hasApifyKey: boolean;
  hasFirecrawlKey: boolean;
};

export type ScraperConfigUpdate = {
  activeProvider?: ScraperProviderName;
  apiKeys?: {
    apify?: string | null; // string = encrypt+kaydet, null = sil, undefined = dokunma
    firecrawl?: string | null;
  };
};

const ACTIVE_PROVIDER_KEY = "scraper.active_provider";
const APIFY_KEY_FLAG = "scraper.apify.api_key";
const FIRECRAWL_KEY_FLAG = "scraper.firecrawl.api_key";

// --- Internal (factory tarafından kullanılır — plain token decrypt edilir) ---

export async function getActiveProviderConfig(): Promise<ProviderConfig> {
  const [activeFlag, apifyFlag, firecrawlFlag] = await Promise.all([
    db.featureFlag.findUnique({ where: { key: ACTIVE_PROVIDER_KEY } }),
    db.featureFlag.findUnique({ where: { key: APIFY_KEY_FLAG } }),
    db.featureFlag.findUnique({ where: { key: FIRECRAWL_KEY_FLAG } }),
  ]);

  const active = readProvider(activeFlag?.metadata) ?? "self-hosted";
  return {
    active,
    apifyToken: readEncryptedToken(apifyFlag?.metadata),
    firecrawlToken: readEncryptedToken(firecrawlFlag?.metadata),
  };
}

export async function setActiveProvider(
  provider: ScraperProviderName,
): Promise<void> {
  await db.featureFlag.upsert({
    where: { key: ACTIVE_PROVIDER_KEY },
    create: {
      key: ACTIVE_PROVIDER_KEY,
      enabled: true,
      metadata: { provider },
    },
    update: { metadata: { provider }, enabled: true },
  });
}

export async function setApifyToken(plainToken: string | null): Promise<void> {
  await writeTokenFlag(APIFY_KEY_FLAG, plainToken);
}

export async function setFirecrawlToken(
  plainToken: string | null,
): Promise<void> {
  await writeTokenFlag(FIRECRAWL_KEY_FLAG, plainToken);
}

// --- Admin-facing abstraction (UI, API route, worker hepsi bunu kullanır) ---

/**
 * Admin UI / API için maskelenmiş config.
 * Plain API key dönmez; sadece `hasXKey: boolean` şeklinde varlık bilgisi.
 */
export async function getScraperConfig(): Promise<ScraperConfigView> {
  const internal = await getActiveProviderConfig();
  return {
    activeProvider: internal.active,
    hasApifyKey: internal.apifyToken !== null,
    hasFirecrawlKey: internal.firecrawlToken !== null,
  };
}

/**
 * Partial update semantiği:
 *  - `undefined` → dokunma
 *  - `null`      → ilgili key'i sil (flag satırı silinir)
 *  - `string`    → encrypt edilip kaydedilir (upsert)
 * Factory/worker/UI bu fonksiyonu çağırır; direkt `db.featureFlag`'a dokunmaz.
 */
export async function updateScraperConfig(
  update: ScraperConfigUpdate,
): Promise<void> {
  if (update.activeProvider !== undefined) {
    await setActiveProvider(update.activeProvider);
  }
  if (update.apiKeys) {
    if (update.apiKeys.apify !== undefined) {
      await setApifyToken(update.apiKeys.apify);
    }
    if (update.apiKeys.firecrawl !== undefined) {
      await setFirecrawlToken(update.apiKeys.firecrawl);
    }
  }
}

// --- Helpers ---

async function writeTokenFlag(
  key: string,
  plainToken: string | null,
): Promise<void> {
  if (plainToken === null) {
    await db.featureFlag.deleteMany({ where: { key } });
    return;
  }
  const encrypted = encryptSecret(plainToken);
  await db.featureFlag.upsert({
    where: { key },
    create: { key, enabled: true, metadata: { encrypted } },
    update: { metadata: { encrypted }, enabled: true },
  });
}

function readProvider(metadata: unknown): ScraperProviderName | null {
  if (!metadata || typeof metadata !== "object") return null;
  const v = (metadata as { provider?: unknown }).provider;
  if (v === "apify" || v === "firecrawl" || v === "self-hosted") return v;
  return null;
}

function readEncryptedToken(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const v = (metadata as { encrypted?: unknown }).encrypted;
  if (typeof v !== "string" || v.length === 0) return null;
  try {
    return decryptSecret(v);
  } catch {
    return null;
  }
}
