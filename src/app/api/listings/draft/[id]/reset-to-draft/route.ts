// Phase 9 V1 — Listing FAILED → DRAFT reset endpoint (recovery action).
//
// Submit sonrası FAILED state'inde olan listing'i kullanıcının manuel olarak
// DRAFT'a çevirebilmesini sağlar. Etsy taraf orphan listing varsa:
//   - V1: kullanıcıya net mesaj — Etsy admin'de manuel sil/yönet
//   - DB temizliği: etsyListingId, failedReason, submittedAt, publishedAt → null
//
// Auth + ownership + status guard (sadece FAILED → DRAFT). Mevcut
// state.ts dokunulmaz; kapsam çok dar, service-local guard yeterli.
//
// Honest fail: cross-user 404, soft-deleted 404, status DRAFT/PUBLISHED 409.
// Etsy provider çağrısı YOK (V1 sözleşmesi: orphan kullanıcı admin'de yönetir).

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError, AppError } from "@/lib/errors";
import { ListingDraftPathSchema } from "@/features/listings/schemas";
import { db } from "@/server/db";

// R11 — Next.js route file'da class export yasak; local helper class.
class ListingResetNotFoundError extends AppError {
  constructor() {
    super("Listing bulunamadı", "LISTING_RESET_NOT_FOUND", 404);
  }
}

class ListingResetInvalidStateError extends AppError {
  constructor(currentStatus: string) {
    super(
      `Sadece FAILED durumundaki listing'ler DRAFT'a çevrilebilir (mevcut: ${currentStatus})`,
      "LISTING_RESET_INVALID_STATE",
      409,
    );
  }
}

export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();

    const params = ListingDraftPathSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    const listing = await db.listing.findUnique({
      where: { id: params.data.id },
      select: {
        id: true,
        userId: true,
        status: true,
        etsyListingId: true,
        deletedAt: true,
      },
    });

    if (!listing || listing.userId !== user.id || listing.deletedAt !== null) {
      throw new ListingResetNotFoundError();
    }

    if (listing.status !== "FAILED") {
      throw new ListingResetInvalidStateError(listing.status);
    }

    // Reset — etsyListingId Etsy'de orphan kalabilir; UI bunu kullanıcıya bildirir.
    const previousEtsyListingId = listing.etsyListingId;

    await db.listing.update({
      where: { id: listing.id },
      data: {
        status: "DRAFT",
        etsyListingId: null,
        failedReason: null,
        submittedAt: null,
        publishedAt: null,
      },
    });

    return NextResponse.json({
      status: "DRAFT",
      previousEtsyListingId,
    });
  },
);
