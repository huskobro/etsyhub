// Phase 100 — Frame export → Listing handoff endpoint (sözleşme #11 +
// #13.F).
//
// POST /api/listings/draft/[id]/add-frame-export — operator Studio'da
// ürettiği FrameExport'u Product detail'daki listing'e ekler. Body
// `setAsCover: true` ise listing hero olarak işaretlenir.
//
// Auth: requireUser. Service tarafında cross-user isolation (Listing
// + FrameExport ownership match). Madde V parity.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { addFrameExportToListing } from "@/features/listings/server/frame-export-handoff.service";

const BodySchema = z.object({
  frameExportId: z.string().min(1),
  setAsCover: z.boolean().optional(),
});

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();
    const json = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Geçersiz istek", parsed.error.flatten());
    }
    const result = await addFrameExportToListing({
      userId: user.id,
      listingId: ctx.params.id,
      frameExportId: parsed.data.frameExportId,
      ...(parsed.data.setAsCover !== undefined
        ? { setAsCover: parsed.data.setAsCover }
        : {}),
    });
    return NextResponse.json(result, { status: 200 });
  },
);
