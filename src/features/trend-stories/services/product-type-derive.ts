import { normalizeForProductType } from "./normalize";
import { PRODUCT_TYPE_KEYWORDS } from "@/features/trend-stories/product-type-keywords";

export type ProductTypeDerivation = {
  key: string;
  source: "keyword_match" | "member_majority";
  confidence: number;
};

export function deriveProductTypeKey(memberTitles: string[]): ProductTypeDerivation | null {
  if (memberTitles.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const title of memberTitles) {
    const haystack = normalizeForProductType(title).join(" ");
    for (const [key, keywords] of Object.entries(PRODUCT_TYPE_KEYWORDS)) {
      if (keywords.some((kw) => haystack.includes(kw))) {
        counts[key] = (counts[key] ?? 0) + 1;
        break;
      }
    }
  }
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = entries[0];
  if (!top) return null;
  const [topKey, topCount] = top;
  const totalMatched = entries.reduce((acc, [, n]) => acc + n, 0);
  const confidence = Math.round((topCount / Math.max(memberTitles.length, 1)) * 100);
  // "keyword_match": tek üye ya da tüm eşleşen üyeler aynı kategoriye gidiyor (ayrışma yok).
  // "member_majority": birden çok kategori yarıştı, biri çoğunlukla kazandı.
  // Telemetri amaçlı — cluster productType atamasının güven kaynağını audit'te ayırır.
  const source = memberTitles.length === 1 || topCount === totalMatched
    ? "keyword_match"
    : "member_majority";
  return { key: topKey, source, confidence };
}
