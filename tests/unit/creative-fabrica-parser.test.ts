/**
 * Phase 37 — creative-fabrica-parser unit tests.
 *
 * Etsy parser test pattern'ine paralel: fixture HTML, bozuk HTML, URL'de
 * product slug yoksa externalId boş + warning. CF parser yalnız
 * imageUrls/title/externalId döndürür (Etsy parser'ın aksine price/
 * review alanları yok — CF intake için yeterli).
 */

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseCreativeFabricaListing } from "@/providers/scraper/parsers/creative-fabrica-parser";

describe("creative-fabrica parser", () => {
  it("fixture HTML'den product alanlarını çıkarır", async () => {
    const html = await readFile(
      resolve(__dirname, "../fixtures/creative-fabrica-listing.html"),
      "utf8",
    );
    const result = parseCreativeFabricaListing(
      html,
      "https://www.creativefabrica.com/product/floral-watercolor-clipart-bundle/",
    );
    expect(result.externalId).toBe("floral-watercolor-clipart-bundle");
    expect(result.title).toBe("Floral Watercolor Clipart Bundle");
    // JSON-LD 3 images + OG 1 + twitter 1 + DOM gallery 2 (dedup): 6+
    expect(result.imageUrls.length).toBeGreaterThanOrEqual(3);
    // JSON-LD listed first
    expect(result.imageUrls[0]).toContain("preview-1.jpg");
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("bozuk HTML'de externalId URL'den çıkar, imageUrls boş + warning", () => {
    const result = parseCreativeFabricaListing(
      "<html></html>",
      "https://www.creativefabrica.com/product/some-slug/",
    );
    expect(result.externalId).toBe("some-slug");
    expect(result.imageUrls).toEqual([]);
    // No images warning kayıtlı olmalı
    expect(
      result.warnings.some((w) => w.toLowerCase().includes("görsel")),
    ).toBe(true);
  });

  it("URL'de product slug yoksa externalId boş + warning", () => {
    const result = parseCreativeFabricaListing(
      "<html></html>",
      "https://www.creativefabrica.com/category/clipart",
    );
    expect(result.externalId).toBe("");
    expect(
      result.warnings.some((w) => w.toLowerCase().includes("slug")),
    ).toBe(true);
  });

  it("yalnız OG meta varsa primary image OG'dan gelir", () => {
    const html = `
<html>
<head>
<meta property="og:title" content="OG Only Product">
<meta property="og:image" content="https://www.creativefabrica.com/wp-content/og-only.jpg">
</head>
<body></body>
</html>`;
    const result = parseCreativeFabricaListing(
      html,
      "https://www.creativefabrica.com/product/og-only-product/",
    );
    expect(result.title).toBe("OG Only Product");
    expect(result.imageUrls).toContain(
      "https://www.creativefabrica.com/wp-content/og-only.jpg",
    );
  });

  it("imageUrls deduplicated when JSON-LD + OG point at same URL", () => {
    const sameUrl =
      "https://www.creativefabrica.com/wp-content/uploads/2024/01/same.jpg";
    const html = `
<html>
<head>
<meta property="og:image" content="${sameUrl}">
<script type="application/ld+json">
{"@type":"Product","name":"Dedup test","image":["${sameUrl}"]}
</script>
</head>
<body></body>
</html>`;
    const result = parseCreativeFabricaListing(
      html,
      "https://www.creativefabrica.com/product/dedup-test/",
    );
    const matches = result.imageUrls.filter((u) => u === sameUrl);
    expect(matches.length).toBe(1);
  });
});
