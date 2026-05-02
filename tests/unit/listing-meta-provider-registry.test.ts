import { describe, it, expect } from "vitest";
import {
  getListingMetaAIProvider,
  listListingMetaAIProviders,
  DEFAULT_LISTING_META_PROVIDER_ID,
} from "@/providers/listing-meta-ai/registry";

/**
 * Phase 9 V1 Task 5 — Listing-meta provider registry tests.
 * Phase 6 review-provider-registry.test.ts emsali.
 */

describe("Listing-meta provider registry", () => {
  it("'kie-gemini-flash' provider döner + modelId/kind doğru", () => {
    const provider = getListingMetaAIProvider("kie-gemini-flash");
    expect(provider.id).toBe("kie-gemini-flash");
    expect(provider.modelId).toBe("gemini-2.5-flash");
    expect(provider.kind).toBe("text");
    expect(typeof provider.generate).toBe("function");
  });

  it("bilinmeyen id'de explicit throw (sessiz fallback yok)", () => {
    expect(() => getListingMetaAIProvider("nonexistent-id")).toThrow(
      /unknown listing-meta ai provider: "nonexistent-id"/i,
    );
    expect(() => getListingMetaAIProvider("")).toThrow(/unknown listing-meta ai provider/i);
  });

  it("listListingMetaAIProviders V1'de 1 provider döndürür", () => {
    const providers = listListingMetaAIProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0]?.id).toBe("kie-gemini-flash");
    for (const p of providers) {
      expect(p.kind).toBe("text");
      expect(typeof p.generate).toBe("function");
    }
  });

  it("DEFAULT_LISTING_META_PROVIDER_ID === 'kie-gemini-flash'", () => {
    expect(DEFAULT_LISTING_META_PROVIDER_ID).toBe("kie-gemini-flash");
  });

  it("provider api key olmadan çağrılırsa explicit throw", async () => {
    const provider = getListingMetaAIProvider("kie-gemini-flash");
    await expect(
      provider.generate(
        {
          productType: "wall_art",
          currentTitle: null,
          currentDescription: null,
          currentTags: [],
          category: null,
          materials: [],
        },
        { apiKey: "" },
      ),
    ).rejects.toThrow(/api key missing/i);
  });
});
