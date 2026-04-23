import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEtsyListing } from "@/providers/scraper/parsers/etsy-parser";

describe("etsy parser", () => {
  it("fixture HTML'den listing alanlarını çıkarır", async () => {
    const html = await readFile(
      resolve(__dirname, "../fixtures/etsy-listing.html"),
      "utf8"
    );
    const result = parseEtsyListing(
      html,
      "https://www.etsy.com/listing/1234567890/example-item"
    );
    expect(result.externalId).toBe("1234567890");
    expect(result.title).toBeTruthy();
    expect(result.imageUrls.length).toBeGreaterThanOrEqual(1);
    expect(result.reviewCount).toBe(142);
    expect(result.priceCents).toBe(2499);
    expect(result.currency).toBe("USD");
    // parser debug fields
    expect(result.parserSource).toBe("json-ld");
    expect(result.parserConfidence).toBeGreaterThanOrEqual(80);
    expect(Array.isArray(result.parseWarnings)).toBe(true);
    // tarih alanları
    expect(result.listingCreatedAt).toBeInstanceOf(Date);
    expect(result.latestReviewAt).toBeNull();
  });

  it("bozuk HTML'de minimum bilgi döner, boş imageUrls kabul edilir", () => {
    const result = parseEtsyListing(
      "<html></html>",
      "https://www.etsy.com/listing/999/x"
    );
    expect(result.externalId).toBe("999");
    expect(result.imageUrls).toEqual([]);
    expect(result.title).toBe("");
    // bozuk HTML'de fallback parserSource beklenir
    expect(result.parserSource).toBe("fallback");
    expect(result.parserConfidence).toBeLessThanOrEqual(30);
    expect(result.parseWarnings.length).toBeGreaterThan(0);
    // tarih alanları null olmalı
    expect(result.listingCreatedAt).toBeNull();
    expect(result.latestReviewAt).toBeNull();
  });

  it("URL'de listing id yoksa externalId boş döner ve uyarı ekler", () => {
    const result = parseEtsyListing(
      "<html></html>",
      "https://www.etsy.com/shop/foo"
    );
    expect(result.externalId).toBe("");
    expect(
      result.parseWarnings.some((w) =>
        w.includes("External ID URL'den çıkarılamadı")
      )
    ).toBe(true);
  });
});
