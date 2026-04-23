import { db } from "@/server/db";
import { encryptSecret, decryptSecret } from "@/lib/secrets";
import type { ScraperProviderName } from "./types";

export type ProviderConfig = {
  active: ScraperProviderName;
  apifyToken: string | null; // null = not configured
  firecrawlToken: string | null;
};

const ACTIVE_PROVIDER_KEY = "scraper.active_provider";
const APIFY_KEY_FLAG = "scraper.apify.api_key";
const FIRECRAWL_KEY_FLAG = "scraper.firecrawl.api_key";

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

export async function setActiveProvider(provider: ScraperProviderName): Promise<void> {
  await db.featureFlag.upsert({
    where: { key: ACTIVE_PROVIDER_KEY },
    create: { key: ACTIVE_PROVIDER_KEY, enabled: true, metadata: { provider } },
    update: { metadata: { provider }, enabled: true },
  });
}

export async function setApifyToken(plainToken: string | null): Promise<void> {
  await writeTokenFlag(APIFY_KEY_FLAG, plainToken);
}

export async function setFirecrawlToken(plainToken: string | null): Promise<void> {
  await writeTokenFlag(FIRECRAWL_KEY_FLAG, plainToken);
}

async function writeTokenFlag(key: string, plainToken: string | null): Promise<void> {
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
