import {
  CompetitorListingStatus,
  CompetitorScanType,
  JobType,
  SourcePlatform,
  type Prisma,
} from "@prisma/client";
import { db } from "@/server/db";
import { enqueue } from "@/server/queue";
import { assertOwnsResource, scopedWhere } from "@/server/authorization";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type {
  AddCompetitorInput,
  ListCompetitorListingsQuery,
  ListCompetitorsQuery,
  ReviewWindow,
} from "../schemas";
import { canonicalizeEtsyShopName } from "./canonical";
import { rankListings } from "./ranking-service";

/**
 * Kullanıcıya ait rakip mağazaları listeler.
 *
 * Opsiyonel query:
 *  - q: shop name contains filtresi (case-insensitive)
 *  - cursor: önceki sayfanın son id'si
 *  - limit: 1..200 (default 50)
 */
export async function listCompetitors(
  userId: string,
  query: ListCompetitorsQuery = { limit: 50 },
) {
  const { q, cursor, limit } = query;

  const where: Prisma.CompetitorStoreWhereInput = {
    ...scopedWhere(userId),
    ...(q
      ? {
          OR: [
            { etsyShopName: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await db.competitorStore.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { _count: { select: { listings: true } } },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return { items, nextCursor };
}

/**
 * Tek rakip mağazanın ranked listing listesini döndürür.
 *
 * Akış:
 *  1. getCompetitor ownership doğrular (NotFoundError eğer user'a ait değilse).
 *  2. DELETED olmayan listingleri çeker (cursor pagination).
 *  3. filterByWindow + rankListingsByReviews uygular.
 */
export async function listCompetitorListings(
  userId: string,
  competitorStoreId: string,
  query: ListCompetitorListingsQuery,
) {
  await getCompetitor(userId, competitorStoreId);

  const { window, cursor, limit } = query;

  const where: Prisma.CompetitorListingWhereInput = {
    competitorStoreId,
    userId,
    status: { not: CompetitorListingStatus.DELETED },
  };

  const rows = await db.competitorListing.findMany({
    where,
    orderBy: [{ reviewCount: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const ranked = rankListings(page, window as ReviewWindow);
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  return { items: ranked, nextCursor };
}

/**
 * Tek rakip mağaza getirir. Başka kullanıcının mağazası → NotFoundError.
 */
export async function getCompetitor(userId: string, id: string) {
  const store = await db.competitorStore.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!store) throw new NotFoundError("Rakip mağaza bulunamadı");
  return store;
}

/**
 * Yeni rakip mağaza ekler ve INITIAL_FULL scan başlatır.
 *
 * shopIdentifier: shop name, URL veya locale'li URL.
 * canonical.ts'deki helper ile normalize edilir.
 */
export async function addCompetitor(userId: string, input: AddCompetitorInput) {
  const shopName = canonicalizeEtsyShopName(input.shopIdentifier);

  const exists = await db.competitorStore.findFirst({
    where: { userId, etsyShopName: shopName, deletedAt: null },
  });
  if (exists) throw new ConflictError("Bu mağaza zaten takibinde");

  const platform =
    input.platform === "AMAZON" ? SourcePlatform.AMAZON : SourcePlatform.ETSY;

  const shopUrl = input.shopIdentifier.trim().startsWith("http")
    ? input.shopIdentifier.trim()
    : null;

  const store = await db.competitorStore.create({
    data: {
      userId,
      etsyShopName: shopName,
      platform,
      shopUrl,
      autoScanEnabled: input.autoScanEnabled,
    },
  });

  await triggerScan({
    userId,
    competitorStoreId: store.id,
    type: CompetitorScanType.INITIAL_FULL,
  });

  return store;
}

/**
 * Scrape job + CompetitorScan kaydı oluşturur ve BullMQ'ya enqueue eder.
 */
export async function triggerScan(args: {
  userId: string;
  competitorStoreId: string;
  type: CompetitorScanType;
}) {
  const store = await getCompetitor(args.userId, args.competitorStoreId);

  const job = await db.job.create({
    data: {
      userId: args.userId,
      type: JobType.SCRAPE_COMPETITOR,
      metadata: {
        competitorStoreId: store.id,
        scanType: args.type,
      },
    },
  });

  const scan = await db.competitorScan.create({
    data: {
      userId: args.userId,
      competitorStoreId: store.id,
      jobId: job.id,
      type: args.type,
      provider: "pending",
    },
  });

  const bull = await enqueue(JobType.SCRAPE_COMPETITOR, {
    jobId: job.id,
    scanId: scan.id,
    userId: args.userId,
    competitorStoreId: store.id,
    type: args.type,
  });

  await db.job.update({
    where: { id: job.id },
    data: { bullJobId: bull.id },
  });

  return { jobId: job.id, scanId: scan.id };
}

/**
 * Rakip mağazayı soft delete yapar (deletedAt set).
 */
export async function deleteCompetitor(userId: string, id: string) {
  const store = await getCompetitor(userId, id);
  assertOwnsResource(userId, store);
  await db.competitorStore.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
