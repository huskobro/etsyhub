// IA-29 + IA-35 (CLAUDE.md Madde V) — Folder/path bazlı productType
// mapping.
//
// Operator klasör başına productType atar; mapping yoksa convention
// devreye girer (folder adı bilinen bir productType ise); o da yoksa
// asset "pending" durumda kalır ve auto-enqueue yapılmaz (operator
// manual scope-trigger çekebilir veya Settings'te folder'a productType
// atayabilir).
//
// IA-35 — anahtar canonical `folderPath`. Aynı isimli farklı path'teki
// klasörler birbirini etkilemez. Legacy `folderName`-keyed mapping'ler
// fallback olarak okunmaya devam eder.
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

/**
 * IA-35 — mapping key path-based, display name ayrı.
 *
 * Eski kontrat: `Record<folderName, productTypeKey>`. Aynı isimli ama
 * farklı path'teki klasörler (ör. iki ayrı root'ta `clipart/`)
 * birbirini eziyordu. Yeni kontrat: anahtar **canonical folder path**
 * (LocalLibraryAsset.folderPath); display için folderName ayrı yaşar.
 *
 * Geriye uyumluluk: legacy `folderName`-keyed map'leri okumaya devam
 * ederiz (read-only fallback). Yeni yazılan tüm mapping'ler path
 * üzerinden kaydedilir.
 */
export type FolderProductTypeMap = Record<string, string>;

export type FolderResolution =
  | { kind: "mapped"; productTypeKey: string; reason: "convention" | "alias" }
  | { kind: "ignored" }
  | { kind: "pending"; folderName: string };

/**
 * Klasör adına/path'ine göre productType çöz. Sıra:
 *   1. operator alias / ignore — önce `folderPath` (canonical identity),
 *      yoksa legacy `folderName` fallback (eski mapping'ler)
 *   2. convention: klasör adı bilinen bir productType ise
 *   3. pending (operatöre sorulacak)
 *
 * `folderPath` opsiyonel — eski caller'lar yalnız folderName geçirebilir
 * (worker auto-enqueue path'ı henüz path bilgisini taşımıyorsa);
 * yeni caller'lar her zaman ikisini birlikte geçirir.
 */
export function resolveLocalFolder(args: {
  folderName: string;
  folderPath?: string;
  folderMap: FolderProductTypeMap;
}): FolderResolution {
  const { folderName, folderPath, folderMap } = args;
  if (!folderName) return { kind: "pending", folderName };

  // IA-35 — canonical path lookup (yeni mapping yazılım hedefi).
  if (folderPath) {
    const byPath = folderMap[folderPath];
    if (byPath === IGNORE_FOLDER_SENTINEL) return { kind: "ignored" };
    if (byPath) {
      return { kind: "mapped", productTypeKey: byPath, reason: "alias" };
    }
  }

  // Legacy fallback: eski folderName-keyed mapping'ler. Yeni mapping
  // yazıldığında bu satırlar overshadow olur; ama mevcut user
  // settings'leri kırmamak için okumaya devam.
  const byName = folderMap[folderName];
  if (byName === IGNORE_FOLDER_SENTINEL) return { kind: "ignored" };
  if (byName) {
    return { kind: "mapped", productTypeKey: byName, reason: "alias" };
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
  folderPath?: string;
  folderMap: FolderProductTypeMap;
}): string | null {
  const r = resolveLocalFolder(args);
  return r.kind === "mapped" ? r.productTypeKey : null;
}
