// Phase 100 — Frame export signed URL refresh (sözleşme #11 + #13.F).
//
// GET /api/frame/exports/[id]/signed-url — signed URL 5 dakika TTL
// sonrası operator için "linki yenile" akışı. Studio history viewer +
// Product detail handoff popover bu endpoint'i kullanır.
//
// Auth: requireUser + service-side ownership match (cross-user 404).

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { refreshFrameExportSignedUrl } from "@/server/services/frame/frame-export.service";

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();
    const result = await refreshFrameExportSignedUrl({
      userId: user.id,
      frameExportId: ctx.params.id,
    });
    return NextResponse.json(result, { status: 200 });
  },
);
