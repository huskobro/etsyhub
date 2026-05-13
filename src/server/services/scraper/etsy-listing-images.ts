/**
 * Phase 35 → Phase 36 — Etsy listing → image picker service.
 *
 * Add Reference modal URL tab'ında operatör Etsy listing URL'i
 * (https://www.etsy.com/listing/{id}/{slug}) paste ettiğinde tek
 * görsel yerine listing'in **tüm** görsellerini çıkartıp seçtirme
 * akışı. Mevcut `parseEtsyListing` parser'ı (Phase 3'te eklenmiş,
 * self-hosted scraper provider içinden çağrılıyor) `imageUrls[]`
 * dönüyor; Phase 35 bunu ürün yüzeyine bağladı.
 *
 * Phase 36 reliability hardening:
 *   - Etsy listing detail page'leri **Datadome WAF** ile korunuyor
 *     (JS challenge + Captcha). Server-side fetch yapılınca:
 *       * Common UA → HTTP 403 (HTML body "Please enable JS")
 *       * Googlebot UA → HTTP 429
 *       * Firefox UA → HTTP 403
 *     Bu **header-only çözülemez bir WAF**. Production'da
 *     residential IP veya headless browser dahi bypass garantisi
 *     vermez (Datadome JS fingerprint + canvas + mouse motion ister).
 *   - Strateji: **honest fallback** — service typed error code döner,
 *     UI operatöre actionable copy + retry + direct-URL alternative
 *     gösterir. Service hibrit "try harder" yapar (richer browser
 *     headers + 1 retry + 6s timeout) ama 403'te ısrar etmez; user
 *     experience kayboluş değil graceful degradation.
 *   - Bu strateji production'da değişebilir: 3rd-party scraper
 *     proxy (paid, opt-in), Etsy Open API entegrasyonu (OAuth +
 *     listing permission) gibi opsiyonlar Phase 37+ için açık.
 *
 * Bu service yalnız listing-detail için. Shop-level scan (Competitors
 * flow) `SelfHostedScraper.scanStore` kullanmaya devam eder.
 *
 * Hata davranışı:
 *   - URL pattern geçersizse `ValidationError` (caller 400)
 *   - HTTP 403/429 (bot block) → `EtsyFetchBlockedError` (caller 502)
 *   - Diğer HTTP non-OK → `EtsyFetchError` (caller 502)
 *   - Network/timeout → `EtsyFetchError`
 *   - Parser tamamen başarısızsa empty imageUrls + warnings döner
 *
 * Güvenlik:
 *   - Yalnız etsy.com domain'i kabul edilir (SSRF koruması)
 *   - URL'den listing id çıkartılır; opaque path traversal yok
 *   - Response yalnız `{ imageUrls, title, externalId }`
 */

import { parseEtsyListing } from "@/providers/scraper/parsers/etsy-parser";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const ETSY_LISTING_URL = /^https:\/\/(?:www\.)?etsy\.com\/listing\/(\d+)/i;

/**
 * Browser-like header set. Etsy'in WAF'ı `Sec-Ch-Ua` + `Sec-Fetch-*`
 * + Accept-Encoding kombinasyonunu Chrome browser fingerprint olarak
 * tanır. Bot block'u garantili bypass etmez (Datadome JS challenge
 * server-side fetch ile çözülemez), ama header-only basic anti-bot
 * çözen sayfalar için daha iyi success rate verir.
 */
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

export type EtsyListingImagesResult = {
  externalId: string;
  title: string;
  imageUrls: string[];
  warnings: string[];
};

/**
 * Typed errors — caller (API route) UI'ya kategori bazlı mesaj
 * çevirebilir. Generic `Error` yerine bu sınıflar kullanılır.
 */
export class EtsyFetchBlockedError extends Error {
  public readonly status: number;
  constructor(status: number) {
    super(
      `Etsy blocked the request (HTTP ${status}). Etsy uses anti-bot protection on listing pages.`,
    );
    this.name = "EtsyFetchBlockedError";
    this.status = status;
  }
}

export class EtsyFetchError extends Error {
  public readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "EtsyFetchError";
    this.status = status;
  }
}

/**
 * URL'in Etsy listing detail page olup olmadığını test eder.
 */
export function isEtsyListingUrl(url: string): boolean {
  return ETSY_LISTING_URL.test(url.trim());
}

/**
 * Tek HTTP request — abort timeout + browser-like headers.
 */
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

export async function fetchEtsyListingImages(
  rawUrl: string,
): Promise<EtsyListingImagesResult> {
  const url = rawUrl.trim();
  if (!isEtsyListingUrl(url)) {
    throw new ValidationError(
      "URL must be an Etsy listing page (https://www.etsy.com/listing/...)",
    );
  }

  /* 1 retry with brief delay — covers transient 5xx; Datadome 403'ü
   * tekrar denemekle düzelmez ama ikinci hit bazen geçerli olur
   * (rate limit reset). Timeout 6s — operatör beklemiyor olmamalı. */
  let lastErr: Error | null = null;
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetchOnce(url, 6000);
      // 5xx → retry; 4xx → no retry (header/url issue, not transient)
      if (res.ok || (res.status >= 400 && res.status < 500)) break;
      lastErr = new EtsyFetchError(`Upstream ${res.status}`, res.status);
    } catch (err) {
      lastErr = err as Error;
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
  }

  if (!res) {
    logger.warn(
      { url, err: lastErr?.message },
      "etsy-listing-images: fetch error (no response)",
    );
    throw new EtsyFetchError(
      "Couldn't reach Etsy (network timeout or DNS failure).",
    );
  }

  if (!res.ok) {
    logger.warn(
      { url, status: res.status },
      "etsy-listing-images: HTTP not OK",
    );
    // 403 / 429 / 503 → almost certainly bot/WAF block (Datadome)
    if ([403, 429, 503].includes(res.status)) {
      throw new EtsyFetchBlockedError(res.status);
    }
    throw new EtsyFetchError(
      `Etsy returned HTTP ${res.status}.`,
      res.status,
    );
  }

  const html = await res.text();
  const parsed = parseEtsyListing(html, url);

  return {
    externalId: parsed.externalId,
    title: parsed.title,
    imageUrls: parsed.imageUrls,
    warnings: parsed.parseWarnings,
  };
}
