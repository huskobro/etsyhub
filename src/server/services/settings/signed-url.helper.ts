// R9 — Storage signed URL wrapper that respects user prefs.
//
// `getStorage().signedUrl(key, ttl)` çağrılarını user-aware bir helper
// üzerinden geçirir. Caller `userId` verirse user'ın storage prefs'i
// (UserSetting key="storage" → signedUrlTtlSeconds) okunur; yoksa
// default 3600s.
//
// Performance: per-request UserSetting fetch hot path'te yapılmaz —
// kısa süreli (60s) in-memory cache.

import { getStorage } from "@/providers/storage";
import { logger } from "@/lib/logger";
import { getStoragePrefs } from "./storage-prefs.service";

const PREFS_CACHE_MS = 60 * 1000;
const DEFAULT_TTL = 3600;

interface PrefsCacheEntry {
  ttl: number;
  expiresAt: number;
}

const prefsCache = new Map<string, PrefsCacheEntry>();

export async function userSignedUrl(input: {
  userId: string;
  key: string;
  /** Override — caller bilinçli olarak kısa/uzun TTL istiyorsa. */
  overrideTtlSeconds?: number;
}): Promise<string> {
  const ttl =
    input.overrideTtlSeconds ?? (await resolveTtlForUser(input.userId));
  const storage = getStorage();
  return storage.signedUrl(input.key, ttl);
}

export async function resolveTtlForUser(userId: string): Promise<number> {
  const cached = prefsCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.ttl;
  try {
    const prefs = await getStoragePrefs(userId);
    prefsCache.set(userId, {
      ttl: prefs.signedUrlTtlSeconds,
      expiresAt: Date.now() + PREFS_CACHE_MS,
    });
    return prefs.signedUrlTtlSeconds;
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, userId },
      "storage prefs lookup failed; default TTL",
    );
    return DEFAULT_TTL;
  }
}

/**
 * R9 — User prefs cache invalidation. Storage settings PUT route'u bunu
 * çağırarak yeni TTL'i bir sonraki signed URL üretiminde okutur.
 */
export function invalidateUserSignedUrlPrefs(userId: string): void {
  prefsCache.delete(userId);
}
