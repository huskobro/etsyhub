// IA-29 (CLAUDE.md Madde V) — Folder/path bazlı productType mapping.
//
// Tek global `defaultProductTypeKey` 27+ klasörlü gerçek kütüphanelerde
// adaletsiz. Her klasör farklı tema olabilir (clipart / wall_art /
// printable). Operator klasör başına productType atar; mapping yoksa
// global default fallback; o da yoksa o asset için auto-enqueue
// yapılmaz (operator manual scope-trigger çekebilir).
//
// Pure / deterministic. Side effect yok.

// IA-29 (CLAUDE.md Madde V) — Convention-based folder → productType.
//
// Operatör root folder altında productType başına klasör açar:
//   <root>/clipart/...
//   <root>/wall_art/...
//   <root>/bookmark/...
// Scan worker asset'in **bulunduğu üst klasör adına** bakar; ad
// bilinen bir productType key veya operatör tanımlı alias ise
// asset o productType'a mapping'lenir.
//
// Bilinmeyen ad (örn. "ekmek") → "pending" — UI'da listelenir,
// operatör seçer:
//   • bir productType klasörüne taşı (filesystem move),
//   • veya ignore et (mapping'e __ignore__ yaz).
//
// `folderProductTypeMap` artık iki rol oynar:
//   • alias: bilinmeyen ad için operatörün açtığı kapı
//     (örn. "wallart" → "wall_art"). Folder'ı taşımak yerine
//     mapping ekleyerek de çözebilir.
//   • ignore: bir klasörü atlamak için __ignore__ sentinel.

export const IGNORE_FOLDER_SENTINEL = "__ignore__" as const;

export const KNOWN_PRODUCT_TYPES = [
  "wall_art",
  "clipart",
  "sticker",
  "transparent_png",
  "bookmark",
  "printable",
] as const;

export type FolderProductTypeMap = Record<string, string>;

export type FolderResolution =
  | { kind: "mapped"; productTypeKey: string; reason: "convention" | "alias" }
  | { kind: "ignored" }
  | { kind: "pending"; folderName: string };

/**
 * Klasör adına göre productType çöz. Sıra:
 *   1. operator alias / ignore (folderProductTypeMap)
 *   2. convention: klasör adı bilinen bir productType ise
 *   3. pending (operatöre sorulacak)
 */
export function resolveLocalFolder(args: {
  folderName: string;
  folderMap: FolderProductTypeMap;
}): FolderResolution {
  const { folderName, folderMap } = args;
  if (!folderName) return { kind: "pending", folderName };

  const explicit = folderMap[folderName];
  if (explicit === IGNORE_FOLDER_SENTINEL) return { kind: "ignored" };
  if (explicit) {
    return { kind: "mapped", productTypeKey: explicit, reason: "alias" };
  }

  const normalized = folderName.toLowerCase().trim();
  for (const pt of KNOWN_PRODUCT_TYPES) {
    if (normalized === pt) {
      return { kind: "mapped", productTypeKey: pt, reason: "convention" };
    }
  }

  return { kind: "pending", folderName };
}

/**
 * Backwards-compat helper for callers that just want the productTypeKey
 * (or null). Worker auto-enqueue path bunu kullanır.
 */
export function resolveLocalProductTypeKey(args: {
  folderName: string;
  folderMap: FolderProductTypeMap;
}): string | null {
  const r = resolveLocalFolder(args);
  return r.kind === "mapped" ? r.productTypeKey : null;
}
