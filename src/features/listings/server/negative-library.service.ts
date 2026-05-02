// Phase 9 V1 Task 12 — Negative library service.
//
// Local curated blocked phrases (trademark, gibberish, Etsy policy violations).
// V1: hardcoded list; V2'de admin panel managed list.
//
// K3 soft warn: bulduğu eşleşmeleri readiness check'ine çevirir;
// submit blocked YOK. Sadece kullanıcıya UI'da uyarı.
//
// YASAK: external API (OpenAI Moderation, Perspective AI), "policy compliant"
// iddiası, AI moderation. Bu yalnız regex/string match curated guidance.

/**
 * Curated blocked phrase entry.
 *
 * `phrase`: case-insensitive substring match (normalized lowercase).
 * `category`: bilgilendirme amaçlı (UI'da görünmez; debug/audit için).
 * `reason`: kullanıcıya gösterilecek Türkçe açıklama.
 */
export type BlockedPhrase = {
  phrase: string;
  category: "trademark" | "policy" | "spam" | "gibberish";
  reason: string;
};

/**
 * V1 hardcoded curated list. ~10-15 madde — net trademark + Etsy policy.
 *
 * V2'de admin panel managed (CLAUDE.md "Negative Library").
 */
export const BLOCKED_PHRASES: BlockedPhrase[] = [
  // Trademark — popular brands (CLAUDE.md examples)
  {
    phrase: "disney",
    category: "trademark",
    reason: "Disney marka koruması altında",
  },
  {
    phrase: "marvel",
    category: "trademark",
    reason: "Marvel marka koruması altında",
  },
  {
    phrase: "nike",
    category: "trademark",
    reason: "Nike marka koruması altında",
  },
  {
    phrase: "nfl",
    category: "trademark",
    reason: "NFL marka koruması altında",
  },
  {
    phrase: "taylor swift",
    category: "trademark",
    reason: "Celebrity name kullanımı yasak",
  },

  // Etsy policy — yasak ürün kategorileri (Etsy seller policy)
  {
    phrase: "cbd",
    category: "policy",
    reason: "Etsy CBD ürünleri kabul etmiyor",
  },
  {
    phrase: "vape",
    category: "policy",
    reason: "Etsy vape ürünleri kabul etmiyor",
  },
  {
    phrase: "weapon",
    category: "policy",
    reason: "Etsy silah ürünleri kabul etmiyor",
  },
  {
    phrase: "firearm",
    category: "policy",
    reason: "Etsy ateşli silah ürünleri kabul etmiyor",
  },

  // Spam patterns
  {
    phrase: "best deal",
    category: "spam",
    reason: "Spam tonlu ifade; Etsy SEO için zararlı",
  },
  {
    phrase: "100% free",
    category: "spam",
    reason: "Spam tonlu ifade",
  },
  {
    phrase: "click here",
    category: "spam",
    reason: "Spam tonlu ifade",
  },
];

/**
 * Negative library match.
 *
 * `field`: "title" | "description" | "tags" — mevcut ReadinessCheck.field
 * union'ından (yeni union value EKLENMEZ; mevcut field reuse).
 * `phrase`: hangi blocked phrase eşleşti.
 * `reason`: kullanıcıya gösterilecek mesaj.
 */
export type NegativeLibraryMatch = {
  field: "title" | "description" | "tags";
  phrase: string;
  reason: string;
};

/**
 * Listing içeriğinde blocked phrase var mı tara.
 *
 * Deterministik: case-insensitive normalized substring match.
 * V1: regex ile word-boundary kullanmıyor (basit substring); örn. "disney"
 * "disneyland"da match eder. V1.1'de word-boundary refinement eklenebilir.
 *
 * @param input  Listing metadata (title/description/tags optional)
 * @returns      Match'lerin array'i (boş array = içerik temiz)
 */
export function checkNegativeLibrary(input: {
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
}): NegativeLibraryMatch[] {
  const matches: NegativeLibraryMatch[] = [];

  const titleLower = (input.title ?? "").toLowerCase();
  const descriptionLower = (input.description ?? "").toLowerCase();
  const tagsLower = (input.tags ?? []).map((t) => t.toLowerCase());

  for (const blocked of BLOCKED_PHRASES) {
    const phraseLower = blocked.phrase.toLowerCase();

    if (titleLower.includes(phraseLower)) {
      matches.push({
        field: "title",
        phrase: blocked.phrase,
        reason: blocked.reason,
      });
    }

    if (descriptionLower.includes(phraseLower)) {
      matches.push({
        field: "description",
        phrase: blocked.phrase,
        reason: blocked.reason,
      });
    }

    for (const tag of tagsLower) {
      if (tag.includes(phraseLower)) {
        matches.push({
          field: "tags",
          phrase: blocked.phrase,
          reason: blocked.reason,
        });
        break; // Aynı phrase için tek tag entry yeterli (multi-tag spam önle)
      }
    }
  }

  return matches;
}
