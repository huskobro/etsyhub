import type { SourcePlatform, CompetitorListingStatus } from "@prisma/client";

export type ScrapedListing = {
  externalId: string; // Etsy listing_id / Amazon ASIN (canonical normalized)
  platform: SourcePlatform;
  sourceUrl: string; // canonical normalized URL
  title: string;
  thumbnailUrl: string | null;
  imageUrls: string[];
  priceCents: number | null;
  currency: string | null;
  reviewCount: number;
  favoritesCount: number | null;
  // --- Tarih alanları (kullanıcı düzeltmesi #2) ---
  listingCreatedAt: Date | null; // listing yayınlanma tarihi (varsa)
  latestReviewAt: Date | null; // son review tarihi (varsa)
  // --- Parser debug (kullanıcı düzeltmesi #3) ---
  parserSource: string; // "json-ld" | "og-meta" | "fallback" | "apify" vb.
  parserConfidence: number; // 0-100
  parseWarnings: string[]; // partial parse uyarıları
  // --- Durum + raw ---
  status: CompetitorListingStatus;
  rawMetadata?: Record<string, unknown>;
};

export type ScrapedStore = {
  etsyShopName: string; // canonical (lowercase, trimmed)
  platform: SourcePlatform;
  displayName: string | null;
  shopUrl: string; // canonical
  totalListings: number | null;
  totalReviews: number | null;
};

export type ScanScope =
  | { mode: "initial_full" }
  | { mode: "incremental_since"; sinceIso: string; knownExternalIds: string[] };

export type ScanResult = {
  store: ScrapedStore;
  listings: ScrapedListing[];
  scanMeta: {
    provider: string;
    durationMs: number;
    apiCreditsUsed?: number;
    parseWarnings: string[]; // scan bazında toplanmış uyarılar (CompetitorScan.parseWarnings'e yazılır)
  };
};

export type ScraperProviderName = "apify" | "firecrawl" | "self-hosted";

export interface ScraperProvider {
  readonly name: ScraperProviderName;
  scanStore(input: {
    shopIdentifier: string;
    platform: SourcePlatform;
    scope: ScanScope;
  }): Promise<ScanResult>;
  parseSingleListing(url: string): Promise<ScrapedListing>;
}
