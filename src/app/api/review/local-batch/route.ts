// Phase 6 Task 10 — POST /api/review/local-batch
//
// Local mode toplu review tetikleme endpoint'i. Kullanıcı bir veya birkaç
// LocalLibraryAsset için Gemini review'i kuyruğa atar.
//
// Response invariant (IA Phase 16 — already-scored skip):
//   requested = enqueueSucceeded + skippedDuplicates + skippedNotFound
//             + skippedAlreadyScored + enqueueErrors
//
// Field anlamları:
//   - requested: body'deki ham assetIds sayısı (dedup öncesi)
//   - enqueueSucceeded: ownership PASS + already-scored değil + enqueue PASS
//   - skippedDuplicates: body'de tekrar eden id'ler
//   - skippedNotFound: ownership FAIL (başka user, deletedAt, isUserDeleted)
//   - skippedAlreadyScored: SYSTEM tarafından zaten review edilmiş; tekrar
//     Gemini çağrısı tetiklemez (CLAUDE.md Madde N — scoring cost disiplini)
//   - enqueueErrors: enqueue çağrısında throw alan asset sayısı
//
// Sözleşme:
//   - Auth: requireUser (Phase 5).
//   - Body: { assetIds: cuid[], productTypeKey: string }.
//   - assetIds duplicate id'ler de-duplicate edilir (Karar 3).
//   - Sadece kullanıcıya ait + soft-delete edilmemiş asset'ler kabul edilir.
//   - productTypeKey ZORUNLU (Karar 1) — sessiz default YOK; gelmezse 400.
//   - Per-asset enqueue try/catch: bir asset'in fail'i diğerlerini durdurmaz.
//   - Enqueue paralel (Promise.all + map) — Phase 5 ai-generation.service.ts
//     paterniyle hizalı. Race-safe: per-task try/catch + immutable filter sayım.
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
    // CLAUDE.md Madde N — scoring cost disiplini. Zaten SYSTEM
    // tarafından scoring almış asset'leri (reviewedAt + provider
    // snapshot dolu) ikinci kez kuyruğa atmıyoruz. UI tetiklemesi,
    // tekrar gelmiş webhook, retry, ya da idempotency olmayan eski
    // çağrı senaryolarında dahi maliyet doğmaz.
    select: {
      id: true,
      reviewedAt: true,
      reviewProviderSnapshot: true,
      reviewStatusSource: true,
    },
  });
  const ownedIdSet = new Set(ownedAssets.map((a) => a.id));
  const acceptedIds = uniqueIds.filter((id) => ownedIdSet.has(id));
  const skippedNotFound = uniqueIds.length - acceptedIds.length;

  // Already-scored skip (canonical guard, sticky.ts'le aynı semantik).
  // İmport etmek yerine endpoint'in karar mantığını burada tutuyoruz
  // (yalnız iki alan kontrolü, modül bağımlılığı şişmesin).
  const alreadyScoredIds = new Set(
    ownedAssets
      .filter(
        (a) =>
          a.reviewStatusSource === "SYSTEM" &&
          a.reviewedAt !== null &&
          a.reviewProviderSnapshot !== null,
      )
      .map((a) => a.id),
  );
  const enqueueIds = acceptedIds.filter((id) => !alreadyScoredIds.has(id));
  const skippedAlreadyScored = acceptedIds.length - enqueueIds.length;

  // Per-asset enqueue paralel: Phase 5 ai-generation.service.ts paterni.
  // Race-safe: her async fn kendi try/catch'ini taşıyor; counter mutation yok,
  // immutable filter sayım. 100 asset × Redis RTT (~5-10ms) = ~1s tasarruf.
  const enqueueResults = await Promise.all(
    enqueueIds.map(async (assetId) => {
      try {
        await enqueue(JobType.REVIEW_DESIGN, {
          scope: "local" as const,
          localAssetId: assetId,
          userId: user.id,
          productTypeKey: parsed.data.productTypeKey,
        });
        return { ok: true as const };
      } catch (err) {
        logger.error(
          {
            assetId,
            userId: user.id,
            err: err instanceof Error ? err.message : String(err),
          },
          "local batch review enqueue failed for asset",
        );
        return { ok: false as const };
      }
    }),
  );
  const enqueueErrors = enqueueResults.filter((r) => !r.ok).length;

  return NextResponse.json({
    requested: parsed.data.assetIds.length,
    enqueueSucceeded: enqueueIds.length - enqueueErrors,
    skippedDuplicates,
    skippedNotFound,
    skippedAlreadyScored,
    enqueueErrors,
  });
});
