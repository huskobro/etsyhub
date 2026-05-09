// R9 — GET /api/notifications/inbox
import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { listInbox } from "@/server/services/settings/notifications-inbox.service";

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const items = await listInbox(user.id);
  return NextResponse.json({ items });
});
