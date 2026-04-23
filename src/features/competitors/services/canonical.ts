import { SourcePlatform } from "@prisma/client";

/**
 * Etsy shop name veya URL'yi canonical lowercase shop name'e normalize eder.
 *
 * Örnekler:
 *   "https://www.etsy.com/shop/FooBar?ref=search" → "foobar"
 *   "https://www.etsy.com/uk/shop/FooBar/"        → "foobar"
 *   "FooBar"                                       → "foobar"
 *   "  foobar  "                                   → "foobar"
 */
export function canonicalizeEtsyShopName(raw: string): string {
  // 1. Trim
  let s = raw.trim();

  // 2. Query param kırp (? sonrası)
  const qIdx = s.indexOf("?");
  if (qIdx !== -1) s = s.slice(0, qIdx);

  // 3. Fragment kırp (# sonrası)
  const hIdx = s.indexOf("#");
  if (hIdx !== -1) s = s.slice(0, hIdx);

  // 4. Trailing slash kırp
  s = s.replace(/\/+$/, "");

  // 5. URL ise locale prefix + /shop/ pattern'inden NAME çıkar
  //    Desteklenen: etsy.com/shop/NAME veya etsy.com/LOCALE/shop/NAME
  //    Locale: 2-char (uk, tr, de...) veya 5-char (en-US)
  const shopMatch = s.match(/etsy\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?shop\/([^/?#]+)/i);
  if (shopMatch?.[1]) {
    return shopMatch[1].toLowerCase();
  }

  // 6. URL ama /shop/ yok → son path segment al (etsy.com/NAME gibi kısa URL)
  if (s.includes("etsy.com/")) {
    const afterDomain = s.replace(/^.*etsy\.com\//, "");
    const segment = afterDomain.split("/")[0];
    if (segment) return segment.toLowerCase();
  }

  // 7. Düz shop name — lowercase + trim
  return s.toLowerCase();
}

/**
 * Listing URL'yi canonical form'a getirir.
 *
 * Örnekler:
 *   "https://www.etsy.com/listing/123/foo?ref=abc"  → "https://www.etsy.com/listing/123/foo"
 *   "http://etsy.com/listing/123/foo/"              → "https://www.etsy.com/listing/123/foo"
 *   "https://www.etsy.com/listing/123/foo#reviews"  → "https://www.etsy.com/listing/123/foo"
 */
export function canonicalizeListingUrl(raw: string): string {
  // 1. Trim
  let s = raw.trim();

  // 2. Query param kırp
  const qIdx = s.indexOf("?");
  if (qIdx !== -1) s = s.slice(0, qIdx);

  // 3. Fragment kırp
  const hIdx = s.indexOf("#");
  if (hIdx !== -1) s = s.slice(0, hIdx);

  // 4. Trailing slash kırp
  s = s.replace(/\/+$/, "");

  // 5. http → https normalize
  s = s.replace(/^http:\/\//, "https://");

  // 6. www. prefix normalize: Etsy için www. ekle
  s = s.replace(/^https:\/\/etsy\.com\//, "https://www.etsy.com/");

  return s;
}

/**
 * External ID'yi canonical form'a normalize eder.
 *
 * Etsy: sayısal string → trim
 * Amazon: ASIN → uppercase 10-char
 */
export function canonicalizeExternalId(raw: string, platform: SourcePlatform): string {
  const trimmed = raw.trim();

  if (platform === SourcePlatform.AMAZON) {
    return trimmed.toUpperCase();
  }

  // ETSY ve diğerleri: sadece trim
  return trimmed;
}
