// Phase 9 V1 Task 4 — Etsy provider registry unit tests.

import { describe, it, expect } from "vitest";
import {
  getEtsyProvider,
  listEtsyProviders,
  DEFAULT_ETSY_PROVIDER_ID,
} from "@/providers/etsy/registry";

describe("Etsy provider registry", () => {
  it("getEtsyProvider('etsy-api') → id, apiVersion v3, capabilities mevcut", () => {
    const provider = getEtsyProvider("etsy-api");
    expect(provider.id).toBe("etsy-api");
    expect(provider.apiVersion).toBe("v3");
    expect(typeof provider.createDraftListing).toBe("function");
    expect(typeof provider.uploadListingImage).toBe("function");
  });

  it("bilinmeyen id → throw 'Unknown Etsy provider'", () => {
    expect(() => getEtsyProvider("bogus")).toThrowError(/Unknown Etsy provider/);
  });

  it("listEtsyProviders → en az 1 provider (V1: tek)", () => {
    const list = listEtsyProviders();
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe("etsy-api");
  });

  it("DEFAULT_ETSY_PROVIDER_ID === 'etsy-api'", () => {
    expect(DEFAULT_ETSY_PROVIDER_ID).toBe("etsy-api");
  });
});
