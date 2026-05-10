// User Settings — local-library — Phase 5 §8 (Q3)
//
// User-level: rootFolderPath + targetResolution + targetDpi.
// Store-level override carry-forward (Phase 6+).
// UserSetting tablosu key="localLibrary" altında JSON value tutar.

import { z } from "zod";

// Task 15 — qualityThresholds operator-facing setting (Settings Registry kuralı).
// LocalAssetCard hardcoded 75/40 magic number'larını bu kaynağa bağlar.
// Refine: 0 ≤ warn < ok ≤ 100. Geriye uyumluluk için zod default uygulanır,
// böylece eski persist edilmiş row'lar parse'da otomatik default alır.
export const QualityThresholdsSchema = z
  .object({
    ok: z.number().int().min(0).max(100),
    warn: z.number().int().min(0).max(100),
  })
  .refine((v) => v.warn < v.ok, {
    message: "warn eşiği ok eşiğinden küçük olmalı",
    path: ["warn"],
  });

export const DEFAULT_QUALITY_THRESHOLDS = { ok: 75, warn: 40 } as const;

export const LocalLibrarySettingsSchema = z.object({
  rootFolderPath: z.string().regex(/^\//, "absolute path required").nullable(),
  targetResolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  targetDpi: z.number().int().positive().default(300),
  qualityThresholds: QualityThresholdsSchema.default(DEFAULT_QUALITY_THRESHOLDS),
  // IA Phase 26 — default productTypeKey for local auto-review.
  // Local scan worker needs a productTypeKey to enqueue REVIEW_DESIGN
  // (Phase 6 Karar 3: silent default is forbidden upstream, but a
  // single user-chosen default in settings is explicit configuration,
  // not a silent guess). When set, the scan worker auto-enqueues
  // freshly discovered + never-scored assets so the operator doesn't
  // have to trigger every folder manually.
  // IA-29 (CLAUDE.md Madde V) — folder/path bazlı productType mapping.
  // Tek global default YOK. Operatör her klasör için açık seçim
  // yapar. Mapping olmayan klasörler için scan worker auto-enqueue
  // YAPMAZ; UI'da "pending mapping" listesinde belirir, operatör
  // atar veya `__ignore__` ile yok sayar.
  //
  // Anahtar folderName VEYA folderPath; değer productType key veya
  // `__ignore__` sentinel.
  folderProductTypeMap: z
    .record(
      z.string(),
      z.enum([
        "wall_art",
        "clipart",
        "sticker",
        "transparent_png",
        "bookmark",
        "printable",
        "__ignore__",
      ]),
    )
    .default({}),
});

export type LocalLibrarySettings = z.infer<typeof LocalLibrarySettingsSchema>;
export type QualityThresholds = z.infer<typeof QualityThresholdsSchema>;

export const DEFAULT_LOCAL_LIBRARY_SETTINGS: LocalLibrarySettings = {
  rootFolderPath: null,
  targetResolution: { width: 4000, height: 4000 },
  targetDpi: 300,
  qualityThresholds: { ok: 75, warn: 40 },
  folderProductTypeMap: {},
};
