import type { ScraperProvider, ScanResult, ScrapedListing, ScanScope } from "./types";
import type { SourcePlatform } from "@prisma/client";

export class ApifyScraper implements ScraperProvider {
  readonly name = "apify" as const;
  constructor(private readonly token: string) {}

  async scanStore(_input: {
    shopIdentifier: string;
    platform: SourcePlatform;
    scope: ScanScope;
  }): Promise<ScanResult> {
    throw new Error("Apify scraper Task 5'te implement edilir");
  }

  async parseSingleListing(_url: string): Promise<ScrapedListing> {
    throw new Error("Apify parseSingleListing Task 5'te implement edilir");
  }
}
