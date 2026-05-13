/**
 * Phase 37 — creative-fabrica-listing-images service unit tests.
 *
 * Etsy service pattern mirror'ı: invalid URL → ValidationError;
 * 403/429/503 → CreativeFabricaFetchBlockedError; 500/404 →
 * CreativeFabricaFetchError; 200 + fixture HTML → success result.
 *
 * CF live sunucuya hit Cloudflare Turnstile / browser challenge ile
 * korunduğu için success path mock fetch (fixture HTML) ile, blocked
 * path mock 403 response ile kanıtlanır.
 *
 * Mock strategy: `globalThis.fetch` vitest `vi.stubGlobal` ile
 * değiştirilir; service'in import ettiği Node `fetch` aynı global'i
 * kullanır.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ValidationError } from "@/lib/errors";
import {
  fetchCreativeFabricaListingImages,
  isCreativeFabricaListingUrl,
  CreativeFabricaFetchBlockedError,
  CreativeFabricaFetchError,
} from "@/server/services/scraper/creative-fabrica-listing-images";

describe("creative-fabrica-listing-images service", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("isCreativeFabricaListingUrl", () => {
    it("kabul: www.creativefabrica.com/product/{slug}/", () => {
      expect(
        isCreativeFabricaListingUrl(
          "https://www.creativefabrica.com/product/floral-watercolor-bundle/",
        ),
      ).toBe(true);
    });
    it("kabul: creativefabrica.com/product/{slug} (no www, no trailing slash)", () => {
      expect(
        isCreativeFabricaListingUrl(
          "https://creativefabrica.com/product/some-slug",
        ),
      ).toBe(true);
    });
    it("ret: kategori sayfası (no /product/)", () => {
      expect(
        isCreativeFabricaListingUrl(
          "https://www.creativefabrica.com/category/clipart",
        ),
      ).toBe(false);
    });
    it("ret: başka domain", () => {
      expect(
        isCreativeFabricaListingUrl(
          "https://www.etsy.com/listing/1234567/foo",
        ),
      ).toBe(false);
    });
    it("ret: empty / bozuk", () => {
      expect(isCreativeFabricaListingUrl("")).toBe(false);
      expect(isCreativeFabricaListingUrl("not-a-url")).toBe(false);
    });
  });

  describe("fetchCreativeFabricaListingImages", () => {
    it("invalid URL → ValidationError", async () => {
      await expect(
        fetchCreativeFabricaListingImages(
          "https://www.creativefabrica.com/category/clipart",
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("403 → CreativeFabricaFetchBlockedError", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("blocked", { status: 403 })),
      );
      await expect(
        fetchCreativeFabricaListingImages(
          "https://www.creativefabrica.com/product/foo/",
        ),
      ).rejects.toBeInstanceOf(CreativeFabricaFetchBlockedError);
    });

    it("429 → CreativeFabricaFetchBlockedError", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("rate", { status: 429 })),
      );
      await expect(
        fetchCreativeFabricaListingImages(
          "https://www.creativefabrica.com/product/foo/",
        ),
      ).rejects.toBeInstanceOf(CreativeFabricaFetchBlockedError);
    });

    it("503 → CreativeFabricaFetchBlockedError", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("svc unavailable", { status: 503 })),
      );
      await expect(
        fetchCreativeFabricaListingImages(
          "https://www.creativefabrica.com/product/foo/",
        ),
      ).rejects.toBeInstanceOf(CreativeFabricaFetchBlockedError);
    });

    it("500 → CreativeFabricaFetchError (retried; non-blocked)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("err", { status: 500 })),
      );
      await expect(
        fetchCreativeFabricaListingImages(
          "https://www.creativefabrica.com/product/foo/",
        ),
      ).rejects.toBeInstanceOf(CreativeFabricaFetchError);
    });

    it("404 → CreativeFabricaFetchError (not blocked)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("nope", { status: 404 })),
      );
      await expect(
        fetchCreativeFabricaListingImages(
          "https://www.creativefabrica.com/product/foo/",
        ),
      ).rejects.toBeInstanceOf(CreativeFabricaFetchError);
    });

    it("200 + fixture HTML → success result with imageUrls + title", async () => {
      const html = await readFile(
        resolve(__dirname, "../fixtures/creative-fabrica-listing.html"),
        "utf8",
      );
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(html, { status: 200 })),
      );
      const out = await fetchCreativeFabricaListingImages(
        "https://www.creativefabrica.com/product/floral-watercolor-clipart-bundle/",
      );
      expect(out.externalId).toBe("floral-watercolor-clipart-bundle");
      expect(out.title).toBe("Floral Watercolor Clipart Bundle");
      expect(out.imageUrls.length).toBeGreaterThanOrEqual(3);
      expect(Array.isArray(out.warnings)).toBe(true);
    });

    it("network error → CreativeFabricaFetchError", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new TypeError("network failure");
        }),
      );
      await expect(
        fetchCreativeFabricaListingImages(
          "https://www.creativefabrica.com/product/foo/",
        ),
      ).rejects.toBeInstanceOf(CreativeFabricaFetchError);
    });
  });
});
