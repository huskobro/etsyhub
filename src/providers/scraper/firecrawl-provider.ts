import type { ScraperProvider, ScanResult, ScrapedListing, ScanScope } from "./types";
import type { SourcePlatform } from "@prisma/client";

export class FirecrawlScraper implements ScraperProvider {
  readonly name = "firecrawl" as const;
  constructor(private readonly token: string) {}

  async scanStore(_input: {
    shopIdentifier: string;
    platform: SourcePlatform;
    scope: ScanScope;
  }): Promise<ScanResult> {
    throw new Error("Firecrawl scraper Phase 3+/ileride implement edilir");
  }

  async parseSingleListing(_url: string): Promise<ScrapedListing> {
    throw new Error("Firecrawl parseSingleListing Phase 3+/ileride implement edilir");
  }
}
