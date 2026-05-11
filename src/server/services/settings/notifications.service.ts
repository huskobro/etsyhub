// R8 — Notifications preferences persistence (UserSetting key="notifications").
//
// Persistence-only: in-app signal toggles. Desktop push + email digest
// hâlâ R9+ (capability missing). Pane'de R9 placeholder olarak kalır.

import { z } from "zod";
import { db } from "@/server/db";

const SETTING_KEY = "notifications";

export const NotificationsPrefsSchema = z.object({
  batchCompleted: z.boolean().default(true),
  batchFailed: z.boolean().default(true),
  reviewDecision: z.boolean().default(true),
  listingSubmitted: z.boolean().default(true),
  magicEraser: z.boolean().default(true),
  /** Desktop push — R9 capability. Toggle UI'da gri kalır. */
  desktopPush: z.boolean().default(false),
  /** Daily email digest — R9 capability. */
  dailyEmailDigest: z.boolean().default(false),
});

export type NotificationsPrefs = z.infer<typeof NotificationsPrefsSchema>;

const DEFAULTS: NotificationsPrefs = {
  batchCompleted: true,
  batchFailed: true,
  reviewDecision: true,
  listingSubmitted: true,
  magicEraser: true,
  desktopPush: false,
  dailyEmailDigest: false,
};

export async function getNotificationsPrefs(
  userId: string,
): Promise<NotificationsPrefs> {
  const row = await db.userSetting.findUnique({
    where: { userId_key: { userId, key: SETTING_KEY } },
  });
  if (!row) return DEFAULTS;
  const parsed = NotificationsPrefsSchema.safeParse(row.value);
  if (!parsed.success) return DEFAULTS;
  return parsed.data;
}

export async function updateNotificationsPrefs(
  userId: string,
  input: Partial<NotificationsPrefs>,
): Promise<NotificationsPrefs> {
  const current = await getNotificationsPrefs(userId);
  const merged = NotificationsPrefsSchema.parse({ ...current, ...input });
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: merged },
    create: { userId, key: SETTING_KEY, value: merged },
  });
  return merged;
}
