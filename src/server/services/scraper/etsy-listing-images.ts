/**
 * Phase 35 — Etsy listing → image picker service.
 *
 * Add Reference modal URL tab'ında operatör Etsy listing URL'i
 * (https://www.etsy.com/listing/{id}/{slug}) paste ettiğinde tek
 * görsel yerine listing'in **tüm** görsellerini çıkartıp seçtirme
 * akışı. Mevcut `parseEtsyListing` parser'ı (Phase 3'te eklenmiş,
 * self-hosted scraper provider içinden çağrılıyor) `imageUrls[]`
 * dönüyor; Phase 35 bunu ürün yüzeyine bağlar.
 *
 * Bu service yalnız listing-detail için. Shop-level scan (Competitors
 * flow) `SelfHostedScraper.scanStore` kullanmaya devam eder.
 *
 * Hata davranışı:
 *   - Listing URL pattern geçersizse `ValidationError`
 *   - HTTP fetch fail → `Error` (operatöre "couldn't fetch listing")
 *   - Parse tamamen başarısızsa empty imageUrls + warnings döner
 *     (caller karar verir: "no images found" göster)
 *
 * Güvenlik:
 *   - Yalnız etsy.com domain'i kabul edilir (SSRF koruması)
 *   - URL'den listing id çıkartılır; opaque path traversal yok
 *   - Response yalnız `{ imageUrls, title, externalId }` —
 *     operatöre minimum bilgi (price/review gibi alanlar bu surface
 *     için gereksiz; intake flow için yalnız görseller + title)
 */

import { parseEtsyListing } from "@/providers/scraper/parsers/etsy-parser";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const ETSY_LISTING_URL = /^https:\/\/(?:www\.)?etsy\.com\/listing\/(\d+)/i;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36";

export type EtsyListingImagesResult = {
  externalId: string;
  title: string;
  imageUrls: string[];
  warnings: string[];
};

/**
 * URL'in Etsy listing detail page olup olmadığını test eder. Sadece
 * `etsy.com/listing/{id}` formatını kabul eder; CDN URL (`etsystatic.com`)
 * **değildir** — operatör direct image paste etmişse listing picker
 * tetiklenmez. UI tarafındaki `detectSourceFromUrl` zaten bu ayrımı
 * yapıyor; bu fonksiyon server-side guard.
 */
export function isEtsyListingUrl(url: string): boolean {
  return ETSY_LISTING_URL.test(url.trim());
}

export async function fetchEtsyListingImages(
  rawUrl: string,
): Promise<EtsyListingImagesResult> {
  const url = rawUrl.trim();
  if (!isEtsyListingUrl(url)) {
    throw new ValidationError(
      "URL must be an Etsy listing page (https://www.etsy.com/listing/...)",
    );
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) {
      logger.warn(
        { url, status: res.status },
        "etsy-listing-images: HTTP not OK",
      );
      throw new Error(`Couldn't fetch listing (HTTP ${res.status})`);
    }
    html = await res.text();
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Couldn't fetch")) {
      throw err;
    }
    logger.warn(
      { url, err: (err as Error).message },
      "etsy-listing-images: fetch error",
    );
    throw new Error("Couldn't reach Etsy. Try again in a moment.");
  }

  const parsed = parseEtsyListing(html, url);

  return {
    externalId: parsed.externalId,
    title: parsed.title,
    imageUrls: parsed.imageUrls,
    warnings: parsed.parseWarnings,
  };
}
