/**
 * Ürün tipi anahtar kelime sözlüğü.
 *
 * Trend/listing başlık ve açıklamasından ürün tipi tespit etmek için.
 * OCR veya ürün tipi etiketinden bağımsız olarak signature güçlendirme.
 */

export const PRODUCT_TYPE_KEYWORDS: Readonly<Record<string, readonly string[]>> =
  {
    canvas: ["canvas"] as const,
    wall_art: ["wall art", "poster", "print"] as const,
    printable: ["printable", "digital download", "instant download"] as const,
    clipart: ["clipart", "clip art", "png pack", "svg bundle"] as const,
    sticker: ["sticker", "decal"] as const,
    tshirt: ["t-shirt", "tshirt", "tee"] as const,
    hoodie: ["hoodie", "sweatshirt"] as const,
    dtf: ["dtf", "dtf transfer", "dtf print"] as const,
  } as const;
