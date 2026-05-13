/**
 * Phase 37 — Creative Fabrica product/listing parser.
 *
 * Creative Fabrica product pages şu kaynakları taşır:
 *   - `<meta property="og:image">` — primary product image
 *   - `<meta property="og:image:secure_url">` — same as og:image (https)
 *   - `<meta name="twitter:image">` — twitter card
 *   - `<script type="application/ld+json">` Product schema:
 *       { @type: "Product", image: string | string[] }
 *   - DOM gallery: `<img class="product-gallery" ... data-src="...">` veya
 *     `<a class="gallery-thumb" href="..."><img src="..."></a>`
 *
 * Strategy: önce JSON-LD (en zengin), sonra OG meta (always present),
 * son fallback DOM `<img>` taraması (filtreli — site CDN host'ları).
 *
 * URL pattern: `https://www.creativefabrica.com/product/{slug}/`
 *
 * Bu parser yalnız `imageUrls[]` + `title` + `externalId` döner —
 * intake flow için yeterli (price/review CF için gereksiz; CF bookmark
 * scope dışı olarak yalnız asset intake).
 */

import { load } from "cheerio";

const CF_PRODUCT_URL = /\/product\/([^/?#]+)/i;
const CF_IMAGE_HOST = /^https?:\/\/(?:[a-z0-9-]+\.)*creativefabrica\.com\//i;

export type CreativeFabricaParseResult = {
  externalId: string;
  title: string;
  imageUrls: string[];
  warnings: string[];
};

/** URL'den product slug çıkarır (externalId olarak). */
function extractCfId(sourceUrl: string): string {
  const match = sourceUrl.match(CF_PRODUCT_URL);
  return match?.[1] ?? "";
}

/** JSON-LD bloğunu güvenli parse — başarısızsa null. */
function parseJsonLd(html: string): Record<string, unknown> | null {
  const $ = load(html);
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    const text = scripts.eq(i).contents().text();
    try {
      const data = JSON.parse(text) as Record<string, unknown> | unknown[];
      // CF sometimes wraps in array
      if (Array.isArray(data)) {
        const product = (data as Record<string, unknown>[]).find(
          (d) => d["@type"] === "Product",
        );
        if (product) return product;
      } else if (
        typeof data === "object" &&
        data !== null &&
        (data as Record<string, unknown>)["@type"] === "Product"
      ) {
        return data as Record<string, unknown>;
      }
    } catch {
      /* silently continue */
    }
  }
  return null;
}

export function parseCreativeFabricaListing(
  html: string,
  sourceUrl: string,
): CreativeFabricaParseResult {
  const $ = load(html);
  const warnings: string[] = [];

  const externalId = extractCfId(sourceUrl);
  if (!externalId) warnings.push("Product slug URL'den çıkarılamadı");

  // --- title ---
  let title = "";
  const jsonLd = parseJsonLd(html);
  if (jsonLd && typeof jsonLd["name"] === "string") {
    title = (jsonLd["name"] as string).trim();
  }
  if (!title) {
    title =
      $('meta[property="og:title"]').attr("content")?.trim() ??
      $('meta[name="twitter:title"]').attr("content")?.trim() ??
      $("title").text().replace(/\s*[-|]\s*Creative Fabrica.*$/i, "").trim() ??
      "";
  }
  if (!title) warnings.push("Title bulunamadı");

  // --- imageUrls (deduplicated, in priority order) ---
  const imageUrls: string[] = [];
  const seen = new Set<string>();
  const push = (url: string | null | undefined): void => {
    if (!url) return;
    const trimmed = url.trim();
    if (!trimmed) return;
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    imageUrls.push(trimmed);
  };

  // 1) JSON-LD `image` (en güvenilir)
  if (jsonLd) {
    const raw = jsonLd["image"];
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const item of list) {
      if (typeof item === "string") push(item);
      else if (
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>)["url"] === "string"
      ) {
        push((item as Record<string, unknown>)["url"] as string);
      }
    }
  }

  // 2) OG / Twitter meta
  push($('meta[property="og:image:secure_url"]').attr("content"));
  push($('meta[property="og:image"]').attr("content"));
  $('meta[property="og:image"]').each((_, el) => {
    push($(el).attr("content"));
  });
  push($('meta[name="twitter:image"]').attr("content"));

  // 3) DOM gallery fallback — CF CDN host filtre
  // Common selectors observed in CF product pages
  $(
    "img.product-gallery, .product-gallery img, .gallery-thumb img, a.gallery-thumb",
  ).each((_, el) => {
    const $el = $(el);
    const candidates = [
      $el.attr("data-src"),
      $el.attr("data-original"),
      $el.attr("data-lazy-src"),
      $el.attr("src"),
      $el.attr("href"),
    ];
    for (const c of candidates) {
      if (c && CF_IMAGE_HOST.test(c)) push(c);
    }
  });

  if (imageUrls.length === 0) warnings.push("Görsel URL'si bulunamadı");

  return {
    externalId,
    title,
    imageUrls,
    warnings,
  };
}
