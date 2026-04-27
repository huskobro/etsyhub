// User Settings — local-library — Phase 5 §8 (Q3)
//
// User-level: rootFolderPath + targetResolution + targetDpi.
// Store-level override carry-forward (Phase 6+).
// UserSetting tablosu key="localLibrary" altında JSON value tutar.

import { z } from "zod";
import { db } from "@/server/db";
import {
  LocalLibrarySettingsSchema,
  DEFAULT_LOCAL_LIBRARY_SETTINGS,
  type LocalLibrarySettings,
} from "./schemas";

const SETTING_KEY = "localLibrary";

// Input type uses z.input → defaults (qualityThresholds, targetDpi) optional;
// eski caller'lar (qualityThresholds field eklenmeden önce) tip kırılması yaşamaz.
export type LocalLibrarySettingsInput = z.input<typeof LocalLibrarySettingsSchema>;

export async function getUserLocalLibrarySettings(
  userId: string,
): Promise<LocalLibrarySettings> {
  const row = await db.userSetting.findUnique({
    where: { userId_key: { userId, key: SETTING_KEY } },
  });
  if (!row) return DEFAULT_LOCAL_LIBRARY_SETTINGS;
  // Geriye uyumlu parse: eski row qualityThresholds içermiyorsa zod default uygular.
  return LocalLibrarySettingsSchema.parse(row.value);
}

export async function updateUserLocalLibrarySettings(
  userId: string,
  input: LocalLibrarySettingsInput,
): Promise<LocalLibrarySettings> {
  const parsed = LocalLibrarySettingsSchema.parse(input);
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: parsed },
    create: { userId, key: SETTING_KEY, value: parsed },
  });
  return parsed;
}
