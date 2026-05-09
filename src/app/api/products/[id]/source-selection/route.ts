// R5 — GET /api/products/[id]/source-selection
//
// Product detail Mockups tab'ında "View source selection" cross-link için
// listing.mockupJobId → MockupJob.setId zincirini takip eden minimal
// endpoint. ListingDraftView shape'ine setId eklemekten kaçındık (Phase 9
// V1 contract sabit; minimal invaziv).
//
// Status mapping:
//   200 — { setId, setName }
//   404 — listing yok / cross-user / mockupJobId yok / set yok
//
// Boundary discipline: yalnız bu user'ın listing+mockup chain'i gösterilir;
// cross-user 404.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { db } from "@/server/db";

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();
    const listingId = ctx.params.id;

    const listing = await db.listing.findFirst({
      where: { id: listingId, userId: user.id, deletedAt: null },
      select: { id: true, mockupJobId: true },
    });
    if (!listing || !listing.mockupJobId) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const job = await db.mockupJob.findFirst({
      where: { id: listing.mockupJobId, userId: user.id },
      select: { setId: true },
    });
    if (!job) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const set = await db.selectionSet.findFirst({
      where: { id: job.setId, userId: user.id },
      select: { id: true, name: true },
    });
    if (!set) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    return NextResponse.json({ setId: set.id, setName: set.name });
  },
);
