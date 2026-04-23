import { getActiveProviderConfig } from "./provider-config";
import type { ScraperProvider } from "./types";
import { ApifyScraper } from "./apify-provider";
import { FirecrawlScraper } from "./firecrawl-provider";
import { SelfHostedScraper } from "./self-hosted-provider";

export async function getScraper(): Promise<ScraperProvider> {
  const config = await getActiveProviderConfig();

  if (config.active === "apify") {
    if (!config.apifyToken) throw new Error("Apify API key ayarlanmamış");
    return new ApifyScraper(config.apifyToken);
  }
  if (config.active === "firecrawl") {
    if (!config.firecrawlToken) throw new Error("Firecrawl API key ayarlanmamış");
    return new FirecrawlScraper(config.firecrawlToken);
  }
  return new SelfHostedScraper();
}

export type {
  ScraperProvider,
  ScraperProviderName,
  ScrapedListing,
  ScrapedStore,
  ScanResult,
  ScanScope,
} from "./types";
export {
  getActiveProviderConfig,
  setActiveProvider,
  setApifyToken,
  setFirecrawlToken,
} from "./provider-config";
export type { ProviderConfig } from "./provider-config";
