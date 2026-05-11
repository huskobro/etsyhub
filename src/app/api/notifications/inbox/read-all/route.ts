// R9 — POST /api/notifications/inbox/read-all
import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { markAllNotificationsRead } from "@/server/services/settings/notifications-inbox.service";

export const POST = withErrorHandling(async () => {
  const user = await requireUser();
  await markAllNotificationsRead(user.id);
  return NextResponse.json({ ok: true });
});
