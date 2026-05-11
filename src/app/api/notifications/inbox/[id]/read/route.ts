// R9 — POST /api/notifications/inbox/[id]/read
import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { markNotificationRead } from "@/server/services/settings/notifications-inbox.service";

export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();
    await markNotificationRead({
      userId: user.id,
      notificationId: ctx.params.id,
    });
    return NextResponse.json({ ok: true });
  },
);
