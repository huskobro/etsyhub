import type { Job } from "bullmq";
import {
  CompetitorListingStatus,
  CompetitorScanStatus,
  CompetitorScanType,
  JobStatus,
  Prisma,
} from "@prisma/client";
import { db } from "@/server/db";
import { getScraper } from "@/providers/scraper";
import type { ScanScope } from "@/providers/scraper/types";
import { logger } from "@/lib/logger";
import { enqueueTrendClusterUpdate } from "@/features/trend-stories/services/trend-update-scheduler";

export type ScrapeCompetitorPayload = {
  jobId: string;
  scanId: string;
  userId: string;
  competitorStoreId: string;
  type: CompetitorScanType;
};

/** 7 gün — soft-delete grace süresi. */
const SOFT_DELETE_GRACE_MS = 7 * 24 * 3600 * 1000;

/**
 * SCRAPE_COMPETITOR worker.
 *
 * Akış:
 * 1. Job + CompetitorScan RUNNING
 * 2. getScraper() ile aktif provider'dan scan sonucu al
 * 3. Listing'leri upsert et (ACTIVE, parser alanlarıyla)
 * 4. INITIAL_FULL modda 7 günden eski görülmeyen listing'leri DELETED işaretle
 *    (INCREMENTAL_NEW modda dokunma — o modda dataset tam değil)
 * 5. CompetitorStore.lastScannedAt güncelle
 * 6. CompetitorScan SUCCESS + aggregate metrikler
 * 7. Job SUCCESS + progress 100
 * Hata olursa: Job + CompetitorScan FAILED, Türkçe error mesajı.
 */
