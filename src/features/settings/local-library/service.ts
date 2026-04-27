// User Settings — local-library — Phase 5 §8 (Q3)
//
// User-level: rootFolderPath + targetResolution + targetDpi.
// Store-level override carry-forward (Phase 6+).
// UserSetting tablosu key="localLibrary" altında JSON value tutar.

import { db } from "@/server/db";
import {
  LocalLibrarySettingsSchema,
  DEFAULT_LOCAL_LIBRARY_SETTINGS,
  type LocalLibrarySettings,
} from "./schemas";

const SETTING_KEY = "localLibrary";

export async function getUserLocalLibrarySettings(
  userId: string,
): Promise<LocalLibrarySettings> {
  const row = await db.userSetting.findUnique({
    where: { userId_key: { userId, key: SETTING_KEY } },
  });
  if (!row) return DEFAULT_LOCAL_LIBRARY_SETTINGS;
  return LocalLibrarySettingsSchema.parse(row.value);
}

export async function updateUserLocalLibrarySettings(
  userId: string,
  input: LocalLibrarySettings,
): Promise<LocalLibrarySettings> {
  const parsed = LocalLibrarySettingsSchema.parse(input);
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: parsed },
    create: { userId, key: SETTING_KEY, value: parsed },
  });
  return parsed;
}
