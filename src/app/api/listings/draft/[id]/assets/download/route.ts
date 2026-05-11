// Phase 9 V1 — GET /api/listings/draft/[id]/assets/download route handler.
//
// Listing context'ten mockup ZIP indirme. Phase 8 buildMockupZip service'i
// REUSE eder; listing layer yalnız bridge:
//   1. Auth + ownership 404
//   2. Listing fetch + soft-delete guard
//   3. mockupJobId null guard → 409 (LISTING_ASSETS_NOT_READY)
//   4. buildMockupZip(listing.mockupJobId, userId) çağır
//      - Job ownership cross-check Phase 8 service içinde
//      - Status guard (COMPLETED/PARTIAL_COMPLETE) Phase 8 içinde
//      - Storage download + ZIP build + manifest Phase 8 içinde
//   5. Response: application/zip + Content-Disposition listing context
//
// Filename: listing-{etsyListingId || listingId}.zip
//   (Etsy submit sonrası etsyListingId varsa onu kullan; yoksa cuid)
//
// Phase 8 emsali: src/app/api/mockup/jobs/[jobId]/download/route.ts.
// Hata disiplini: try/catch + errorResponse (Phase 8 download route paterni;
// withErrorHandling HOF değil — emsalle bire bir).

import { requireUser } from "@/server/session";
import { errorResponse } from "@/lib/http";
import { ValidationError, AppError } from "@/lib/errors";
import { ListingDraftPathSchema } from "@/features/listings/schemas";
import { db } from "@/server/db";
import { buildMockupZip } from "@/features/mockups/server/download.service";

// ────────────────────────────────────────────────────────────
// Listing-specific typed errors (route-local — yeni service yok)
//
// Phase 8 buildMockupZip içinden fırlayan JobNotFoundError (404) ve
// JobNotDownloadableError (403) AppError extend ettiği için errorResponse
// otomatik HTTP'ye map eder; burada ayrıca yakalamaya gerek yok.
// ────────────────────────────────────────────────────────────

// R11 — Next.js Route file'da class export yasak; local helper class.
// Test'ler import etmek isterse `assets-download.errors.ts` ayrı modül.
class ListingDownloadNotFoundError extends AppError {
  constructor() {
    super("Listing bulunamadı", "LISTING_DOWNLOAD_NOT_FOUND", 404);
  }
}

class ListingAssetsNotReadyError extends AppError {
  constructor() {
    super(
      "Listing'in mockup paketi yok — ZIP indirilemez",
      "LISTING_ASSETS_NOT_READY",
      409,
    );
  }
}

// ────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  ctx: { params: { id: string } },
) {
  try {
    const user = await requireUser();

    // Path validation
    const params = ListingDraftPathSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    // Fetch listing — ownership + soft-delete guard
    const listing = await db.listing.findUnique({
      where: { id: params.data.id },
      select: {
        id: true,
        userId: true,
        mockupJobId: true,
        etsyListingId: true,
        deletedAt: true,
      },
    });

    if (!listing || listing.userId !== user.id || listing.deletedAt !== null) {
      throw new ListingDownloadNotFoundError();
    }

    // mockupJobId guard — handoff'tan gelmediyse veya FK SetNull ile
    // null'lanmışsa, ZIP üretilemez (honest fail; fake ZIP YOK).
    if (!listing.mockupJobId) {
      throw new ListingAssetsNotReadyError();
    }

    // Reuse Phase 8 ZIP service.
    // - JobNotFoundError → 404 (cross-user / silinmiş job; pass-through)
    // - JobNotDownloadableError → 403 (status COMPLETED/PARTIAL_COMPLETE değil)
    const { buffer } = await buildMockupZip(listing.mockupJobId, user.id);

    // Listing context filename: etsyListingId varsa onu kullan, yoksa cuid.
    const filename = listing.etsyListingId
      ? `listing-${listing.etsyListingId}.zip`
      : `listing-${listing.id}.zip`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
