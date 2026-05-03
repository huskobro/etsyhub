/**
 * Phase 9 V1 — Etsy taxonomy mapping foundation.
 *
 * Etsy V3 listing create endpoint zorunlu `taxonomy_id` (numeric) ister.
 * Bu ID'ler `developer.etsy.com` `/seller-taxonomy/nodes` endpoint'inden
 * elle çıkarılır (örn. "Wall Art" ≈ 2078, "Stickers" ≈ 2078 alt-node, vb.
 * Etsy bu ID'leri canlıda yayınlar; production app onları discovery çağrısıyla
 * kendi DB'sine cache'lemelidir).
 *
 * V1 foundation: env'den JSON map okur. Admin .env.local'e koyar:
 *
 *   ETSY_TAXONOMY_MAP_JSON='{"wall_art":2078,"sticker":1208,"clipart":1207}'
 *
 * Eksik key → EtsyTaxonomyMissingError (422 honest fail).
 * Geçersiz JSON → EtsyTaxonomyConfigError (503 sistem yöneticisi sorumlu).
 *
 * V1.1+ carry-forward:
 *   - Admin UI ile ProductType.etsyTaxonomyId Int? schema field
 *   - Etsy V3 /seller-taxonomy/nodes discovery + DB cache
 *   - Locale-aware taxonomy (US vs UK Etsy farklı node tree)
 */

import { AppError } from "@/lib/errors";

export class EtsyTaxonomyConfigError extends AppError {
  constructor(message: string) {
    super(
      `Etsy taxonomy mapping yapılandırması bozuk: ${message}`,
      "ETSY_TAXONOMY_CONFIG",
      503,
    );
  }
}

export class EtsyTaxonomyMissingError extends AppError {
  constructor(productTypeKey: string) {
    super(
      `Etsy taxonomy mapping bulunamadı: "${productTypeKey}". Sistem yöneticisinin ETSY_TAXONOMY_MAP_JSON env değişkenine bu ürün tipini eklemesi gerek.`,
      "ETSY_TAXONOMY_MISSING",
      422,
      { productTypeKey },
    );
  }
}

let cachedMap: Record<string, number> | null = null;
let cachedRaw: string | null = null;

/**
 * Test reset helper — vitest beforeEach `resetTaxonomyCache()` çağırarak
 * env değişikliklerini görünür kılar.
 */
export function resetTaxonomyCache(): void {
  cachedMap = null;
  cachedRaw = null;
}

/**
 * Env'den JSON parse + cache. ENV yoksa boş map (lookup MissingError fırlatır).
 * Bozuk JSON → ConfigError.
 */
function loadTaxonomyMap(): Record<string, number> {
  const raw = process.env.ETSY_TAXONOMY_MAP_JSON;

  // Cache hit (raw değişmediyse)
  if (raw === cachedRaw && cachedMap !== null) {
    return cachedMap;
  }

  cachedRaw = raw ?? null;

  if (!raw || raw.trim() === "") {
    cachedMap = {};
    return cachedMap;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new EtsyTaxonomyConfigError(
      `JSON parse hatası: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new EtsyTaxonomyConfigError(
      "ETSY_TAXONOMY_MAP_JSON bir object olmalı (key=ProductType.key, value=numeric Etsy taxonomy_id)",
    );
  }

  const map: Record<string, number> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      throw new EtsyTaxonomyConfigError(
        `"${key}" için geçersiz taxonomy_id: ${JSON.stringify(value)} (pozitif tam sayı olmalı)`,
      );
    }
    map[key] = value;
  }

  cachedMap = map;
  return map;
}

/**
 * ProductType key'inden Etsy taxonomy_id resolve eder.
 * - key null/undefined → MissingError (caller önce listing.productType yoksa
 *   ne yapacağını karar versin — varsayılan: V1 listing.productTypeId null
 *   olabilir, o zaman category string'inden fallback)
 * - mapping yok → MissingError 422
 *
 * Caller pattern (submit service):
 *   const ptKey = listing.productType?.key ?? listing.category ?? null;
 *   if (!ptKey) throw new EtsyTaxonomyMissingError("(category yok)");
 *   const taxonomyId = resolveEtsyTaxonomyId(ptKey);
 */
export function resolveEtsyTaxonomyId(productTypeKey: string): number {
  const map = loadTaxonomyMap();
  const id = map[productTypeKey];
  if (id === undefined) {
    throw new EtsyTaxonomyMissingError(productTypeKey);
  }
  return id;
}

/**
 * Non-throw lookup — UI/diagnostic için.
 * Mapping yok → null; bozuk JSON → null (silent; gerçek error path resolve'a kalır).
 */
export function tryResolveEtsyTaxonomyId(productTypeKey: string): number | null {
  try {
    return resolveEtsyTaxonomyId(productTypeKey);
  } catch {
    return null;
  }
}
