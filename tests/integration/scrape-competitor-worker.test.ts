import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import type { Job } from "bullmq";
import {
  CompetitorListingStatus,
  CompetitorScanStatus,
  CompetitorScanType,
  JobStatus,
  JobType,
  SourcePlatform,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import type {
  ScanResult,
  ScrapedListing,
  ScrapedStore,
  ScraperProvider,
  ScraperProviderName,
} from "@/providers/scraper/types";

/**
 * Mock scraper provider — test başına override edilebilir listing seti döner.
 * `getScraper` mock'lanır, bu provider döner.
 */
let mockListings: ScrapedListing[] = [];
let mockStore: ScrapedStore = {
  etsyShopName: "mockshop",
  platform: SourcePlatform.ETSY,
  displayName: "Mock Shop",
  shopUrl: "https://www.etsy.com/shop/mockshop",
  totalListings: 0,
  totalReviews: 0,
};
let mockScanWarnings: string[] = [];
let mockApiCredits: number | undefined;

const mockProvider: ScraperProvider = {
  name: "self-hosted" as ScraperProviderName,
  scanStore: vi.fn(async (): Promise<ScanResult> => ({
    store: { ...mockStore, totalListings: mockListings.length },
    listings: mockListings,
    scanMeta: {
      provider: "self-hosted",
      durationMs: 42,
      apiCreditsUsed: mockApiCredits,
      parseWarnings: mockScanWarnings,
    },
  })),
  parseSingleListing: vi.fn(async () => {
    throw new Error("not used in worker tests");
  }),
};

vi.mock("@/providers/scraper", async () => {
  return {
    getScraper: async () => mockProvider,
  };
});

// Worker import'ı mock'tan sonra olmalı — Vitest hoisting ile vi.mock
// statement'larını üste çekiyor, yine de güvenli tarafta kalmak için alta koyuyoruz.
const { handleScrapeCompetitor } = await import(
  "@/server/workers/scrape-competitor.worker"
);

type WorkerJob = Job<{
  jobId: string;
  scanId: string;
  userId: string;
  competitorStoreId: string;
  type: CompetitorScanType;
}>;

function buildJob(data: WorkerJob["data"]): WorkerJob {
  return { data } as WorkerJob;
}

function makeListing(
  externalId: string,
  overrides: Partial<ScrapedListing> = {},
): ScrapedListing {
  return {
    externalId,
    platform: SourcePlatform.ETSY,
    sourceUrl: `https://www.etsy.com/listing/${externalId}`,
    title: `Mock listing ${externalId}`,
    thumbnailUrl: `https://cdn.example.com/${externalId}.jpg`,
    imageUrls: [`https://cdn.example.com/${externalId}.jpg`],
    priceCents: 1999,
    currency: "USD",
    reviewCount: 10,
    favoritesCount: 5,
    listingCreatedAt: null,
    latestReviewAt: null,
    parserSource: "mock",
    parserConfidence: 90,
    parseWarnings: [],
    status: CompetitorListingStatus.ACTIVE,
    rawMetadata: { source: "test" },
    ...overrides,
  };
}

async function ensureUser(email: string) {
  return db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await bcrypt.hash("password-test", 10),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
    update: {},
  });
}

async function seedStoreAndJob(userId: string, shopName: string) {
  const store = await db.competitorStore.create({
    data: {
      userId,
      etsyShopName: shopName,
      shopUrl: `https://www.etsy.com/shop/${shopName}`,
      platform: SourcePlatform.ETSY,
    },
  });

  const job = await db.job.create({
    data: {
      userId,
      type: JobType.SCRAPE_COMPETITOR,
      metadata: { competitorStoreId: store.id },
    },
  });

  const scan = await db.competitorScan.create({
    data: {
      userId,
      competitorStoreId: store.id,
      jobId: job.id,
      type: CompetitorScanType.INITIAL_FULL,
      provider: "pending",
    },
  });

  return { store, job, scan };
}

