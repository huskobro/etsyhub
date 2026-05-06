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
import { getStorage } from "@/providers/storage";
import { logger } from "@/lib/logger";
import type { ListingIndexView } from "@/features/listings/types";

// Pass 35 — Listing index thumbnail TTL. List endpoint kullanıcı /listings
// sayfasında kaldıkça bir defa fetch edilir (React Query staleTime 30s);
// browser cache 1h thumbnail'leri tutar.
const LISTING_THUMBNAIL_TTL_SECONDS = 3600;

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

  // Pass 35 — Cover render thumbnail batch fetch. Listing kart'ında signed
  // URL ile thumbnail göstermek için coverRenderId → MockupRender.thumbnailKey
  // (yoksa outputKey) → storage signed URL.
  //
  // Önce sadece coverRenderId set ve render SUCCESS olanları çek; render
  // pending/failed listing'ler thumbnailUrl: null kalır (UI fallback gösterir).
  // N+1 yerine in-array.
  const coverRenderIds = listings
    .map((l) => l.coverRenderId)
    .filter((id): id is string => id !== null);
  const renders =
    coverRenderIds.length > 0
      ? await db.mockupRender.findMany({
          where: { id: { in: coverRenderIds } },
          select: {
            id: true,
            status: true,
            thumbnailKey: true,
            outputKey: true,
          },
        })
      : [];
  const renderById = new Map(renders.map((r) => [r.id, r]));

  // Storage signed URL — best-effort; fail thumbnailUrl: null bırakır
  // (listing yine listelenir). thumbnailKey önceliği — outputKey fallback.
  const storage = getStorage();
  const thumbnailByListingId = new Map<string, string>();
  await Promise.all(
    listings.map(async (l) => {
      if (!l.coverRenderId) return;
      const render = renderById.get(l.coverRenderId);
      if (!render || render.status !== "SUCCESS") return;
      const key = render.thumbnailKey ?? render.outputKey;
      if (!key) return;
      try {
        const url = await storage.signedUrl(
          key,
          LISTING_THUMBNAIL_TTL_SECONDS,
        );
        thumbnailByListingId.set(l.id, url);
      } catch (err) {
        logger.warn(
          {
            listingId: l.id,
            renderId: l.coverRenderId,
            err: err instanceof Error ? err.message : String(err),
          },
          "listing index thumbnail signed URL failed",
        );
      }
    }),
  );

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
    coverThumbnailUrl: thumbnailByListingId.get(l.id) ?? null,
  }));

  return NextResponse.json({ listings: view });
});
