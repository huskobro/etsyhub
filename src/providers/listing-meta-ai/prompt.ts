/**
 * Listing metadata prompt — Phase 9 V1 hardcoded baseline.
 *
 * VERSIYON DEĞİŞİKLİĞİ: LISTING_META_PROMPT_VERSION bump et + service
 * snapshot'ında kullan. Phase 6 emsali (REVIEW_PROMPT_VERSION).
 *
 * Master prompt admin UI carry-forward — V1.1+.
 */

export const LISTING_META_PROMPT_VERSION = "v1.0";

export const LISTING_META_SYSTEM_PROMPT = `Sen bir Etsy ürün listing yazarısın. Verilen ürün bilgilerinden Etsy SEO uyumlu metadata üret.

KESİN KURALLAR:
- Yalnızca aşağıdaki JSON şemasında döndür: { "title": string, "description": string, "tags": string[] }
- title: 5-140 karakter (Etsy limiti). Anahtar kelimeleri başa koy.
- description: en az 50 karakter, ürün avantajlarını ve kullanım senaryolarını anlat.
- tags: tam olarak 13 tag. Her tag 1-20 karakter. Sadece harf/boşluk/tire. Anahtar kelime varyasyonları, hedef kitle, stil, kullanım senaryoları.
- JSON anahtarlarını ASLA Türkçeleştirme: "title", "description", "tags" tam olarak kalır.
- Değerler İngilizce yaz (Etsy global market). Telif hakkı/marka ismi (Disney, Marvel, Nike vb.) ÜRETME.
- Hiçbir promosyon dili kullanma ("buy now", "sale" gibi). Etsy spam policy.
- JSON dışında metin YAZMA.`;

export function buildListingMetaUserPrompt(input: {
  productType: string;
  currentTitle: string | null;
  currentDescription: string | null;
  currentTags: string[];
  category: string | null;
  materials: string[];
  toneHint?: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`Ürün tipi: ${input.productType}`);
  if (input.category) lines.push(`Kategori: ${input.category}`);
  if (input.materials.length > 0) lines.push(`Malzemeler: ${input.materials.join(", ")}`);
  if (input.currentTitle) lines.push(`Mevcut başlık (referans): ${input.currentTitle}`);
  if (input.currentDescription) lines.push(`Mevcut açıklama (referans): ${input.currentDescription}`);
  if (input.currentTags.length > 0) lines.push(`Mevcut tags (referans): ${input.currentTags.join(", ")}`);
  if (input.toneHint) lines.push(`Ton: ${input.toneHint}`);
  lines.push("");
  lines.push("Yukarıdaki bilgilerden Etsy listing metadata üret. Şemaya uy.");
  return lines.join("\n");
}
