import { CompetitorScanType, JobType, SourcePlatform } from "@prisma/client";
import { db } from "@/server/db";
import { enqueue } from "@/server/queue";
import { assertOwnsResource, scopedWhere } from "@/server/authorization";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { AddCompetitorInput } from "../schemas";
import { canonicalizeEtsyShopName } from "./canonical";

/**
 * Kullanıcıya ait tüm rakip mağazaları listeler.
 */
export async function listCompetitors(userId: string) {
  return db.competitorStore.findMany({
    where: scopedWhere(userId),
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { listings: true } } },
  });
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
