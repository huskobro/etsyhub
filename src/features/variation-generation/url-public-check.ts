// URL Public Check — Phase 5 §4.1 (Q5)
//
// Sözleşme: pure HEAD request — pattern match YASAK; URL judgment yok.
// UA "Kivasy/0.1"; timeout 5s; redirect follow; in-memory cache 5dk.
//
// Hata da cache'lenir (DDoS önleme): network error sonrası 5dk içinde
// aynı URL'e tekrar fetch atılmaz.
//
// Bound + LRU eviction (Task 11): endpoint olarak expose edildikten sonra
// unbounded büyüme DDoS-vector'üne dönüşüyor; max 1000 entry + recency-based
// eviction (insertion-ordered Map; cache hit'te delete+set ile sona taşı,
// dolu ise keys().next().value ile en eski entry'i evict et).

export type UrlCheckResult = {
  ok: boolean;
  status?: number;
  reason?: string;
};

const CACHE_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;

type CacheEntry = { at: number; result: UrlCheckResult };
const cache = new Map<string, CacheEntry>();

export function _resetCache() {
  cache.clear();
}

// Hit/miss sonrası entry'i en sona taşı (recency); doluysa en eski entry'i
// (insertion order'da Map.keys() ilk entry'i) evict et.
function lruSet(key: string, entry: CacheEntry) {
  cache.delete(key);
  cache.set(key, entry);
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export async function checkUrlPublic(url: string): Promise<UrlCheckResult> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    // Hit path: recency güncelle (LRU); TTL/result aynı kalsın.
    lruSet(url, hit);
    return hit.result;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Kivasy/0.1" },
      redirect: "follow",
      signal: controller.signal,
    });
    const result: UrlCheckResult = res.ok
      ? { ok: true, status: res.status }
      : { ok: false, status: res.status, reason: `HEAD ${res.status}` };
    lruSet(url, { at: Date.now(), result });
    return result;
  } catch (err) {
    const reason = (err as Error).message ?? "network error";
    const result: UrlCheckResult = { ok: false, reason };
    lruSet(url, { at: Date.now(), result });
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
