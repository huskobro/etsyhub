// R7 — General settings persistence (UserSetting key="general").
//
// Density / language / dateFormat / theme tercihi kullanıcı başına persist
// edilir. Settings registry pattern aiMode ile aynı (UserSetting key/value).
// Encryption gerekmiyor — sır değil; plain JSON.

import { z } from "zod";
import { db } from "@/server/db";

const SETTING_KEY = "general";

export const GeneralSettingsSchema = z.object({
  density: z.enum(["comfortable", "dense"]).default("comfortable"),
  language: z.enum(["en-US", "tr", "de"]).default("en-US"),
  dateFormat: z.enum(["relative", "iso"]).default("relative"),
  theme: z.enum(["light", "dark"]).default("light"),
});

export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;

const DEFAULTS: GeneralSettings = {
  density: "comfortable",
  language: "en-US",
  dateFormat: "relative",
  theme: "light",
};

export async function getGeneralSettings(
  userId: string,
): Promise<GeneralSettings> {
  const row = await db.userSetting.findUnique({
    where: { userId_key: { userId, key: SETTING_KEY } },
  });
  if (!row) return DEFAULTS;
  const parsed = GeneralSettingsSchema.safeParse(row.value);
  if (!parsed.success) return DEFAULTS;
  return parsed.data;
}

export async function updateGeneralSettings(
  userId: string,
  input: Partial<GeneralSettings>,
): Promise<GeneralSettings> {
  const current = await getGeneralSettings(userId);
  const merged = GeneralSettingsSchema.parse({ ...current, ...input });
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: merged },
    create: { userId, key: SETTING_KEY, value: merged },
  });
  return merged;
}
