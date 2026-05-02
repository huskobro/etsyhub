// Phase 9 V1 Task 18 — GET /api/listings index route.
//
// User'ın listing'lerini liste; status filter opsiyonel.
//   - Auth: requireUser
//   - Query: ?status=DRAFT|FAILED|... (opsiyonel, ListingStatus enum)
//   - Cross-user disipline: WHERE userId
//   - soft-delete filter: deletedAt: null
//   - Order: updatedAt DESC
//   - Response: { listings: ListingIndexView[] }
//   - readiness DÖNMEZ (perf — detail view'da)
//
// Phase 8 emsali: src/app/api/mockup/templates/route.ts (read-only liste).

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import type { ListingIndexView } from "@/features/listings/types";

const QuerySchema = z.object({
  status: z
    .enum([
      "DRAFT",
      "SCHEDULED",
      "PUBLISHED",
      "FAILED",
      "REJECTED",
      "NEEDS_REVIEW",
    ])
    .optional(),
});

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser();

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz query parametresi",
      parsed.error.flatten(),
    );
  }

  const listings = await db.listing.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  const view: ListingIndexView[] = listings.map((l) => ({
    id: l.id,
    status: l.status,
    mockupJobId: l.mockupJobId,
    coverRenderId: l.coverRenderId,
    title: l.title,
    priceCents: l.priceCents,
    submittedAt: l.submittedAt?.toISOString() ?? null,
    publishedAt: l.publishedAt?.toISOString() ?? null,
    etsyListingId: l.etsyListingId,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));

  return NextResponse.json({ listings: view });
});
