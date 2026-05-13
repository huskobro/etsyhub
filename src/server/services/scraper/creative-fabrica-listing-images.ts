/**
 * Phase 37 — Creative Fabrica listing → image picker service.
 *
 * Etsy listing service pattern'inin mirror'ı (Phase 35/36). Önemli fark:
 * CF Cloudflare Turnstile / interactive JS challenge ile koruyor;
 * Datadome'a benzer (browser fingerprint + JS execution + canvas). curl
 * testleri:
 *   - Chrome 132 UA → HTTP 403 "Just a moment..." (Cloudflare challenge)
 *
 * Yani CF de Etsy gibi server-side fetch ile success rate düşük.
 * Strateji aynı: **typed error code + actionable fallback UX**.
 *
 * Service success path bazen geçerli olabilir (Cloudflare bazı IP'lere
 * tolerant); UI başarı yolu fixture/integration test ile kanıtlanır.
 *
 * Güvenlik:
 *   - Yalnız creativefabrica.com domain'i kabul edilir
 *   - URL'den product slug çıkartılır; opaque path yok
 */

import {
  parseCreativeFabricaListing,
} from "@/providers/scraper/parsers/creative-fabrica-parser";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const CF_LISTING_URL =
  /^https:\/\/(?:www\.)?creativefabrica\.com\/product\/[^/?#]+/i;

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Ch-Ua":
    '"Not A(Brand";v="99", "Google Chrome";v="132", "Chromium";v="132"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

export type CreativeFabricaListingImagesResult = {
  externalId: string;
  title: string;
  imageUrls: string[];
  warnings: string[];
};

/**
 * Typed errors — Etsy pattern mirror.
 */
export class CreativeFabricaFetchBlockedError extends Error {
  public readonly status: number;
  constructor(status: number) {
    super(
      `Creative Fabrica blocked the request (HTTP ${status}). CF uses anti-bot protection on product pages.`,
    );
    this.name = "CreativeFabricaFetchBlockedError";
    this.status = status;
  }
}

export class CreativeFabricaFetchError extends Error {
  public readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "CreativeFabricaFetchError";
    this.status = status;
  }
}

export function isCreativeFabricaListingUrl(url: string): boolean {
  return CF_LISTING_URL.test(url.trim());
}

async function fetchOnce(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchCreativeFabricaListingImages(
  rawUrl: string,
): Promise<CreativeFabricaListingImagesResult> {
  const url = rawUrl.trim();
  if (!isCreativeFabricaListingUrl(url)) {
    throw new ValidationError(
      "URL must be a Creative Fabrica product page (https://www.creativefabrica.com/product/...)",
    );
  }

  let lastErr: Error | null = null;
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetchOnce(url, 6000);
      if (res.ok || (res.status >= 400 && res.status < 500)) break;
      lastErr = new CreativeFabricaFetchError(
        `Upstream ${res.status}`,
        res.status,
      );
    } catch (err) {
      lastErr = err as Error;
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
  }

  if (!res) {
    logger.warn(
      { url, err: lastErr?.message },
      "creative-fabrica-listing-images: fetch error (no response)",
    );
    throw new CreativeFabricaFetchError(
      "Couldn't reach Creative Fabrica (network timeout or DNS failure).",
    );
  }

  if (!res.ok) {
    logger.warn(
      { url, status: res.status },
      "creative-fabrica-listing-images: HTTP not OK",
    );
    if ([403, 429, 503].includes(res.status)) {
      throw new CreativeFabricaFetchBlockedError(res.status);
    }
    throw new CreativeFabricaFetchError(
      `Creative Fabrica returned HTTP ${res.status}.`,
      res.status,
    );
  }

  const html = await res.text();
  const parsed = parseCreativeFabricaListing(html, url);

  return {
    externalId: parsed.externalId,
    title: parsed.title,
    imageUrls: parsed.imageUrls,
    warnings: parsed.warnings,
  };
}
