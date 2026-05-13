/**
 * Phase 40 — Folder intake endpoint.
 *
 * Operatör Add Reference modal'ının "From Local Library" sekmesinde N
 * local asset seçer; bu endpoint her birini:
 *
 *   1. user-scoped + active root + soft-delete filtreleriyle doğrular
 *   2. diskten buffer'a okur
 *   3. mevcut `createAssetFromBuffer` köprüsünden geçirip Asset row
 *      üretir (hash dedup; aynı içerikli ikinci asset yeni row
 *      oluşturmaz, mevcut Asset'i döner)
 *   4. INBOX statüsünde bir Bookmark oluşturur (title = fileName
 *      stripped of extension; sourcePlatform = OTHER; assetId set)
 *   5. opsiyonel olarak hemen Reference'a promote eder (operatör
 *      `promote=true` gönderirse)
 *
 * Yeni schema field YOK; mevcut `LocalLibraryAsset` ile `Asset`
 * arasında FK bağlantısı kurmaz, sadece dosya içeriğini storage
 * provider'a kopyalar. Local asset diskte yerinde kalır.
 *
 * User isolation guards:
 *   - LocalLibraryAsset.userId == session.user.id
 *   - active root filter (settings.rootFolderPath altında)
 *   - isUserDeleted=false AND deletedAt=null
 *   - path traversal koruması: filePath DB'den okunur (operatör
 *     query ile inject edemez)
 *
 * Partial failure: Promise.allSettled — başarısızlar `failed[]`'a
 * eklenir; başarılılar `references[]`'a girer; operatöre toast'ta
 * "X succeeded, Y failed" gösterilebilir.
 *
 * No new schema. No WorkflowRun. No review freeze impact.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { BookmarkStatus, SourcePlatform } from "@prisma/client";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { createAssetFromBuffer } from "@/features/assets/server/asset-service";
import { createReferenceFromBookmark } from "@/features/references/services/reference-service";
import { getActiveLocalRootFilter } from "@/server/services/local-library/active-root";
import { logger } from "@/lib/logger";

const BodySchema = z.object({
  localAssetIds: z.array(z.string().min(1)).min(1).max(100),
  productTypeId: z.string().min(1),
  collectionId: z.string().min(1).optional(),
  notes: z.string().max(2000).optional(),
});

type SuccessItem = {
  localAssetId: string;
  bookmarkId: string;
  referenceId: string;
  assetId: string;
  /* Phase 41 — when this asset (same content hash) was already a
   * Reference in the user's Pool, we don't create a duplicate; we
   * surface the existing Reference. `reused = true` lets the UI
   * show "X added, Y already in Pool" breakdown. */
  reused: boolean;
};

type FailureItem = {
  localAssetId: string;
  error: string;
};

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Invalid input", parsed.error.flatten());
  }
  const { localAssetIds, productTypeId, collectionId, notes } = parsed.data;

  // Product type validation (single check — saves N round-trips).
  const productType = await db.productType.findUnique({
    where: { id: productTypeId },
    select: { id: true },
  });
  if (!productType) {
    throw new ValidationError("Product type not found");
  }
  if (collectionId) {
    const col = await db.collection.findFirst({
      where: { id: collectionId, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!col) {
      throw new ValidationError("Collection not found");
    }
  }

  // Active root filter — operator must have a rootFolderPath set;
  // otherwise localLibrary intake silently fetches 0 rows (we surface
  // this with a clear error so the operator knows to configure it).
  const rootFilter = await getActiveLocalRootFilter(user.id);

  // Bulk fetch all candidate LocalLibraryAssets in one query.
  const candidates = await db.localLibraryAsset.findMany({
    where: {
      id: { in: localAssetIds },
      userId: user.id,
      isUserDeleted: false,
      deletedAt: null,
      ...rootFilter,
    },
    select: {
      id: true,
      filePath: true,
      mimeType: true,
      fileName: true,
    },
  });

  // Build a quick lookup so missing IDs become failures (not silent).
  const candidateMap = new Map(candidates.map((c) => [c.id, c]));

  const successes: SuccessItem[] = [];
  const failures: FailureItem[] = [];

  await Promise.all(
    localAssetIds.map(async (localAssetId) => {
      const cand = candidateMap.get(localAssetId);
      if (!cand) {
        failures.push({
          localAssetId,
          error:
            "Asset not found or no longer accessible (check active root / soft delete)",
        });
        return;
      }
      try {
        const buffer = await readFile(cand.filePath);
        const asset = await createAssetFromBuffer({
          userId: user.id,
          buffer,
          mimeType: cand.mimeType,
          // No sourceUrl — local-only origin. sourcePlatform OTHER.
          sourcePlatform: SourcePlatform.OTHER,
        });

        /* Phase 41 — Reference-level dedup. createAssetFromBuffer
         * dedups at Asset layer (same hash → same Asset row); but
         * we used to create a brand-new Bookmark + Reference for
         * every intake. Now: if a non-deleted Reference for
         * (userId, assetId) already exists, REUSE it. The operator
         * sees "X added, Y already in Pool" and Pool doesn't grow
         * duplicates. Soft enforcement (no @@unique constraint
         * change). */
        const existingRef = await db.reference.findFirst({
          where: {
            userId: user.id,
            assetId: asset.id,
            deletedAt: null,
          },
          select: {
            id: true,
            bookmarkId: true,
          },
        });
        if (existingRef) {
          successes.push({
            localAssetId,
            bookmarkId: existingRef.bookmarkId ?? "",
            referenceId: existingRef.id,
            assetId: asset.id,
            reused: true,
          });
          return;
        }

        // Strip extension from fileName for display title.
        const baseName = cand.fileName.replace(/\.[^.]+$/, "");
        const bookmark = await db.bookmark.create({
          data: {
            userId: user.id,
            sourcePlatform: SourcePlatform.OTHER,
            assetId: asset.id,
            title: baseName,
            productTypeId,
            collectionId: collectionId ?? null,
            status: BookmarkStatus.INBOX,
          },
        });
        const reference = await createReferenceFromBookmark({
          userId: user.id,
          input: {
            bookmarkId: bookmark.id,
            productTypeId,
            collectionId,
            notes,
          },
        });
        successes.push({
          localAssetId,
          bookmarkId: bookmark.id,
          referenceId: reference.id,
          assetId: asset.id,
          reused: false,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        logger.warn(
          { localAssetId, userId: user.id, err: msg },
          "from-local-library: per-asset promote failed",
        );
        failures.push({ localAssetId, error: msg });
      }
    }),
  );

  return NextResponse.json({
    references: successes,
    failed: failures,
  });
});
