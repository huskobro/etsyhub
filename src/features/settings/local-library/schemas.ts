// User Settings — local-library — Phase 5 §8 (Q3)
//
// User-level: rootFolderPath + targetResolution + targetDpi.
// Store-level override carry-forward (Phase 6+).
// UserSetting tablosu key="localLibrary" altında JSON value tutar.

import { z } from "zod";

export const LocalLibrarySettingsSchema = z.object({
  rootFolderPath: z.string().regex(/^\//, "absolute path required").nullable(),
  targetResolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  targetDpi: z.number().int().positive().default(300),
});

export type LocalLibrarySettings = z.infer<typeof LocalLibrarySettingsSchema>;

export const DEFAULT_LOCAL_LIBRARY_SETTINGS: LocalLibrarySettings = {
  rootFolderPath: null,
  targetResolution: { width: 4000, height: 4000 },
  targetDpi: 300,
};
