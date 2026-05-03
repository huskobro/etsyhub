// Phase 9 V1 Task 14+15 — GET + PATCH /api/listings/draft/[id].
//
// Spec §6.2 + §6.3:
//   - GET: ListingDraftView (read-only, polling-uygun) — K6 lock: legacy alanlar expose YASAK
//   - PATCH: metadata update (UpdateListingMetaSchema strict 6 field)
//   - Auth: requireUser; cross-user 404
//   - Status guard PATCH: sadece DRAFT veya NEEDS_REVIEW (terminal'de 409)
//   - Readiness server-side compute (Task 8 readiness service)
//
// Phase 8 emsali: src/app/api/mockup/jobs/[jobId]/route.ts.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError, AppError } from "@/lib/errors";
import { db } from "@/server/db";
import {
  ListingDraftPathSchema,
  UpdateListingMetaSchema,
} from "@/features/listings/schemas";
import type {
  ListingDraftView,
  ListingImageOrderEntry,
} from "@/features/listings/types";
import { computeReadiness } from "@/features/listings/server/readiness.service";
import { isListingEditable } from "@/features/listings/server/state";
import type { EtsyConnection, Listing } from "@prisma/client";

/**
 * Phase 9 V1 — Listing fetch için store→etsyConnection nested type.
 * GET handler join'inde kullanılır; helper'a tipli aktarılır.
 */
type ListingWithEtsyConnection = Listing & {
  store: { etsyConnection: EtsyConnection | null } | null;
};

// ────────────────────────────────────────────────────────────
// Custom errors (AppError extend, withErrorHandling HOF auto-map)
// ────────────────────────────────────────────────────────────

export class ListingDraftNotFoundError extends AppError {
  constructor() {
    super("Listing draft bulunamadı", "LISTING_DRAFT_NOT_FOUND", 404);
  }
}

export class ListingNotEditableError extends AppError {
  constructor() {
    super(
      "Listing draft bu durumda düzenlenemez (terminal status)",
      "LISTING_NOT_EDITABLE",
      409,
    );
  }
}

// ────────────────────────────────────────────────────────────
// Helper: Listing → ListingDraftView mapper (DRY için)
// ────────────────────────────────────────────────────────────

function buildListingDraftView(
  listing: Listing,
  etsyConnection: EtsyConnection | null = null,
): ListingDraftView {
  const readiness = computeReadiness(listing);
  // Phase 9 V1 — Submit sonrası UX paketi: shopId varsa shop bilgisi expose;
  // shopId null veya connection yoksa null (kullanıcı bağlantı kurmadı /
  // OAuth callback shopId resolve etmedi).
  const etsyShop =
    etsyConnection && etsyConnection.shopId
      ? { shopId: etsyConnection.shopId, shopName: etsyConnection.shopName }
      : null;
  return {
    id: listing.id,
    status: listing.status,
    mockupJobId: listing.mockupJobId,
    coverRenderId: listing.coverRenderId,
    imageOrder:
      (listing.imageOrderJson as ListingImageOrderEntry[] | null) ?? [],
    title: listing.title,
    description: listing.description,
    tags: listing.tags,
    category: listing.category,
    priceCents: listing.priceCents,
    materials: listing.materials,
    submittedAt: listing.submittedAt?.toISOString() ?? null,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    etsyListingId: listing.etsyListingId,
    failedReason: listing.failedReason,
    readiness,
    etsyShop,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

// ────────────────────────────────────────────────────────────
// GET handler (Task 14)
// ────────────────────────────────────────────────────────────

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();

    const params = ListingDraftPathSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    // Phase 9 V1 — Submit sonrası UX paketi: store→etsyConnection nested
    // include (single query). Listing.storeId null olabilir (legacy listing'ler);
    // store da null dönebilir; helper bu durumu null connection ile handle ediyor.
    const listing = (await db.listing.findUnique({
      where: { id: params.data.id },
      include: {
        store: {
          include: {
            etsyConnection: true,
          },
        },
      },
    })) as ListingWithEtsyConnection | null;

    if (!listing || listing.userId !== user.id) {
      throw new ListingDraftNotFoundError();
    }

    return NextResponse.json({
      listing: buildListingDraftView(
        listing,
        listing.store?.etsyConnection ?? null,
      ),
    });
  },
);

// ────────────────────────────────────────────────────────────
// PATCH handler (Task 15)
// ────────────────────────────────────────────────────────────

export const PATCH = withErrorHandling(
  async (req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();

    const params = ListingDraftPathSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    const json = await req.json().catch(() => ({}));
    const body = UpdateListingMetaSchema.safeParse(json);
    if (!body.success) {
      throw new ValidationError("Geçersiz body", body.error.flatten());
    }

    // Ownership check
    const existing = await db.listing.findUnique({
      where: { id: params.data.id },
      select: { userId: true, status: true },
    });

    if (!existing || existing.userId !== user.id) {
      throw new ListingDraftNotFoundError();
    }

    // Status guard
    if (!isListingEditable(existing.status)) {
      throw new ListingNotEditableError();
    }

    const updated = await db.listing.update({
      where: { id: params.data.id },
      data: body.data,
    });

    return NextResponse.json({ listing: buildListingDraftView(updated) });
  },
);
