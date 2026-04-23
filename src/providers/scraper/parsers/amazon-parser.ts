import { load } from "cheerio";
import { SourcePlatform, CompetitorListingStatus } from "@prisma/client";
import type { ScrapedListing } from "../types";

/** Amazon listing URL'den ASIN çıkarır */
function extractAsin(sourceUrl: string): string {
  const match = sourceUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
  return match?.[1] ?? "";
}

export function parseAmazonListing(html: string, sourceUrl: string): ScrapedListing {
  const $ = load(html);
  const parseWarnings: string[] = [];

  // --- externalId (ASIN) ---
  const externalId = extractAsin(sourceUrl);
  if (!externalId) {
    parseWarnings.push("External ID URL'den çıkarılamadı");
  }

  // --- title ---
  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ??
    $("title").text().trim() ??
    "";
  if (!title) {
    parseWarnings.push("Title bilgisi alınamadı");
  }

  // --- image ---
  const ogImage = $('meta[property="og:image"]').attr("content") ?? null;
  if (!ogImage) {
    parseWarnings.push("Görsel URL'si bulunamadı");
  }
  const imageUrls: string[] = ogImage ? [ogImage] : [];

  // --- reviewCount (Amazon sayfasından DOM elemanı) ---
  let reviewCount = 0;
  let reviewCountFound = false;
  const reviewText = $("#acrCustomerReviewText").text();
  if (reviewText) {
    const match = reviewText.match(/([\d,]+)/);
    if (match?.[1]) {
      reviewCount = parseInt(match[1].replace(/,/g, ""), 10) || 0;
      reviewCountFound = true;
    }
  }
  if (!reviewCountFound) {
    parseWarnings.push("Review count bulunamadı (fallback 0 kullanıldı)");
  }

  // Amazon'da tarih sayfadan genellikle çıkmaz
  parseWarnings.push("listingCreatedAt fixture/sayfada bulunamadı");

  // --- parserSource / confidence ---
  // Amazon'da JSON-LD Product genellikle olmaz; og:meta mevcutsa "og-meta"
  const parserSource: string = ogImage || title ? "og-meta" : "fallback";
  let parserConfidence: number;
  if (parserSource === "og-meta") {
    parserConfidence = 50;
    if (ogImage && title) parserConfidence = 60;
  } else {
    parserConfidence = externalId ? 20 : 10;
  }

  return {
    externalId,
    platform: SourcePlatform.AMAZON,
    sourceUrl,
    title,
    thumbnailUrl: ogImage,
    imageUrls,
    priceCents: null,
    currency: null,
    reviewCount,
    favoritesCount: null,
    listingCreatedAt: null,
    latestReviewAt: null,
    parserSource,
    parserConfidence,
    parseWarnings,
    status: CompetitorListingStatus.ACTIVE,
  };
}
