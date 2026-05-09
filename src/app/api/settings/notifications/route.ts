// R8 — GET / PUT /api/settings/notifications
import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  NotificationsPrefsSchema,
  getNotificationsPrefs,
  updateNotificationsPrefs,
} from "@/server/services/settings/notifications.service";

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const settings = await getNotificationsPrefs(user.id);
  return NextResponse.json({ settings });
});

export const PUT = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json().catch(() => null);
  const parsed = NotificationsPrefsSchema.partial().safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz bildirim ayarı", parsed.error.flatten());
  }
  const settings = await updateNotificationsPrefs(user.id, parsed.data);
  return NextResponse.json({ settings });
});
