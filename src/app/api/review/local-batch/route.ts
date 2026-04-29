// Phase 6 Task 10 — POST /api/review/local-batch
//
// Local mode toplu review tetikleme endpoint'i. Kullanıcı bir veya birkaç
// LocalLibraryAsset için Gemini review'i kuyruğa atar.
//
// Sözleşme:
//   - Auth: requireUser (Phase 5).
//   - Body: { assetIds: cuid[], productTypeKey: string }.
//   - assetIds duplicate id'ler de-duplicate edilir (Karar 3).
//   - Sadece kullanıcıya ait + soft-delete edilmemiş asset'ler kabul edilir.
//   - productTypeKey ZORUNLU (Karar 1) — sessiz default YOK; gelmezse 400.
//   - Per-asset enqueue try/catch: bir asset'in fail'i diğerlerini durdurmaz.
//   - Response: { requested, accepted, skippedDuplicates, skippedNotFound,
//     enqueueErrors }.
//
// Kararlar:
//   - REVIEW_DESIGN payload'ında scope:"local" + productTypeKey her asset için
//     aynı (batch tek tip). Worker burada okuyup TRANSPARENT_TARGET_TYPES gate
//     ile alpha-checks tetikler.
//   - userId payload'da seedlenir; worker ownership doğrular (defense in depth).
//   - Cuid validation Zod düzeyinde — bozuk id 400 olarak reddedilir,
//     "skippedNotFound" sayılmaz (input doğrulama hatası).

import { NextResponse } from "next/server";
import { z } from "zod";
import { JobType } from "@prisma/client";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { enqueue } from "@/server/queue";
import { logger } from "@/lib/logger";

const BodySchema = z.object({
  assetIds: z.array(z.string().cuid()).min(1).max(100),
  productTypeKey: z.string().min(1),
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }

  // De-duplicate (Karar 3): aynı id birden fazla geldiyse tek sefer enqueue.
  const uniqueIds = Array.from(new Set(parsed.data.assetIds));
  const skippedDuplicates = parsed.data.assetIds.length - uniqueIds.length;

  // Ownership + soft-delete filter.
  // Aktif asset = userId match + deletedAt null + isUserDeleted false.
  const ownedAssets = await db.localLibraryAsset.findMany({
    where: {
      id: { in: uniqueIds },
      userId: user.id,
      deletedAt: null,
      isUserDeleted: false,
    },
    select: { id: true },
  });
  const ownedIdSet = new Set(ownedAssets.map((a) => a.id));
  const acceptedIds = uniqueIds.filter((id) => ownedIdSet.has(id));
  const skippedNotFound = uniqueIds.length - acceptedIds.length;

  // Per-asset enqueue: bir asset'in fail'i diğerlerini durdurmaz.
  let enqueueErrors = 0;
  for (const assetId of acceptedIds) {
    try {
      await enqueue(JobType.REVIEW_DESIGN, {
        scope: "local" as const,
        localAssetId: assetId,
        userId: user.id,
        productTypeKey: parsed.data.productTypeKey,
      });
    } catch (err) {
      enqueueErrors += 1;
      logger.error(
        {
          assetId,
          userId: user.id,
          err: err instanceof Error ? err.message : String(err),
        },
        "local batch review enqueue failed for asset",
      );
    }
  }

  return NextResponse.json({
    requested: parsed.data.assetIds.length,
    accepted: acceptedIds.length - enqueueErrors,
    skippedDuplicates,
    skippedNotFound,
    enqueueErrors,
  });
});
