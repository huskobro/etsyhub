import type { EtsyProvider } from "./types";
import { etsyV3Provider } from "./client";

/**
 * Phase 9 V1 Task 4 — Etsy provider registry.
 *
 * V1: tek provider (etsy-api). İkinci provider (örn. Shopify, Printful)
 * eklemek için registry pattern hazır. Phase 6 review registry emsali.
 */

const byId = new Map<string, EtsyProvider>();

function register(provider: EtsyProvider): void {
  if (byId.has(provider.id)) {
    throw new Error(`Etsy provider already registered: "${provider.id}"`);
  }
  byId.set(provider.id, provider);
}

register(etsyV3Provider);

export function getEtsyProvider(id: string): EtsyProvider {
  const provider = byId.get(id);
  if (!provider) {
    throw new Error(`Unknown Etsy provider: "${id}"`);
  }
  return provider;
}

export function listEtsyProviders(): ReadonlyArray<EtsyProvider> {
  return Array.from(byId.values());
}

export const DEFAULT_ETSY_PROVIDER_ID = "etsy-api";