export async function handleScrapeCompetitor(
  job: Job<ScrapeCompetitorPayload>,
): Promise<{ listingsFound: number; newCount: number; updatedCount: number; removedCount: number }> {
  const { jobId, scanId, userId, competitorStoreId, type } = job.data;
  const startedAt = new Date();

  await Promise.all([
    db.job.update({
      where: { id: jobId },
      data: { status: JobStatus.RUNNING, startedAt },
    }),
    db.competitorScan.update({
      where: { id: scanId },
      data: { status: CompetitorScanStatus.RUNNING, startedAt },
    }),
  ]);

  try {
    // Data isolation — store userId ile eşleşmeli
    const store = await db.competitorStore.findFirst({
      where: { id: competitorStoreId, userId, deletedAt: null },
    });
    if (!store) {
      throw new Error("Rakip mağaza bulunamadı veya erişim yok");
    }

    const scraper = await getScraper();

    const knownListings = await db.competitorListing.findMany({
      where: { competitorStoreId },
      select: { externalId: true },
    });
    const knownExternalIds = knownListings.map((l) => l.externalId);

    const scope: ScanScope =
      type === CompetitorScanType.INITIAL_FULL
        ? { mode: "initial_full" }
        : {
            mode: "incremental_since",
            sinceIso: store.lastScannedAt?.toISOString() ?? "1970-01-01T00:00:00.000Z",
            knownExternalIds,
          };

    const result = await scraper.scanStore({
      shopIdentifier: store.shopUrl ?? store.etsyShopName,
      platform: store.platform,
      scope,
    });

    // Listing upsert — ACTIVE status, parser alanları dahil
    let newCount = 0;
    let updatedCount = 0;
    const listingLevelWarnings: string[] = [];

    for (const listing of result.listings) {
      if (listing.parseWarnings.length > 0) {
        for (const w of listing.parseWarnings) {
          listingLevelWarnings.push(`[${listing.externalId}] ${w}`);
        }
      }

      const rawMetadata =
        listing.rawMetadata === undefined
          ? Prisma.JsonNull
          : (listing.rawMetadata as Prisma.InputJsonValue);

      const now = new Date();
      const upserted = await db.competitorListing.upsert({
        where: {
          competitorStoreId_externalId: {
            competitorStoreId,
            externalId: listing.externalId,
          },
        },
        create: {
          competitorStoreId,
          userId,
          externalId: listing.externalId,
          platform: listing.platform,
          sourceUrl: listing.sourceUrl,
          title: listing.title,
          thumbnailUrl: listing.thumbnailUrl,
          imageUrls: listing.imageUrls,
          priceCents: listing.priceCents,
          currency: listing.currency,
          reviewCount: listing.reviewCount,
          favoritesCount: listing.favoritesCount,
          listingCreatedAt: listing.listingCreatedAt,
          latestReviewAt: listing.latestReviewAt,
          parserSource: listing.parserSource,
          parserConfidence: listing.parserConfidence,
          parseWarnings: listing.parseWarnings,
          status: CompetitorListingStatus.ACTIVE,
          firstSeenAt: now,
          lastSeenAt: now,
          rawMetadata,
        },
        update: {
          title: listing.title,
          thumbnailUrl: listing.thumbnailUrl,
          imageUrls: listing.imageUrls,
          priceCents: listing.priceCents,
          currency: listing.currency,
          reviewCount: listing.reviewCount,
          favoritesCount: listing.favoritesCount,
          listingCreatedAt: listing.listingCreatedAt,
          latestReviewAt: listing.latestReviewAt,
          parserSource: listing.parserSource,
          parserConfidence: listing.parserConfidence,
          parseWarnings: listing.parseWarnings,
          status: CompetitorListingStatus.ACTIVE,
          lastSeenAt: now,
          rawMetadata,
        },
      });

      // createdAt === updatedAt ise yeni (Prisma upsert create path)
      if (upserted.createdAt.getTime() === upserted.updatedAt.getTime()) {
        newCount++;
      } else {
        updatedCount++;
      }
    }

    // Soft-delete: sadece INITIAL_FULL modda ve grace süresi aşıldıysa
    let removedCount = 0;
    if (type === CompetitorScanType.INITIAL_FULL) {
      const seenIds = result.listings.map((l) => l.externalId);
      const cutoff = new Date(Date.now() - SOFT_DELETE_GRACE_MS);
      const removed = await db.competitorListing.updateMany({
        where: {
          competitorStoreId,
          status: CompetitorListingStatus.ACTIVE,
          externalId: seenIds.length > 0 ? { notIn: seenIds } : undefined,
          lastSeenAt: { lt: cutoff },
        },
        data: { status: CompetitorListingStatus.DELETED },
      });
      removedCount = removed.count;
    }

    // parseWarnings concatenate: scan-level + listing-level
    const allWarnings = [
      ...result.scanMeta.parseWarnings,
      ...listingLevelWarnings,
    ];

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    await Promise.all([
      db.competitorStore.update({
        where: { id: competitorStoreId },
        data: {
          displayName: result.store.displayName ?? undefined,
          totalListings: result.store.totalListings ?? undefined,
          totalReviews: result.store.totalReviews ?? undefined,
          lastScannedAt: finishedAt,
        },
      }),
      db.competitorScan.update({
        where: { id: scanId },
        data: {
          status: CompetitorScanStatus.SUCCESS,
          provider: result.scanMeta.provider,
          listingsFound: result.listings.length,
          listingsNew: newCount,
          listingsUpdated: updatedCount,
          listingsRemoved: removedCount,
          parseWarnings: allWarnings,
          finishedAt,
        },
      }),
      db.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.SUCCESS,
          progress: 100,
          finishedAt,
          metadata: {
            competitorStoreId,
            scanType: type,
            listingsFound: result.listings.length,
            newCount,
            updatedCount,
            removedCount,
            provider: result.scanMeta.provider,
            durationMs,
            apiCreditsUsed: result.scanMeta.apiCreditsUsed ?? null,
          },
        },
      }),
    ]);

    logger.info(
      {
        jobId,
        scanId,
        competitorStoreId,
        listingsFound: result.listings.length,
        newCount,
        updatedCount,
        removedCount,
        provider: result.scanMeta.provider,
        durationMs,
      },
      "SCRAPE_COMPETITOR worker başarıyla tamamlandı",
    );

    // Trend cluster recompute tetikle — NON-BLOCKING.
    // Hata scrape'i başarısız yapmaz; metadata'ya yazılır.
    try {
      await enqueueTrendClusterUpdate(userId);
    } catch (err) {
      const trendEnqueueMessage = err instanceof Error ? err.message : "Bilinmeyen hata";
      logger.warn(
        { userId, scanId, err: trendEnqueueMessage },
        "trend cluster enqueue failed after scrape SUCCESS",
      );
      // NOT: findUnique + update 2-step pattern race condition'a açık — aynı scanId için
      // paralel iki hata önceki trendEnqueueError'ı üzerine yazabilir. MVP için kabul
      // edilen risk; ileride Postgres JSONB operator ile single-statement UPDATE
      // (metadata = metadata || jsonb_build_object(...)) ile çözülebilir.
      // Mevcut scan kaydını oku → metadata spread et → error alanı ekle
      const currentScan = await db.competitorScan.findUnique({
        where: { id: scanId },
        select: { metadata: true },
      });
      const existingMetadata =
        currentScan?.metadata &&
        typeof currentScan.metadata === "object" &&
        !Array.isArray(currentScan.metadata)
          ? (currentScan.metadata as Prisma.JsonObject)
          : {};
      await db.competitorScan.update({
        where: { id: scanId },
        data: {
          metadata: { ...existingMetadata, trendEnqueueError: trendEnqueueMessage },
        },
      });
    }

    return {
      listingsFound: result.listings.length,
      newCount,
      updatedCount,
      removedCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    logger.error(
      { jobId, scanId, competitorStoreId, err: message },
      "SCRAPE_COMPETITOR worker başarısız oldu",
    );
    const finishedAt = new Date();
    await Promise.all([
      db.competitorScan.update({
        where: { id: scanId },
        data: {
          status: CompetitorScanStatus.FAILED,
          errorMessage: message,
          finishedAt,
        },
      }),
      db.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          error: message,
          finishedAt,
        },
      }),
    ]);
    throw err;
  }
}