describe("SCRAPE_COMPETITOR worker", () => {
  let userId: string;

  beforeAll(async () => {
    const user = await ensureUser("scrape-worker-test@etsyhub.local");
    userId = user.id;
  });

  beforeEach(async () => {
    // her test taze başlasın — mock'ları ve ilgili kullanıcının competitor verilerini sıfırla
    mockListings = [];
    mockScanWarnings = [];
    mockApiCredits = undefined;
    mockStore = {
      etsyShopName: "mockshop",
      platform: SourcePlatform.ETSY,
      displayName: "Mock Shop",
      shopUrl: "https://www.etsy.com/shop/mockshop",
      totalListings: 0,
      totalReviews: 0,
    };

    await db.competitorListing.deleteMany({ where: { userId } });
    await db.competitorScan.deleteMany({ where: { userId } });
    await db.competitorStore.deleteMany({ where: { userId } });
    await db.job.deleteMany({
      where: { userId, type: JobType.SCRAPE_COMPETITOR },
    });
  });

  afterAll(async () => {
    await db.competitorListing.deleteMany({ where: { userId } });
    await db.competitorScan.deleteMany({ where: { userId } });
    await db.competitorStore.deleteMany({ where: { userId } });
    await db.job.deleteMany({
      where: { userId, type: JobType.SCRAPE_COMPETITOR },
    });
  });

  it("3 listing'li scan başarılı olur → DB'ye yazılır, scan/job SUCCESS olur", async () => {
    const { store, job, scan } = await seedStoreAndJob(userId, "testshop-a");

    mockListings = [makeListing("1001"), makeListing("1002"), makeListing("1003")];
    mockStore = {
      etsyShopName: "testshop-a",
      platform: SourcePlatform.ETSY,
      displayName: "TestShop A",
      shopUrl: "https://www.etsy.com/shop/testshop-a",
      totalListings: 3,
      totalReviews: 42,
    };
    mockScanWarnings = ["örnek scan-level warning"];
    mockApiCredits = 7;

    await handleScrapeCompetitor(
      buildJob({
        jobId: job.id,
        scanId: scan.id,
        userId,
        competitorStoreId: store.id,
        type: CompetitorScanType.INITIAL_FULL,
      }),
    );

    const rows = await db.competitorListing.findMany({
      where: { competitorStoreId: store.id },
      orderBy: { externalId: "asc" },
    });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.externalId)).toEqual(["1001", "1002", "1003"]);
    expect(rows[0]?.userId).toBe(userId);
    expect(rows[0]?.status).toBe(CompetitorListingStatus.ACTIVE);
    expect(rows[0]?.parserSource).toBe("mock");
    expect(rows[0]?.parserConfidence).toBe(90);

    const updatedStore = await db.competitorStore.findUniqueOrThrow({
      where: { id: store.id },
    });
    expect(updatedStore.lastScannedAt).not.toBeNull();
    expect(updatedStore.displayName).toBe("TestShop A");
    expect(updatedStore.totalListings).toBe(3);
    expect(updatedStore.totalReviews).toBe(42);

    const finalScan = await db.competitorScan.findUniqueOrThrow({
      where: { id: scan.id },
    });
    expect(finalScan.status).toBe(CompetitorScanStatus.SUCCESS);
    expect(finalScan.listingsFound).toBe(3);
    expect(finalScan.listingsNew).toBe(3);
    expect(finalScan.listingsUpdated).toBe(0);
    expect(finalScan.provider).toBe("self-hosted");
    expect(finalScan.finishedAt).not.toBeNull();
    expect(finalScan.parseWarnings).toContain("örnek scan-level warning");

    const finalJob = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(finalJob.status).toBe(JobStatus.SUCCESS);
    expect(finalJob.progress).toBe(100);
    expect(finalJob.finishedAt).not.toBeNull();
  });

  it("grace period: 7 günden eski görülmeyen listing DELETED olur, taze olanlar dokunulmaz", async () => {
    const { store, job, scan } = await seedStoreAndJob(userId, "testshop-b");

    // "Eski" listing — 10 gün önce görülmüş
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600 * 1000);
    await db.competitorListing.create({
      data: {
        userId,
        competitorStoreId: store.id,
        externalId: "old-1",
        platform: SourcePlatform.ETSY,
        sourceUrl: "https://www.etsy.com/listing/old-1",
        title: "Eski listing",
        imageUrls: [],
        status: CompetitorListingStatus.ACTIVE,
        firstSeenAt: tenDaysAgo,
        lastSeenAt: tenDaysAgo,
      },
    });

    // "Taze" listing — 2 gün önce görülmüş, bu scan'de de dönmeyecek ama grace süresinde
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    await db.competitorListing.create({
      data: {
        userId,
        competitorStoreId: store.id,
        externalId: "fresh-1",
        platform: SourcePlatform.ETSY,
        sourceUrl: "https://www.etsy.com/listing/fresh-1",
        title: "Taze listing",
        imageUrls: [],
        status: CompetitorListingStatus.ACTIVE,
        firstSeenAt: twoDaysAgo,
        lastSeenAt: twoDaysAgo,
      },
    });

    // Bu scan'de sadece yeni bir listing dönüyor — ikisi de "görülmedi"
    mockListings = [makeListing("new-1")];

    await handleScrapeCompetitor(
      buildJob({
        jobId: job.id,
        scanId: scan.id,
        userId,
        competitorStoreId: store.id,
        type: CompetitorScanType.INITIAL_FULL,
      }),
    );

    const oldRow = await db.competitorListing.findUniqueOrThrow({
      where: {
        competitorStoreId_externalId: {
          competitorStoreId: store.id,
          externalId: "old-1",
        },
      },
    });
    expect(oldRow.status).toBe(CompetitorListingStatus.DELETED);

    const freshRow = await db.competitorListing.findUniqueOrThrow({
      where: {
        competitorStoreId_externalId: {
          competitorStoreId: store.id,
          externalId: "fresh-1",
        },
      },
    });
    expect(freshRow.status).toBe(CompetitorListingStatus.ACTIVE);

    const newRow = await db.competitorListing.findUniqueOrThrow({
      where: {
        competitorStoreId_externalId: {
          competitorStoreId: store.id,
          externalId: "new-1",
        },
      },
    });
    expect(newRow.status).toBe(CompetitorListingStatus.ACTIVE);

    const finalScan = await db.competitorScan.findUniqueOrThrow({
      where: { id: scan.id },
    });
    expect(finalScan.status).toBe(CompetitorScanStatus.SUCCESS);
    expect(finalScan.listingsRemoved).toBe(1); // sadece old-1 DELETED oldu
  });

  it("incremental modda grace soft-delete çalıştırılmaz", async () => {
    const { store, job, scan } = await seedStoreAndJob(userId, "testshop-c");
    await db.competitorScan.update({
      where: { id: scan.id },
      data: { type: CompetitorScanType.INCREMENTAL_NEW },
    });

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600 * 1000);
    await db.competitorListing.create({
      data: {
        userId,
        competitorStoreId: store.id,
        externalId: "stale-1",
        platform: SourcePlatform.ETSY,
        sourceUrl: "https://www.etsy.com/listing/stale-1",
        title: "Taranmayan eski listing",
        imageUrls: [],
        status: CompetitorListingStatus.ACTIVE,
        firstSeenAt: tenDaysAgo,
        lastSeenAt: tenDaysAgo,
      },
    });

    mockListings = [makeListing("new-only")];

    await handleScrapeCompetitor(
      buildJob({
        jobId: job.id,
        scanId: scan.id,
        userId,
        competitorStoreId: store.id,
        type: CompetitorScanType.INCREMENTAL_NEW,
      }),
    );

    const staleRow = await db.competitorListing.findUniqueOrThrow({
      where: {
        competitorStoreId_externalId: {
          competitorStoreId: store.id,
          externalId: "stale-1",
        },
      },
    });
    // Incremental modda dokunulmamalı
    expect(staleRow.status).toBe(CompetitorListingStatus.ACTIVE);

    const finalScan = await db.competitorScan.findUniqueOrThrow({
      where: { id: scan.id },
    });
    expect(finalScan.listingsRemoved).toBe(0);
    expect(finalScan.status).toBe(CompetitorScanStatus.SUCCESS);
  });
});
