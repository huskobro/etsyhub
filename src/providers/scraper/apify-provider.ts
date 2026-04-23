import { ApifyClient } from "apify-client";
import { SourcePlatform, CompetitorListingStatus } from "@prisma/client";
import type { ScraperProvider, ScanResult, ScanScope, ScrapedListing } from "./types";
import { logger } from "@/lib/logger";

const ETSY_STORE_ACTOR = "epctex/etsy-scraper";
const ETSY_LISTING_ACTOR = "epctex/etsy-scraper";

/** Unix timestamp detection: 10 haneli = saniye, 13 haneli = milisaniye */
function parseTimestamp(value: unknown): Date | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number") {
    if (value <= 0) return null;
    // 10 haneli → Unix saniye, 13 haneli → Unix milisaniye
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function safeString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function safeNumber(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Apify dataset item'ını ScrapedListing'e dönüştürür.
 * Top-level export — unit testler bu fonksiyonu doğrudan çağırır.
 */
export function mapApifyItemToScrapedListing(
  item: Record<string, unknown>
): ScrapedListing {
  const parseWarnings: string[] = [];
  let parserConfidence = 90;

  // externalId
  const id = safeString(item["listingId"] ?? item["id"] ?? "");

  // title
  const title = safeString(item["title"] ?? "");
  if (!title) {
    parseWarnings.push("Apify item title eksik");
    parserConfidence -= 10;
  }

  // images
  const rawImages = item["images"];
  let imageUrls: string[] = [];
  if (Array.isArray(rawImages)) {
    imageUrls = rawImages
      .map((x) => (typeof x === "string" ? x : safeString((x as Record<string, unknown>)?.["url"])))
      .filter(Boolean);
  }
  if (imageUrls.length === 0) {
    parseWarnings.push("Görsel listesi boş");
  }

  // price
  const priceRaw = safeNumber(item["price"] ?? item["priceUsd"]);
  if (priceRaw == null || priceRaw <= 0) {
    parserConfidence -= 5;
  }
  const priceCents = priceRaw != null && priceRaw > 0 ? Math.round(priceRaw * 100) : null;

  // currency
  const currency =
    typeof item["currency"] === "string" ? item["currency"] : null;

  // reviewCount
  const reviewCountRaw = safeNumber(item["reviewCount"] ?? item["numberOfReviews"]);
  const reviewCount = reviewCountRaw != null && reviewCountRaw >= 0 ? Math.round(reviewCountRaw) : 0;
  if (reviewCountRaw == null) {
    parseWarnings.push("Review count Apify item'da yok");
  }

  // favoritesCount
  const favorersRaw = safeNumber(item["favorers"] ?? item["numberOfFavorers"] ?? item["favorites"]);
  const favoritesCount = favorersRaw != null ? Math.round(favorersRaw) : null;

  // listingCreatedAt
  const createdRaw =
    item["creationTimestamp"] ??
    item["createdTimestamp"] ??
    item["publishedAt"] ??
    item["createdAt"];
  const listingCreatedAt = parseTimestamp(createdRaw);
  if (!listingCreatedAt) {
    parseWarnings.push("listing creationTimestamp Apify item'da yok veya parse edilemedi");
  }

  // latestReviewAt
  const reviewDateRaw = item["latestReviewAt"] ?? item["lastReviewDate"];
  const latestReviewAt = parseTimestamp(reviewDateRaw);
  if (!latestReviewAt) {
    parseWarnings.push("latestReviewAt Apify item'da yok veya parse edilemedi");
  }

  // sourceUrl
  const sourceUrl = safeString(item["url"] ?? item["sourceUrl"] ?? "");

  // thumbnail
  const thumbnailUrl = imageUrls[0] ?? null;

  return {
    externalId: id,
    platform: SourcePlatform.ETSY,
    sourceUrl,
    title,
    thumbnailUrl,
    imageUrls,
    priceCents,
    currency,
    reviewCount,
    favoritesCount,
    listingCreatedAt,
    latestReviewAt,
    parserSource: "apify",
    parserConfidence,
    parseWarnings,
    status: CompetitorListingStatus.ACTIVE,
    rawMetadata: item,
  };
}

export class ApifyScraper implements ScraperProvider {
  readonly name = "apify" as const;
  private client: ApifyClient;

  constructor(private readonly token: string) {
    this.client = new ApifyClient({ token });
  }

  async scanStore(input: {
    shopIdentifier: string;
    platform: SourcePlatform;
    scope: ScanScope;
  }): Promise<ScanResult> {
    if (input.platform !== SourcePlatform.ETSY) {
      throw new Error("Apify Phase 3'te yalnız Etsy destekler");
    }
    const started = Date.now();
    const scanLevelWarnings: string[] = [];

    const shopUrl = input.shopIdentifier.startsWith("http")
      ? input.shopIdentifier
      : `https://www.etsy.com/shop/${input.shopIdentifier}`;

    logger.info({ shopUrl, scope: input.scope.mode }, "Apify scanStore başlıyor");

    const run = await this.client.actor(ETSY_STORE_ACTOR).call({
      startUrls: [{ url: shopUrl }],
      mode: "SHOP",
      maxItems: input.scope.mode === "initial_full" ? 200 : 50,
    });

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (items.length === 0) {
      scanLevelWarnings.push("Apify dataset boş döndü");
    }

    const validItems: Record<string, unknown>[] = [];
    let skippedCount = 0;
    for (const i of items) {
      if (typeof i === "object" && i !== null) {
        validItems.push(i as Record<string, unknown>);
      } else {
        skippedCount++;
      }
    }
    if (skippedCount > 0) {
      scanLevelWarnings.push(`${skippedCount} item skip edildi (geçersiz format)`);
    }

    const listings = validItems.map((i) => mapApifyItemToScrapedListing(i));

    const firstItem = validItems[0];
    const displayName =
      firstItem != null && typeof firstItem["shopName"] === "string"
        ? firstItem["shopName"]
        : null;

    const canonicalShopName = input.shopIdentifier
      .replace(/.*\/shop\//, "")
      .toLowerCase()
      .trim();

    return {
      store: {
        etsyShopName: canonicalShopName,
        platform: SourcePlatform.ETSY,
        displayName,
        shopUrl,
        totalListings: listings.length,
        totalReviews: null,
      },
      listings,
      scanMeta: {
        provider: this.name,
        durationMs: Date.now() - started,
        parseWarnings: scanLevelWarnings,
      },
    };
  }

  async parseSingleListing(url: string): Promise<ScrapedListing> {
    logger.info({ url }, "Apify parseSingleListing başlıyor");

    const run = await this.client.actor(ETSY_LISTING_ACTOR).call({
      startUrls: [{ url }],
      mode: "LISTING",
      maxItems: 1,
    });

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (!items[0] || typeof items[0] !== "object" || items[0] === null) {
      throw new Error(`Apify listing boş döndü: ${url}`);
    }

    return mapApifyItemToScrapedListing(items[0] as Record<string, unknown>);
  }
}
