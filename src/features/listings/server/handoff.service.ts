// Phase 9 V1 Task 3 — Listing handoff service (foundation slice).
//
// MockupJob (Phase 8 terminal state) → Listing draft create (Phase 9 V1).
// Spec §2.1 (canonical akış) + §6.2 (handoff endpoint).
//
// K2 lock: AI meta üretimi handoff'ta YOK; metadata boş listing draft yaratılır,
// kullanıcı UI'dan "✨ AI ile üret" button ile sonradan üretir (Task 16).
// K5 lock: Etsy submit handoff'ta YOK; Task 10/17 dispatch'inde eklenir.
// K6 lock: Legacy alanlar (generatedDesignId, mockups[], etsyDraftId) dokunulmaz.
//
// Phase 8 emsali: src/features/mockups/server/handoff.service.ts.

import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import type { Prisma } from "@prisma/client";
import type { ListingImageOrderEntry } from "../types";

// ────────────────────────────────────────────────────────────
// Custom errors (AppError extend, withErrorHandling HOF map)
// ────────────────────────────────────────────────────────────

export class ListingHandoffJobNotFoundError extends AppError {
  constructor() {
    super("Mockup job bulunamadı", "MOCKUP_JOB_NOT_FOUND", 404);
  }
}

export class ListingHandoffJobNotTerminalError extends AppError {
  constructor() {
    super(
      "Mockup job henüz tamamlanmadı (COMPLETED veya PARTIAL_COMPLETE değil)",
      "MOCKUP_JOB_NOT_TERMINAL",
      409,
    );
  }
}

export class ListingHandoffJobAllFailedError extends AppError {
  constructor() {
    super(
      "Mockup job'ta hiç başarılı render yok; listing draft oluşturulamaz",
      "MOCKUP_JOB_ALL_FAILED",
      409,
    );
  }
}

const TERMINAL_STATUSES = ["COMPLETED", "PARTIAL_COMPLETE"] as const;

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

/**
 * MockupJob → Listing draft handoff (Phase 9 V1 foundation).
 *
 * Atomik akış:
 *   1. MockupJob fetch + renders include (SUCCESS only, packPosition ASC)
 *   2. Cross-user / yok → ListingHandoffJobNotFoundError (404)
 *   3. Status guard (terminal değil) → ListingHandoffJobNotTerminalError (409)
 *   4. successRenders === 0 → ListingHandoffJobAllFailedError (409)
 *   5. imageOrderJson snapshot (success render'lar packPosition ASC, cover
 *      invariant korunur)
 *   6. Atomic tx: Listing create
 *      - status: DRAFT
 *      - mockupJobId, coverRenderId, imageOrderJson snapshot
 *      - metadata (title/description/tags/category/price) null/boş
 *        (K2 lock: AI meta manuel button ile sonra)
 *      - userId, storeId Phase 8 mockupJob'tan miras (storeId V1'de null
 *        kalabilir; Task 27 Etsy connection sonrası set edilir)
 *   7. Return { listingId }
 *
 * @param mockupJobId Source MockupJob id (Phase 8 terminal state)
 * @param userId      Current user (cross-user 404 disipline)
 */
export async function createListingDraftFromMockupJob(
  mockupJobId: string,
  userId: string,
): Promise<{ listingId: string }> {
  // 1. Fetch + ownership
  const job = await db.mockupJob.findUnique({
    where: { id: mockupJobId },
    include: {
      renders: {
        where: { status: "SUCCESS", outputKey: { not: null } },
        orderBy: { packPosition: "asc" },
      },
    },
  });

  // 2. 404 (cross-user veya yok)
  if (!job || job.userId !== userId) {
    throw new ListingHandoffJobNotFoundError();
  }

  // 3. Status guard
  if (!(TERMINAL_STATUSES as readonly string[]).includes(job.status)) {
    throw new ListingHandoffJobNotTerminalError();
  }

  // 4. All failed guard
  if (job.successRenders === 0 || job.renders.length === 0) {
    throw new ListingHandoffJobAllFailedError();
  }

  // 5. ImageOrder snapshot
  const imageOrder: ListingImageOrderEntry[] = job.renders
    .filter((r) => r.outputKey !== null && r.packPosition !== null)
    .map((r) => {
      const tplSnapshot = r.templateSnapshot as
        | { templateName?: string }
        | null;
      return {
        packPosition: r.packPosition!,
        renderId: r.id,
        outputKey: r.outputKey!,
        templateName: tplSnapshot?.templateName ?? "Bilinmeyen şablon",
        isCover: r.packPosition === 0,
      };
    });

  // 6. Atomic Listing create
  const listing = await db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      return tx.listing.create({
        data: {
          userId,
          status: "DRAFT",
          // Phase 8 köprü alanları (Phase 9 yeni eklenenler)
          mockupJobId: job.id,
          coverRenderId: job.coverRenderId,
          imageOrderJson: imageOrder as unknown as Prisma.InputJsonValue,
          // Metadata boş — K2 lock: AI meta manuel button ile sonra
          // Legacy alanlar (generatedDesignId, etsyDraftId) — K6 lock: dokunma
        },
      });
    },
  );

  return { listingId: listing.id };
}
