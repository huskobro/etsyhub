import type { ScraperProvider, ScanResult, ScrapedListing, ScanScope } from "./types";
import type { SourcePlatform } from "@prisma/client";

export class SelfHostedScraper implements ScraperProvider {
  readonly name = "self-hosted" as const;

  async scanStore(_input: {
    shopIdentifier: string;
    platform: SourcePlatform;
    scope: ScanScope;
  }): Promise<ScanResult> {
    throw new Error("self-hosted scraper Task 4'te implement edilir");
  }

  async parseSingleListing(_url: string): Promise<ScrapedListing> {
    throw new Error("self-hosted parseSingleListing Task 4'te implement edilir");
  }
}
