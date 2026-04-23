/**
 * Ürün tipi anahtar kelime sözlüğü.
 *
 * Trend/listing başlık ve açıklamasından ürün tipi tespit etmek için.
 * OCR veya ürün tipi etiketinden bağımsız olarak signature güçlendirme.
 *
 * NOT: Sözlük sırası = match önceliği (first-match-wins, Object.entries
 * insertion order). Daha spesifik anahtarlar (canvas, printable, clipart)
 * `wall_art`'tan önce gelmeli; çünkü `wall_art` içindeki generic "print"
 * anahtarı "Printable Wall Art" gibi başlıklarda yanlış eşleşir.
 * Alfabetik sıralamaya çekme — testler ve spec bu sırayı varsayıyor.
 */

export const PRODUCT_TYPE_KEYWORDS: Record<string, string[]> = {
  canvas: ["canvas"],
  printable: ["printable", "digital download", "instant download"],
  clipart: ["clipart", "clip art", "png pack", "svg bundle"],
  sticker: ["sticker", "decal"],
  tshirt: ["t-shirt", "tshirt", "tee"],
  hoodie: ["hoodie", "sweatshirt"],
  dtf: ["dtf", "dtf transfer", "dtf print"],
  wall_art: ["wall art", "poster", "print"],
};
