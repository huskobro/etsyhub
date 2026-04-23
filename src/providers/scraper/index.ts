export type ScrapedListing = {
  sourceUrl: string;
  title?: string;
  imageUrl?: string;
  reviewCount?: number;
  price?: number;
  currency?: string;
};

export interface ScraperProvider {
  scrapeEtsyShop(shopName: string): Promise<ScrapedListing[]>;
}

export class NotImplementedScraper implements ScraperProvider {
  scrapeEtsyShop(): never {
    throw new Error("Scraper provider Phase 3'te aktifleşir");
  }
}

export function getScraper(): ScraperProvider {
  return new NotImplementedScraper();
}
