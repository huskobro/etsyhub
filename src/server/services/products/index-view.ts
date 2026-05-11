// R5 — Products (Listing) B4 index view-model.
//
// `Listing` model'ini Products UI konseptine çevirir. Phase 9 zaten
// `Listing` model'ini Etsy draft pipeline'ı için kuruyor; R5 bunun üzerine
// Product görselleştirmesini koyar (yeni model yok). Per-product 4-up
// thumb composite (B4 spec) için cover render dahil ilk 4 success render
// kullanılır; thumb yoksa ImageOff fallback UI tarafında.
//
// `health` listing readiness check'lerinden derive (computeReadiness).
// `filesCount` mockup render success sayısı (V1; bundle ZIP henüz auto-
// generate yok). Product detail Files tab'inde detay var.

import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";
import { logger } from "@/lib/logger";
import { computeReadiness } from "@/features/listings/server/readiness.service";
import { listingHealthScore } from "@/features/products/state-helpers";

const THUMB_TTL_SECONDS = 3600;
const THUMBS_PER_ROW = 4;

export type ProductIndexRow = {
  id: string;
  title: string | null;
  status: import("@prisma/client").ListingStatus;
  mockupJobId: string | null;
  coverRenderId: string | null;
  etsyListingId: string | null;
  priceCents: number | null;
  coverThumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
  thumbsComposite: string[];
  filesCount: number;
  health: number | null;
};

export async function listProductsForIndex(input: {
  userId: string;
  /** R5 — Selection lineage filter (optional). Selection detail Mockups tab'ı
   *  "View in Product" CTA'sından `?fromSelection=setId` olarak gelir. */
  fromSelectionId?: string;
}): Promise<ProductIndexRow[]> {
  // Selection filter — listing.mockupJobId → MockupJob.setId zinciri.
  // İlgili setId'ye bağlı job'lardan listing'leri filter.
  let listingIdFilter: string[] | null = null;
  if (input.fromSelectionId) {
    const jobs = await db.mockupJob.findMany({
      where: { userId: input.userId, setId: input.fromSelectionId },
      select: { id: true },
    });
    if (jobs.length === 0) return [];
    const jobIds = jobs.map((j) => j.id);
    const listings = await db.listing.findMany({
      where: {
        userId: input.userId,
        deletedAt: null,
        mockupJobId: { in: jobIds },
      },
      select: { id: true },
    });
    listingIdFilter = listings.map((l) => l.id);
    if (listingIdFilter.length === 0) return [];
  }

  const listings = await db.listing.findMany({
    where: {
      userId: input.userId,
      deletedAt: null,
      ...(listingIdFilter ? { id: { in: listingIdFilter } } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  if (listings.length === 0) return [];

  // Mockup job'ların success render'larını batch fetch — pack düzeninde
  // ilk THUMBS_PER_ROW kart için thumb URL üretiriz.
  const mockupJobIds = listings
    .map((l) => l.mockupJobId)
    .filter((id): id is string => id !== null);

  const renders =
    mockupJobIds.length > 0
      ? await db.mockupRender.findMany({
          where: {
            jobId: { in: mockupJobIds },
            status: "SUCCESS",
            packPosition: { not: null },
          },
          orderBy: [
            { jobId: "asc" },
            { packPosition: "asc" },
          ],
          select: {
            id: true,
            jobId: true,
            packPosition: true,
            thumbnailKey: true,
            outputKey: true,
          },
        })
      : [];

  // jobId → ilk N render
  const rendersByJob = new Map<
    string,
    { id: string; thumbnailKey: string | null; outputKey: string | null }[]
  >();
  // jobId → toplam success render sayısı
  const successCountByJob = new Map<string, number>();
  for (const r of renders) {
    const arr = rendersByJob.get(r.jobId) ?? [];
    if (arr.length < THUMBS_PER_ROW) {
      arr.push({
        id: r.id,
        thumbnailKey: r.thumbnailKey,
        outputKey: r.outputKey,
      });
      rendersByJob.set(r.jobId, arr);
    }
    successCountByJob.set(r.jobId, (successCountByJob.get(r.jobId) ?? 0) + 1);
  }

  // Storage signed URL — best-effort
  const storage = getStorage();
  const allKeys = new Set<string>();
  for (const arr of rendersByJob.values()) {
    for (const r of arr) {
      const key = r.thumbnailKey ?? r.outputKey;
      if (key) allKeys.add(key);
    }
  }
  const urlByKey = new Map<string, string>();
  await Promise.all(
    Array.from(allKeys).map(async (key) => {
      try {
        const url = await storage.signedUrl(key, THUMB_TTL_SECONDS);
        urlByKey.set(key, url);
      } catch (err) {
        logger.warn(
          { key, err: err instanceof Error ? err.message : String(err) },
          "products b4 thumb signed URL failed",
        );
      }
    }),
  );

  return listings.map((l) => {
    const rendersForJob = l.mockupJobId
      ? rendersByJob.get(l.mockupJobId) ?? []
      : [];
    const thumbs: string[] = [];
    for (const r of rendersForJob) {
      const key = r.thumbnailKey ?? r.outputKey;
      const url = key ? urlByKey.get(key) : undefined;
      if (url) thumbs.push(url);
    }
    const filesCount = l.mockupJobId
      ? successCountByJob.get(l.mockupJobId) ?? 0
      : 0;
    // health — soft warn yüzdesi (Phase 9 V1 readiness)
    const checks = computeReadiness(l);
    const health = checks.length > 0 ? listingHealthScore(checks) : null;
    return {
      id: l.id,
      title: l.title,
      status: l.status,
      mockupJobId: l.mockupJobId,
      coverRenderId: l.coverRenderId,
      etsyListingId: l.etsyListingId,
      priceCents: l.priceCents,
      coverThumbnailUrl: thumbs[0] ?? null,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
      thumbsComposite: thumbs,
      filesCount,
      health,
    };
  });
}
