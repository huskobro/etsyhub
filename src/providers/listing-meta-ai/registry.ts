import type { ListingMetaAIProvider } from "./types";
import { kieGeminiFlashListingMetaProvider } from "./kie-gemini-flash";

/**
 * Listing-meta AI provider registry — Phase 9 V1 Task 5.
 *
 * V1: tek provider (kie-gemini-flash). İkinci provider eklemek için:
 *   1. src/providers/listing-meta-ai/<id>.ts altında impl yaz
 *   2. import + register satırı ekle
 *   3. tests/unit/listing-meta-provider-registry.test.ts'e id testi ekle
 *
 * Phase 6 review registry pattern'ı (src/providers/review/registry.ts).
 */

const byId = new Map<string, ListingMetaAIProvider>();

function register(provider: ListingMetaAIProvider): void {
  if (byId.has(provider.id)) {
    throw new Error(`Listing-meta AI provider already registered: "${provider.id}"`);
  }
  byId.set(provider.id, provider);
}

register(kieGeminiFlashListingMetaProvider);

export function getListingMetaAIProvider(id: string): ListingMetaAIProvider {
  const provider = byId.get(id);
  if (!provider) {
    throw new Error(`Unknown listing-meta AI provider: "${id}"`);
  }
  return provider;
}

export function listListingMetaAIProviders(): ReadonlyArray<ListingMetaAIProvider> {
  return Array.from(byId.values());
}

/**
 * V1 default provider id — settings'e provider seçim alanı eklenene kadar
 * (V1.1 carry-forward) tek nokta.
 */
export const DEFAULT_LISTING_META_PROVIDER_ID = "kie-gemini-flash";
