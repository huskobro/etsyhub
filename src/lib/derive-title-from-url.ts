/**
 * deriveTitleFromUrl — Phase 30 shared client+server helper.
 *
 * Phase 29'da `add-reference-dialog.tsx` içinde client-side title
 * normalization eklendi (bookmark create payload'a). Phase 30'da
 * server-side fallback chain için aynı helper'ı service katmanına
 * taşıdık — yeni bookmark `title` undefined ise server-side burada
 * çevrilir.
 *
 * Patterns:
 *   - etsy.com/listing/{id}/{slug} → titleized slug
 *   - etsystatic.com/... → "Etsy image"
 *   - pinterest.com/pin/{id}/ → "Pinterest pin {id}"
 *   - pinimg.com/... → "Pinterest image"
 *   - creativefabrica.com/product/{slug}/ → titleized slug
 *   - direct image (.png/.jpg/.webp/.gif) → titleized basename
 *   - unknown → hostname (www. prefix stripped)
 *
 * Returns `null` only when URL parse fails (empty/invalid string).
 * Caller decides next fallback (asset metadata title, sourceUrl raw,
 * "Untitled", etc.).
 */

export function deriveTitleFromUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let urlObj: URL;
  try {
    urlObj = new URL(trimmed);
  } catch {
    return null;
  }
  const host = urlObj.host.toLowerCase();
  const pathParts = urlObj.pathname.split("/").filter(Boolean);

  // Etsy listing slug
  if (host.includes("etsy.com")) {
    const listingIdx = pathParts.indexOf("listing");
    const slug = listingIdx >= 0 ? pathParts[listingIdx + 2] : undefined;
    if (slug) return titleize(slug);
    return "Etsy image";
  }
  if (host.includes("etsystatic.com")) {
    return "Etsy image";
  }

  // Pinterest pin id
  if (host.includes("pinterest.")) {
    const pinIdx = pathParts.indexOf("pin");
    const pinId = pinIdx >= 0 ? pathParts[pinIdx + 1] : undefined;
    if (pinId) return `Pinterest pin ${pinId}`;
    return "Pinterest pin";
  }
  if (host.includes("pinimg.com")) {
    return "Pinterest image";
  }

  // Creative Fabrica product slug
  if (host.includes("creativefabrica.")) {
    const productIdx = pathParts.indexOf("product");
    const slug = productIdx >= 0 ? pathParts[productIdx + 1] : undefined;
    if (slug) return titleize(slug);
    return "Creative Fabrica image";
  }

  // Direct image — filename basename
  const last = pathParts[pathParts.length - 1] ?? "";
  if (/\.(png|jpe?g|webp|gif)$/i.test(last)) {
    const noExt = last.replace(/\.[a-z]+$/i, "");
    return titleize(noExt);
  }

  // Fallback: hostname
  return host.replace(/^www\./, "");
}

export function titleize(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w && w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}
