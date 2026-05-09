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
import { getStorage } from "@/providers/storage";
import { logger } from "@/lib/logger";
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

// Pass 36 — Listing detail görsel signed URL TTL. Display-only; ZIP download
// endpoint outputKey'i ayrı kanaldan kullanır (auth bound).
const LISTING_DETAIL_IMAGE_TTL_SECONDS = 3600;

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

// R11 — Next.js route file'da class export yasak; local helper class.
class ListingDraftNotFoundError extends AppError {
  constructor() {
    super("Listing draft bulunamadı", "LISTING_DRAFT_NOT_FOUND", 404);
  }
}

class ListingNotEditableError extends AppError {
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

async function buildListingDraftView(
  listing: Listing,
  etsyConnection: EtsyConnection | null = null,
): Promise<ListingDraftView> {
  const readiness = computeReadiness(listing);
  // Phase 9 V1 — Submit sonrası UX paketi: shopId varsa shop bilgisi expose;
  // shopId null veya connection yoksa null (kullanıcı bağlantı kurmadı /
  // OAuth callback shopId resolve etmedi).
  const etsyShop =
    etsyConnection && etsyConnection.shopId
      ? { shopId: etsyConnection.shopId, shopName: etsyConnection.shopName }
      : null;

  // Pass 36 — imageOrder entry'lerinin signedUrl'i hesaplanır (UI display).
  // Pre-Pass 36: AssetSection `<img src={img.outputKey}>` raw storage key
  // ile 404 broken image alıyordu. Şimdi her outputKey için 1h TTL signed
  // URL paralel batch (Promise.all). Best-effort: storage fail bireysel
  // entry'de signedUrl: null bırakır; UI fallback "Görsel yok" gösterir.
  const rawImageOrder =
    (listing.imageOrderJson as ListingImageOrderEntry[] | null) ?? [];
  const storage = getStorage();
  const imageOrder = await Promise.all(
    rawImageOrder.map(async (entry) => {
      if (!entry.outputKey) return entry;
      try {
        const url = await storage.signedUrl(
          entry.outputKey,
          LISTING_DETAIL_IMAGE_TTL_SECONDS,
        );
        return { ...entry, signedUrl: url };
      } catch (err) {
        logger.warn(
          {
            listingId: listing.id,
            renderId: entry.renderId,
            outputKey: entry.outputKey,
            err: err instanceof Error ? err.message : String(err),
          },
          "listing detail image signed URL failed",
        );
        return { ...entry, signedUrl: null };
      }
    }),
  );

  return {
    id: listing.id,
    status: listing.status,
    mockupJobId: listing.mockupJobId,
    coverRenderId: listing.coverRenderId,
    imageOrder,
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
      listing: await buildListingDraftView(
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

    return NextResponse.json({ listing: await buildListingDraftView(updated) });
  },
);
