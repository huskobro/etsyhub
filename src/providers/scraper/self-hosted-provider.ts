import pLimit from "p-limit";
import { SourcePlatform } from "@prisma/client";
import type {
  ScraperProvider,
  ScrapedListing,
  ScrapedStore,
  ScanResult,
  ScanScope,
} from "./types";
import { parseEtsyListing } from "./parsers/etsy-parser";
import { parseAmazonListing } from "./parsers/amazon-parser";
import { logger } from "@/lib/logger";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36";

export class SelfHostedScraper implements ScraperProvider {
  readonly name = "self-hosted" as const;

  async scanStore(input: {
    shopIdentifier: string;
    platform: SourcePlatform;
    scope: ScanScope;
  }): Promise<ScanResult> {
    const started = Date.now();

    if (input.platform !== SourcePlatform.ETSY) {
      throw new Error("Self-hosted scraper Phase 3'te yalnız Etsy destekler");
    }

    const shopUrl = input.shopIdentifier.startsWith("http")
      ? input.shopIdentifier
      : `https://www.etsy.com/shop/${encodeURIComponent(input.shopIdentifier)}`;

    // 1. Shop sayfasını çek
    const shopHtml = await this.fetchHtml(shopUrl);
    const { listingUrls, store } = this.parseShopPage(
      shopHtml,
      shopUrl,
      input.shopIdentifier
    );

    // 2. Incremental mode — bilinen ID'leri atla
    const knownIds: Set<string> =
      input.scope.mode === "incremental_since"
        ? new Set<string>(input.scope.knownExternalIds)
        : new Set<string>();

    const toFetch = listingUrls.filter((u) => {
      const idMatch = u.match(/\/listing\/(\d+)/);
      const id = idMatch?.[1] ?? null;
      return id !== null && !knownIds.has(id);
    });

    // 3. Rate limited listing fetch (max 50 listing, 2 concurrent)
    const limit = pLimit(2);
    const listings: ScrapedListing[] = [];
    const scanLevelWarnings: string[] = [];
    let skippedCount = 0;

    await Promise.all(
      toFetch.slice(0, 50).map((url) =>
        limit(async () => {
          try {
            await this.sleep(3000 + Math.random() * 2000);
            const html = await this.fetchHtml(url);
            listings.push(parseEtsyListing(html, url));
          } catch (err) {
            skippedCount++;
            const msg = `Listing fetch başarısız, atlandı: ${url} — ${(err as Error).message}`;
            scanLevelWarnings.push(msg);
            logger.warn({ url, err: (err as Error).message }, "listing scrape skipped");
          }
        })
      )
    );

    if (skippedCount > 0) {
      scanLevelWarnings.push(`Toplam ${skippedCount} listing atlandı (fetch hatası)`);
    }

    return {
      store,
      listings,
      scanMeta: {
        provider: this.name,
        durationMs: Date.now() - started,
        parseWarnings: scanLevelWarnings,
      },
    };
  }

  async parseSingleListing(url: string): Promise<ScrapedListing> {
    const html = await this.fetchHtml(url);
    if (/etsy\.com/.test(url)) return parseEtsyListing(html, url);
    if (/amazon\./.test(url)) return parseAmazonListing(html, url);
    throw new Error(`Self-hosted parser desteklenmeyen platform: ${url}`);
  }

  private async fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetch ${url}`);
    return res.text();
  }

  private parseShopPage(
    html: string,
    shopUrl: string,
    shopIdentifier: string
  ): { listingUrls: string[]; store: ScrapedStore } {
    // Regex ile /listing/<id>/... URL'lerini yakala
    const matches = Array.from(
      html.matchAll(/https:\/\/www\.etsy\.com\/listing\/\d+\/[^"'<> ]+/g)
    );
    const urlSet = new Set<string>(matches.map((m) => m[0]));
    const urls = Array.from(urlSet).slice(0, 100);

    const etsyShopName = shopIdentifier
      .replace(/.*\/shop\//i, "")
      .replace(/\?.*$/, "")
      .trim()
      .toLowerCase();

    return {
      listingUrls: urls,
      store: {
        etsyShopName,
        platform: SourcePlatform.ETSY,
        displayName: null,
        shopUrl,
        totalListings: urls.length > 0 ? urls.length : null,
        totalReviews: null,
      } satisfies ScrapedStore,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
