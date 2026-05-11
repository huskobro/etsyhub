// R9 — POST /api/notifications/inbox/clear
import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { clearInbox } from "@/server/services/settings/notifications-inbox.service";

export const POST = withErrorHandling(async () => {
  const user = await requireUser();
  await clearInbox(user.id);
  return NextResponse.json({ ok: true });
});
