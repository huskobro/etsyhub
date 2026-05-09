// R8 — Storage preferences (UserSetting key="storage").
//
// signedUrlTtlSeconds: pane'de TTL slider/input. Provider/bucket env'den
// gelir; bu service yalnız user-tunable kısmı yönetir.

import { z } from "zod";
import { db } from "@/server/db";

const SETTING_KEY = "storage";

export const StoragePrefsSchema = z.object({
  /** 5 dakika - 12 saat arası. Default 1 saat. */
  signedUrlTtlSeconds: z.number().int().min(300).max(43200).default(3600),
  /** Library / Selection thumbnail önbellekleme süresi (UI hint). */
  thumbnailCacheSeconds: z.number().int().min(300).max(86400).default(3600),
});

export type StoragePrefs = z.infer<typeof StoragePrefsSchema>;

const DEFAULTS: StoragePrefs = {
  signedUrlTtlSeconds: 3600,
  thumbnailCacheSeconds: 3600,
};

export async function getStoragePrefs(userId: string): Promise<StoragePrefs> {
  const row = await db.userSetting.findUnique({
    where: { userId_key: { userId, key: SETTING_KEY } },
  });
  if (!row) return DEFAULTS;
  const parsed = StoragePrefsSchema.safeParse(row.value);
  if (!parsed.success) return DEFAULTS;
  return parsed.data;
}

export async function updateStoragePrefs(
  userId: string,
  input: Partial<StoragePrefs>,
): Promise<StoragePrefs> {
  const current = await getStoragePrefs(userId);
  const merged = StoragePrefsSchema.parse({ ...current, ...input });
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: merged },
    create: { userId, key: SETTING_KEY, value: merged },
  });
  return merged;
}
