// URL Public Check — Phase 5 §4.1 (Q5)
//
// Sözleşme: pure HEAD request — pattern match YASAK; URL judgment yok.
// UA "EtsyHub/0.1"; timeout 5s; redirect follow; in-memory cache 5dk.
//
// Hata da cache'lenir (DDoS önleme): network error sonrası 5dk içinde
// aynı URL'e tekrar fetch atılmaz.

export type UrlCheckResult = {
  ok: boolean;
  status?: number;
  reason?: string;
};

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; result: UrlCheckResult }>();

export function _resetCache() {
  cache.clear();
}

export async function checkUrlPublic(url: string): Promise<UrlCheckResult> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.result;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "EtsyHub/0.1" },
      redirect: "follow",
      signal: controller.signal,
    });
    const result: UrlCheckResult = res.ok
      ? { ok: true, status: res.status }
      : { ok: false, status: res.status, reason: `HEAD ${res.status}` };
    cache.set(url, { at: Date.now(), result });
    return result;
  } catch (err) {
    const reason = (err as Error).message ?? "network error";
    const result: UrlCheckResult = { ok: false, reason };
    cache.set(url, { at: Date.now(), result });
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
