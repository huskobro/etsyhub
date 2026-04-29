import type { ReviewProvider } from "./types";
import { googleGeminiFlashReviewProvider } from "./google-gemini-flash";
import { kieGeminiFlashReviewProvider } from "./kie-gemini-flash";

/**
 * Review provider registry — R17.3 paterni.
 *
 * Hardcoded id lookup YASAK; tüm review provider erişimi `getReviewProvider`
 * üzerinden olur. Bilinmeyen id ⇒ explicit throw (sessiz fallback yok).
 * Duplicate register denemesi ⇒ explicit throw (fail-fast).
 *
 * Phase 6 Aşama 1: iki provider register edilir:
 *   - `google-gemini-flash` — direct Google Gemini API (mock-tested,
 *     canlı doğrulanmadı)
 *   - `kie-gemini-flash` — KIE.ai üzerinden Gemini (STUB; Aşama 2'de impl)
 *
 * Runtime seçim: `settings.reviewProvider` ("kie" default | "google-gemini").
 *
 * Yeni provider eklemek için:
 *   1. `src/providers/review/<id>.ts` altında `ReviewProvider` impl yaz
 *   2. import + `register(...)` satırı buraya ekle
 *   3. `tests/unit/review-provider-registry.test.ts`'e yeni id testi ekle
 */

const byId = new Map<string, ReviewProvider>();

function register(provider: ReviewProvider): void {
  if (byId.has(provider.id)) {
    throw new Error(`Review provider already registered: "${provider.id}"`);
  }
  byId.set(provider.id, provider);
}

register(googleGeminiFlashReviewProvider);
register(kieGeminiFlashReviewProvider);

export function getReviewProvider(id: string): ReviewProvider {
  const provider = byId.get(id);
  if (!provider) {
    throw new Error(`Unknown review provider: "${id}"`);
  }
  return provider;
}

export function listReviewProviders(): ReadonlyArray<ReviewProvider> {
  return Array.from(byId.values());
}
