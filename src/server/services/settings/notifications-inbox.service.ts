// R9 — Notifications inbox + delivery layer.
//
// In-app notification persistence: UserSetting key="inbox" altında JSON
// array (FIFO ring buffer, max 50). Yeni model açmıyoruz; mevcut UserSetting
// key/value paterni yeterli.
//
// Delivery routing:
//   · notifyUser({ userId, kind, title, body, ... })
//   · NotificationsPrefs (R8) check edilir — preference disabled ise
//     skip (kayıt da yapılmaz).
//   · Persist edilirse "unread" olarak inbox'a eklenir.
//
// Desktop/email delivery R10+ — şu an sadece persist + UI inbox.

import { z } from "zod";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { getNotificationsPrefs } from "./notifications.service";

const SETTING_KEY = "inbox";
const MAX_INBOX = 50;

export const NotificationKindEnum = z.enum([
  "batchCompleted",
  "batchFailed",
  "reviewDecision",
  "listingSubmitted",
  "magicEraser",
  /** R9 — recipe run audit notifyUser ile inbox'a yazılır. */
  "recipeRun",
  /** R9 — mockup activate notifyUser ile sinyal verir. */
  "mockupActivated",
]);

export type NotificationKind = z.infer<typeof NotificationKindEnum>;

export const NotificationItemSchema = z.object({
  id: z.string(),
  kind: NotificationKindEnum,
  title: z.string(),
  body: z.string().nullable().default(null),
  href: z.string().nullable().default(null),
  read: z.boolean().default(false),
  createdAt: z.string(),
});

export type NotificationItem = z.infer<typeof NotificationItemSchema>;

const InboxSchema = z.object({
  items: z.array(NotificationItemSchema).default([]),
});

async function getInbox(userId: string): Promise<NotificationItem[]> {
  const row = await db.userSetting.findUnique({
    where: { userId_key: { userId, key: SETTING_KEY } },
  });
  if (!row) return [];
  const parsed = InboxSchema.safeParse(row.value);
  if (!parsed.success) return [];
  return parsed.data.items;
}

async function persistInbox(
  userId: string,
  items: NotificationItem[],
): Promise<void> {
  const trimmed = items.slice(0, MAX_INBOX);
  await db.userSetting.upsert({
    where: { userId_key: { userId, key: SETTING_KEY } },
    update: { value: { items: trimmed } },
    create: { userId, key: SETTING_KEY, value: { items: trimmed } },
  });
}

export type NotifyInput = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
};

/**
 * Yeni notification dispatch — kullanıcı tercihlerine göre filter, persist.
 */
export async function notifyUser(input: NotifyInput): Promise<{
  delivered: boolean;
  reason?: string;
}> {
  const prefs = await getNotificationsPrefs(input.userId);

  // Preference filter — pref alanı yoksa default true (recipeRun /
  // mockupActivated R9 yeni; preference UI bu kindleri henüz toggle
  // etmiyor, daima delivered).
  const enabledMap: Record<NotificationKind, boolean> = {
    batchCompleted: prefs.batchCompleted,
    batchFailed: prefs.batchFailed,
    reviewDecision: prefs.reviewDecision,
    listingSubmitted: prefs.listingSubmitted,
    magicEraser: prefs.magicEraser,
    recipeRun: true,
    mockupActivated: true,
  };
  if (!enabledMap[input.kind]) {
    return { delivered: false, reason: "preference-disabled" };
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: NotificationItem = {
    id,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
    read: false,
    createdAt: new Date().toISOString(),
  };

  try {
    const current = await getInbox(input.userId);
    await persistInbox(input.userId, [item, ...current]);
    return { delivered: true };
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, userId: input.userId, kind: input.kind },
      "notification persist failed",
    );
    return { delivered: false, reason: "persist-failed" };
  }
}

export async function listInbox(userId: string): Promise<NotificationItem[]> {
  return getInbox(userId);
}

export async function markNotificationRead(input: {
  userId: string;
  notificationId: string;
}): Promise<void> {
  const items = await getInbox(input.userId);
  const next = items.map((it) =>
    it.id === input.notificationId ? { ...it, read: true } : it,
  );
  await persistInbox(input.userId, next);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const items = await getInbox(userId);
  const next = items.map((it) => ({ ...it, read: true }));
  await persistInbox(userId, next);
}

export async function clearInbox(userId: string): Promise<void> {
  await persistInbox(userId, []);
}
