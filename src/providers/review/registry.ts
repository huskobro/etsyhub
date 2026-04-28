import type { ReviewProvider } from "./types";
import { geminiFlashReviewProvider } from "./gemini-2-5-flash";

/**
 * Review provider registry — R17.3 paterni.
 *
 * Hardcoded id lookup YASAK; tüm review provider erişimi `getReviewProvider`
 * üzerinden olur. Bilinmeyen id ⇒ explicit throw (sessiz fallback yok).
 * Duplicate register denemesi ⇒ explicit throw (fail-fast).
 *
 * Yeni provider eklemek için:
 *   1. `src/providers/review/<id>.ts` altında `ReviewProvider` impl yaz
 *   2. import + `register(...)` satırı buraya ekle
 *   3. `tests/unit/review-provider-registry.test.ts`'e yeni id testi ekle
 */

const byId = new Map<string, ReviewProvider>();

function register(provider: ReviewProvider): void {
  if (byId.has(provider.id)) {
    throw new Error(`review provider already registered: ${provider.id}`);
  }
  byId.set(provider.id, provider);
}

register(geminiFlashReviewProvider);

export function getReviewProvider(id: string): ReviewProvider {
  const provider = byId.get(id);
  if (!provider) {
    throw new Error(`unknown review provider: ${id}`);
  }
  return provider;
}

export function listReviewProviders(): ReviewProvider[] {
  return Array.from(byId.values());
}
