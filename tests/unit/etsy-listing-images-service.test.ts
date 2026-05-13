/**
 * Phase 36 — etsy-listing-images service unit tests.
 *
 * Etsy listing page'leri Datadome WAF tarafından korunduğu için live
 * server-side fetch genelde 403 döner; bu test suite **success path**'i
 * mock fetch (fixture HTML) ile, **blocked path**'i mock 403 response
 * ile, **invalid URL**'i ValidationError ile kanıtlar.
 *
 * Mock strategy: `globalThis.fetch` vitest `vi.stubGlobal` ile değiştirilir;
 * service'in import ettiği Node `fetch` aynı global'i kullanır.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ValidationError } from "@/lib/errors";
import {
  fetchEtsyListingImages,
  isEtsyListingUrl,
  EtsyFetchBlockedError,
  EtsyFetchError,
} from "@/server/services/scraper/etsy-listing-images";

describe("etsy-listing-images service", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("isEtsyListingUrl", () => {
    it("kabul: www.etsy.com/listing/{id}/slug", () => {
      expect(
        isEtsyListingUrl(
          "https://www.etsy.com/listing/1234567/dragonfly-clipart",
        ),
      ).toBe(true);
    });
    it("kabul: etsy.com/listing/{id} (no www)", () => {
      expect(isEtsyListingUrl("https://etsy.com/listing/999")).toBe(true);
    });
    it("ret: CDN URL (etsystatic)", () => {
      expect(
        isEtsyListingUrl("https://i.etsystatic.com/.../il_1140xN.jpg"),
      ).toBe(false);
    });
    it("ret: empty / bozuk", () => {
      expect(isEtsyListingUrl("")).toBe(false);
      expect(isEtsyListingUrl("not-a-url")).toBe(false);
    });
  });

  describe("fetchEtsyListingImages", () => {
    it("invalid URL → ValidationError", async () => {
      await expect(
        fetchEtsyListingImages("https://i.etsystatic.com/foo.jpg"),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("403 → EtsyFetchBlockedError", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("blocked", { status: 403 })),
      );
      await expect(
        fetchEtsyListingImages("https://www.etsy.com/listing/1234567/foo"),
      ).rejects.toBeInstanceOf(EtsyFetchBlockedError);
    });

    it("429 → EtsyFetchBlockedError", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("rate", { status: 429 })),
      );
      await expect(
        fetchEtsyListingImages("https://www.etsy.com/listing/1234567/foo"),
      ).rejects.toBeInstanceOf(EtsyFetchBlockedError);
    });

    it("500 → EtsyFetchError (retried; non-blocked)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("err", { status: 500 })),
      );
      await expect(
        fetchEtsyListingImages("https://www.etsy.com/listing/1234567/foo"),
      ).rejects.toBeInstanceOf(EtsyFetchError);
    });

    it("404 → EtsyFetchError (not blocked)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("nope", { status: 404 })),
      );
      await expect(
        fetchEtsyListingImages("https://www.etsy.com/listing/1234567/foo"),
      ).rejects.toBeInstanceOf(EtsyFetchError);
    });

    it("200 + fixture HTML → success result with imageUrls + title", async () => {
      const html = await readFile(
        resolve(__dirname, "../fixtures/etsy-listing.html"),
        "utf8",
      );
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(html, { status: 200 })),
      );
      const out = await fetchEtsyListingImages(
        "https://www.etsy.com/listing/1234567890/example",
      );
      expect(out.externalId).toBe("1234567890");
      expect(out.title).toBeTruthy();
      expect(out.imageUrls.length).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(out.warnings)).toBe(true);
    });

    it("network error → EtsyFetchError", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new TypeError("network failure");
        }),
      );
      await expect(
        fetchEtsyListingImages("https://www.etsy.com/listing/1234567/foo"),
      ).rejects.toBeInstanceOf(EtsyFetchError);
    });
  });
});
