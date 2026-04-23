import { load } from "cheerio";
import { SourcePlatform, CompetitorListingStatus } from "@prisma/client";
import type { ScrapedListing } from "../types";

/** JSON-LD bloğunu parse eder; başarısız olursa null döner */
function parseJsonLd(
  html: string
): { data: Record<string, unknown>; raw: string } | null {
  const $ = load(html);
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    const el = scripts.eq(i);
    const text = el.contents().text();
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      return { data, raw: text };
    } catch {
      // sessizce devam et
    }
  }
  return null;
}

/** Etsy listing URL'den numeric id çıkarır */
function extractEtsyId(sourceUrl: string): string {
  const match = sourceUrl.match(/\/listing\/(\d+)/);
  return match?.[1] ?? "";
}

export function parseEtsyListing(html: string, sourceUrl: string): ScrapedListing {
  const $ = load(html);
  const parseWarnings: string[] = [];

  // --- externalId ---
  const externalId = extractEtsyId(sourceUrl);
  if (!externalId) {
    parseWarnings.push("External ID URL'den çıkarılamadı");
  }

  // --- JSON-LD parse denemesi ---
  const jsonLdResult = parseJsonLd(html);
  let jsonLdFailed = false;
  let jsonLdData: Record<string, unknown> | null = null;

  if (jsonLdResult) {
    jsonLdData = jsonLdResult.data;
  } else {
    jsonLdFailed = true;
    parseWarnings.push("JSON-LD parse edilemedi");
  }

  // --- title ---
  let title = "";
  if (jsonLdData && typeof jsonLdData["name"] === "string" && jsonLdData["name"]) {
    title = jsonLdData["name"];
  }
  if (!title) {
    title =
      $('meta[property="og:title"]').attr("content")?.trim() ??
      $("title").text().replace(/\s*-\s*Etsy\s*$/i, "").trim() ??
      "";
  }
  if (!title) {
    parseWarnings.push("Title bilgisi alınamadı");
  }

  // --- images ---
  const imageUrls: string[] = [];

  // Önce JSON-LD image array
  if (jsonLdData) {
    const rawImage = jsonLdData["image"];
    const images = Array.isArray(rawImage) ? rawImage : rawImage ? [rawImage] : [];
    for (const img of images) {
      if (typeof img === "string" && !imageUrls.includes(img)) {
        imageUrls.push(img);
      }
    }
  }

  // Fallback: og:image
  if (imageUrls.length === 0) {
    $('meta[property="og:image"], meta[property="og:image:secure_url"]').each(
      (_, el) => {
        const content = $(el).attr("content");
        if (content && !imageUrls.includes(content)) imageUrls.push(content);
      }
    );
  }

  if (imageUrls.length === 0) {
    parseWarnings.push("Görsel URL'si bulunamadı");
  }

  const thumbnailUrl = imageUrls[0] ?? null;

  // --- price ---
  let priceCents: number | null = null;
  let currency: string | null = null;

  if (jsonLdData) {
    const offers = jsonLdData["offers"] as Record<string, unknown> | undefined;
    if (offers) {
      const priceRaw = offers["price"];
      const currRaw = offers["priceCurrency"];
      if (priceRaw !== undefined && priceRaw !== null) {
        const parsed = parseFloat(String(priceRaw));
        if (!isNaN(parsed)) priceCents = Math.round(parsed * 100);
      }
      if (typeof currRaw === "string") currency = currRaw;
    }
  }

  if (priceCents === null) {
    parseWarnings.push("Price bilgisi alınamadı");
  }

  // --- reviewCount ---
  let reviewCount = 0;
  let reviewCountFound = false;

  if (jsonLdData) {
    const aggRating = jsonLdData["aggregateRating"] as
      | Record<string, unknown>
      | undefined;
    if (aggRating) {
      const rc = aggRating["reviewCount"];
      if (rc !== undefined) {
        reviewCount = parseInt(String(rc), 10) || 0;
        reviewCountFound = true;
      }
    }
  }

  if (!reviewCountFound) {
    parseWarnings.push("Review count bulunamadı (fallback 0 kullanıldı)");
  }

  // --- listingCreatedAt ---
  let listingCreatedAt: Date | null = null;
  if (jsonLdData && typeof jsonLdData["datePublished"] === "string") {
    const d = new Date(jsonLdData["datePublished"]);
    if (!isNaN(d.getTime())) {
      listingCreatedAt = d;
    } else {
      parseWarnings.push("listingCreatedAt geçersiz tarih formatında");
    }
  } else {
    parseWarnings.push("listingCreatedAt fixture/sayfada bulunamadı");
  }

  // --- latestReviewAt ---
  let latestReviewAt: Date | null = null;
  if (jsonLdData) {
    const aggRating = jsonLdData["aggregateRating"] as
      | Record<string, unknown>
      | undefined;
    if (aggRating && typeof aggRating["datePublished"] === "string") {
      const d = new Date(aggRating["datePublished"]);
      if (!isNaN(d.getTime())) latestReviewAt = d;
    }
  }

  // --- parserSource ve parserConfidence hesaplama ---
  let parserSource: string;
  let parserConfidence: number;

  if (!jsonLdFailed && jsonLdData) {
    parserSource = "json-ld";

    // Confidence: 95 base, her eksik alan -5
    let confidence = 95;
    if (!title) confidence -= 5;
    if (imageUrls.length === 0) confidence -= 5;
    if (priceCents === null) confidence -= 5;
    if (!reviewCountFound) confidence -= 5;
    parserConfidence = Math.max(confidence, 50);
  } else if (imageUrls.length > 0 || title) {
    parserSource = "og-meta";
    parserConfidence = 50;
  } else {
    parserSource = "fallback";
    parserConfidence = externalId ? 20 : 10;
  }

  return {
    externalId,
    platform: SourcePlatform.ETSY,
    sourceUrl,
    title,
    thumbnailUrl,
    imageUrls,
    priceCents,
    currency,
    reviewCount,
    favoritesCount: null,
    listingCreatedAt,
    latestReviewAt,
    parserSource,
    parserConfidence,
    parseWarnings,
    status: CompetitorListingStatus.ACTIVE,
  };
}
