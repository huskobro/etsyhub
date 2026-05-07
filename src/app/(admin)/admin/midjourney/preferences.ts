// Pass 70 — MJ-spesifik kullanıcı tercihlerinin typed registry'si.
//
// AutoSail eklenti audit'inden ilham (Pass 70 audit):
// AutoSail tüm ayarlarını tek `TAMPER_MIDJOURNEY_STORAGE_SETTINGS`
// localStorage anahtarında JSON olarak tutuyor (100+ field). Her özellik
// (auto-download, sendMode, intervalTime, downloadFolder, vs) tek
// noktadan okunup yazılıyor.
//
// Bizim mimari farklı:
//   - Ürün operatör-yetkili (admin), eklenti gibi anonim değil
//   - Operasyonel davranışlar (rate-limit/scheduling/auto-retry) BullMQ
//     worker katmanında zaten var; UI tarafı sadece "kullanıcı seçimleri"
//   - Settings Registry CLAUDE.md ürün anayasasında bir gelecek katman;
//     bu file şimdilik admin/midjourney scope'unda **lokal preferences
//     registry**'i — ileride server-side Settings Registry'ye taşınabilir
//
// Build now (Pass 70):
//   - default-export-format (zaten Pass 64'te var)
//   - **auto-promote-after-completion** (yeni — generate COMPLETED'da
//     "promote prompt" otomatik açılsın mı; default false, opt-in)
//
// Strong follow-up (gelecek pass'ler):
//   - rate-limit / send interval (bridge worker'da BullMQ delay)
//   - filename rename rules (selection-export'a entegre)
//   - banned words detect (Negative Library zaten var; sadece UI hook)
//   - random pre/suffix (prompt mühendislik)

import {
  EXPORT_FORMAT_VALUES,
  isExportFormat,
  type ExportFormatPref,
} from "./useLocalStoragePref";

/**
 * MJ admin scope'unda saklanan kullanıcı tercihleri tipi.
 *
 * Her field'ın:
 *   - storage key (localStorage `mj-pref:{key}` formatında)
 *   - default value
 *   - tip + validator
 *   - kısa açıklama (admin UI tooltip)
 * burada tek noktada tanımlanır.
 */
export type MJPreferences = {
  /** Pass 64 — varsayılan export format (PNG/JPEG/WebP). */
  defaultExportFormat: ExportFormatPref;
  /**
   * Pass 70 — generate COMPLETED state'inde admin UI'da "Promote to
   * Review" panelinin otomatik genişlemesi. AutoSail'in
   * `customImagesDownloadAfterImagine` davranışının operatör-dostu
   * eşdeğeri (otomatik indirme değil, otomatik **operasyonel akış
   * önerisi**).
   *
   * Default false (opt-in) — operatör onaylamadan promote etmek
   * Review queue'yu kirletir.
   */
  autoExpandPromoteAfterCompletion: boolean;
};

export const DEFAULT_MJ_PREFERENCES: MJPreferences = {
  defaultExportFormat: "png",
  autoExpandPromoteAfterCompletion: false,
};

/**
 * Validator registry — admin UI tek formdan oku/yaz pattern'i için.
 * Her preference key'i için tip-güvenli validate + parse + serialize.
 */
type PrefDef<K extends keyof MJPreferences> = {
  key: K;
  storageKey: string;
  default: MJPreferences[K];
  /** localStorage'tan gelen raw string'i validate + parse. */
  parse: (raw: string) => MJPreferences[K] | null;
  /** Memory'deki value'yu localStorage'a string olarak yaz. */
  serialize: (value: MJPreferences[K]) => string;
  /** UI etiketi. */
  label: string;
  /** Tooltip metni. */
  description: string;
};

const BOOL_PARSE = (raw: string): boolean | null =>
  raw === "true" ? true : raw === "false" ? false : null;
const BOOL_SERIALIZE = (v: boolean): string => (v ? "true" : "false");

export const MJ_PREFERENCE_DEFS = {
  defaultExportFormat: {
    key: "defaultExportFormat" as const,
    storageKey: "default-export-format",
    default: DEFAULT_MJ_PREFERENCES.defaultExportFormat,
    parse: (raw: string) => (isExportFormat(raw) ? raw : null),
    serialize: (v: ExportFormatPref) => v,
    label: "Varsayılan export formatı",
    description:
      "Tekli (detail) + toplu (list) export butonlarında öne çıkan format.",
  } satisfies PrefDef<"defaultExportFormat">,
  autoExpandPromoteAfterCompletion: {
    key: "autoExpandPromoteAfterCompletion" as const,
    storageKey: "auto-expand-promote",
    default: DEFAULT_MJ_PREFERENCES.autoExpandPromoteAfterCompletion,
    parse: BOOL_PARSE,
    serialize: BOOL_SERIALIZE,
    label: "Auto-expand: Promote paneli (COMPLETED sonrası)",
    description:
      "Generate tamamlandığında detail page'de Promote to Review paneli otomatik açık gelsin (opt-in; operatör hâlâ Reference + ProductType seçer ve manuel onaylar).",
  } satisfies PrefDef<"autoExpandPromoteAfterCompletion">,
} as const;

export const ALL_PREFERENCE_KEYS = Object.keys(
  MJ_PREFERENCE_DEFS,
) as Array<keyof MJPreferences>;

/** Export format değerleri (Pass 64). UI dropdown için. */
export { EXPORT_FORMAT_VALUES };
export type { ExportFormatPref };
