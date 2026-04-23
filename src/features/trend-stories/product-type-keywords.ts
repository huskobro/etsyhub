/**
 * Ürün tipi anahtar kelime sözlüğü.
 *
 * Trend/listing başlık ve açıklamasından ürün tipi tespit etmek için.
 * OCR veya ürün tipi etiketinden bağımsız olarak signature güçlendirme.
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
