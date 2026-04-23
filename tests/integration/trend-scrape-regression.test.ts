/**
 * Regression testi: Scrape worker SUCCESS → Trend Cluster enqueue tetiklenir.
 *
 * Gerçek Postgres kullanır (docker compose up olmalı).
 * Worker handler doğrudan çağrılır — BullMQ queue round-trip kullanılmaz.
 * enqueueTrendClusterUpdate modülü Vitest ile mock'lanır.
 * getScraper da mock'lanır — gerçek Apify çağrısı yapılmaz.
 *
 * Senaryolar:
 *   1. Happy path: scrape SUCCESS → enqueueTrendClusterUpdate çağrılır,
 *      TREND_CLUSTER_UPDATE type'lı job DB'de oluşur.
 *   2. Non-blocking failure: enqueue throw → scrape yine SUCCESS,
 *      scan.metadata.trendEnqueueError hata mesajını içerir.
 *   3. Data isolation: User A scrape'i → trend enqueue yalnızca User A userId ile çağrılır.
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
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

// ---------------------------------------------------------------------------
// Mock: @/features/trend-stories/services/trend-update-scheduler
// Vitest bu mock'u modül yüklemesinden önce hoistlar.
// ---------------------------------------------------------------------------
vi.mock(
  "@/features/trend-stories/services/trend-update-scheduler",
  () => ({
    enqueueTrendClusterUpdate: vi.fn(),
  }),
);

// ---------------------------------------------------------------------------
// Mock: @/providers/scraper
// Gerçek Apify/Firecrawl çağrısını engellemek için.
// ---------------------------------------------------------------------------

/** Mock provider — test başına kontrol edilebilir listing seti döndürür. */
let mockListings: ScrapedListing[] = [];
let mockStore: ScrapedStore = {
  etsyShopName: "regression-mockshop",
  platform: SourcePlatform.ETSY,
  displayName: "Regression Mock Shop",
  shopUrl: "https://www.etsy.com/shop/regression-mockshop",
  totalListings: 0,
  totalReviews: 0,
};

const mockScraperProvider: ScraperProvider = {
  name: "self-hosted" as ScraperProviderName,
  scanStore: vi.fn(async (): Promise<ScanResult> => ({
    store: { ...mockStore, totalListings: mockListings.length },
    listings: mockListings,
    scanMeta: {
      provider: "self-hosted",
      durationMs: 10,
      apiCreditsUsed: undefined,
      parseWarnings: [],
    },
  })),
  parseSingleListing: vi.fn(async () => {
    throw new Error("test'te kullanılmaz");
  }),
};

vi.mock("@/providers/scraper", () => ({
  getScraper: vi.fn(async () => mockScraperProvider),
}));

// Worker import'ı mock'lardan SONRA gelir — Vitest hoisting garantisi için.
const { handleScrapeCompetitor } = await import(
  "@/server/workers/scrape-competitor.worker"
);

// Mock scheduler import — vi.mocked ile davranış kontrolü için.
const { enqueueTrendClusterUpdate } = await import(
  "@/features/trend-stories/services/trend-update-scheduler"
);

// ---------------------------------------------------------------------------
// Tip yardımcıları
// ---------------------------------------------------------------------------

type WorkerJobData = {
  jobId: string;
  scanId: string;
  userId: string;
  competitorStoreId: string;
  type: CompetitorScanType;
};

function buildJob(data: WorkerJobData): Job<WorkerJobData> {
  return { data } as Job<WorkerJobData>;
}

function makeListing(
  externalId: string,
  overrides: Partial<ScrapedListing> = {},
): ScrapedListing {
  return {
    externalId,
    platform: SourcePlatform.ETSY,
    sourceUrl: `https://www.etsy.com/listing/${externalId}`,
    title: `Regression listing ${externalId}`,
    thumbnailUrl: null,
    imageUrls: [],
    priceCents: 999,
    currency: "USD",
    reviewCount: 5,
    favoritesCount: null,
    listingCreatedAt: null,
    latestReviewAt: null,
    parserSource: "mock",
    parserConfidence: 80,
    parseWarnings: [],
    status: CompetitorListingStatus.ACTIVE,
    rawMetadata: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DB yardımcıları
// ---------------------------------------------------------------------------

async function ensureUser(email: string) {
  return db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await bcrypt.hash("regression-test-pw", 10),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
    update: {},
  });
}

/** Competitor store + SCRAPE job + CompetitorScan kaydı oluşturur. */
async function seedFixtures(userId: string, shopSuffix: string) {
  const store = await db.competitorStore.create({
    data: {
      userId,
      etsyShopName: `reg-shop-${shopSuffix}`,
      shopUrl: `https://www.etsy.com/shop/reg-shop-${shopSuffix}`,
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

/** Kullanıcıya ait tüm test verilerini temizler. */
async function cleanupUser(userId: string) {
  await db.competitorListing.deleteMany({ where: { userId } });
  await db.competitorScan.deleteMany({ where: { userId } });
  await db.competitorStore.deleteMany({ where: { userId } });
  await db.job.deleteMany({ where: { userId } });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Trend + Scrape regression — SUCCESS branch", () => {
  // Zaman damgalı suffix ile paralel çalışmada çakışma olmaz.
  const suffix = Date.now().toString(36);

  const emailA = `reg-user-a-${suffix}@etsyhub.local`;
  const emailB = `reg-user-b-${suffix}@etsyhub.local`;

  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const userA = await ensureUser(emailA);
    const userB = await ensureUser(emailB);
    userAId = userA.id;
    userBId = userB.id;
  });

  afterAll(async () => {
    await cleanupUser(userAId);
    await cleanupUser(userBId);
    await db.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
  });

  beforeEach(async () => {
    // Her test öncesinde mock'ların çağrı geçmişini sıfırla ve
    // varsayılan davranışı "enqueued" olarak ayarla.
    vi.mocked(enqueueTrendClusterUpdate).mockReset();
    vi.mocked(enqueueTrendClusterUpdate).mockResolvedValue({
      status: "enqueued",
      jobId: "mock-trend-job-id",
    });

    // Listing varsayılanını sıfırla.
    mockListings = [makeListing("r-001"), makeListing("r-002")];
    mockStore = {
      etsyShopName: "regression-mockshop",
      platform: SourcePlatform.ETSY,
      displayName: "Regression Mock Shop",
      shopUrl: "https://www.etsy.com/shop/regression-mockshop",
      totalListings: 2,
      totalReviews: 0,
    };

    // Senaryolar arası birikim engellemek için scan/listing/job kayıtlarını temizle.
    // User fixture'larına (userAId, userBId) dokunulmaz.
    await db.competitorListing.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await db.competitorScan.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await db.competitorStore.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
    await db.job.deleteMany({
      where: { userId: { in: [userAId, userBId] } },
    });
  });

  // -------------------------------------------------------------------------
  // Senaryo 1 — Happy path
  // -------------------------------------------------------------------------
  describe("Senaryo 1: Happy path — scrape SUCCESS → trend enqueue tetiklenir", () => {
    it("enqueueTrendClusterUpdate çağrılır; scrape job + scan SUCCESS olur", async () => {
      const { store, job, scan } = await seedFixtures(
        userAId,
        `s1-${suffix}`,
      );

      await handleScrapeCompetitor(
        buildJob({
          jobId: job.id,
          scanId: scan.id,
          userId: userAId,
          competitorStoreId: store.id,
          type: CompetitorScanType.INITIAL_FULL,
        }),
      );

      // --- Scrape job SUCCESS mu? ---
      const finalJob = await db.job.findUniqueOrThrow({
        where: { id: job.id },
      });
      expect(finalJob.status).toBe(JobStatus.SUCCESS);
      expect(finalJob.progress).toBe(100);

      // --- Scan SUCCESS mu? ---
      const finalScan = await db.competitorScan.findUniqueOrThrow({
        where: { id: scan.id },
      });
      expect(finalScan.status).toBe(CompetitorScanStatus.SUCCESS);

      // --- enqueueTrendClusterUpdate çağrıldı mı? ---
      expect(vi.mocked(enqueueTrendClusterUpdate)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(enqueueTrendClusterUpdate)).toHaveBeenCalledWith(
        userAId,
      );

      // --- Scan metadata'da trendEnqueueError YOK (başarılı yol) ---
      const metaObj = finalScan.metadata;
      if (
        metaObj !== null &&
        typeof metaObj === "object" &&
        !Array.isArray(metaObj)
      ) {
        expect(
          (metaObj as Record<string, unknown>)["trendEnqueueError"],
        ).toBeUndefined();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Senaryo 2 — Non-blocking failure
  // -------------------------------------------------------------------------
  describe("Senaryo 2: Non-blocking failure — enqueue hata verse scrape SUCCESS kalır", () => {
    it("scrape SUCCESS; scan.metadata.trendEnqueueError hata mesajını içerir", async () => {
      // enqueueTrendClusterUpdate hata fırlatsın
      vi.mocked(enqueueTrendClusterUpdate).mockRejectedValue(
        new Error("redis down"),
      );

      const { store, job, scan } = await seedFixtures(
        userAId,
        `s2-${suffix}`,
      );

      // Worker çalıştır — hata fırlatmamalı
      await expect(
        handleScrapeCompetitor(
          buildJob({
            jobId: job.id,
            scanId: scan.id,
            userId: userAId,
            competitorStoreId: store.id,
            type: CompetitorScanType.INITIAL_FULL,
          }),
        ),
      ).resolves.not.toThrow();

      // --- Scrape job STATUS = SUCCESS ---
      const finalJob = await db.job.findUniqueOrThrow({
        where: { id: job.id },
      });
      expect(finalJob.status).toBe(JobStatus.SUCCESS);

      // --- Scan STATUS = SUCCESS ---
      const finalScan = await db.competitorScan.findUniqueOrThrow({
        where: { id: scan.id },
      });
      expect(finalScan.status).toBe(CompetitorScanStatus.SUCCESS);

      // --- scan.metadata objesi vardır ve trendEnqueueError içerir ---
      expect(finalScan.metadata).not.toBeNull();
      expect(typeof finalScan.metadata).toBe("object");
      const meta = finalScan.metadata as Record<string, unknown>;
      expect(meta["trendEnqueueError"]).toBe("redis down");
    });

    it("önceki scan metadata alanları spread pattern ile korunur", async () => {
      // Scan'e önceden var olan metadata alanı ekle
      const { store, job, scan } = await seedFixtures(
        userAId,
        `s2b-${suffix}`,
      );

      // Scan'e başlangıç metadata'sı yaz
      await db.competitorScan.update({
        where: { id: scan.id },
        data: { metadata: { existingField: "korunmalı", count: 42 } },
      });

      vi.mocked(enqueueTrendClusterUpdate).mockRejectedValue(
        new Error("timeout"),
      );

      await handleScrapeCompetitor(
        buildJob({
          jobId: job.id,
          scanId: scan.id,
          userId: userAId,
          competitorStoreId: store.id,
          type: CompetitorScanType.INITIAL_FULL,
        }),
      );

      const finalScan = await db.competitorScan.findUniqueOrThrow({
        where: { id: scan.id },
      });

      const meta = finalScan.metadata as Record<string, unknown>;
      // Yeni alan eklendi
      expect(meta["trendEnqueueError"]).toBe("timeout");
      // Önceki alanlar korundu (spread pattern doğrulaması)
      expect(meta["existingField"]).toBe("korunmalı");
      expect(meta["count"]).toBe(42);
    });
  });

  // -------------------------------------------------------------------------
  // Senaryo 3 — Data isolation
  // -------------------------------------------------------------------------
  describe("Senaryo 3: Data isolation — enqueue sadece ilgili userId ile çağrılır", () => {
    it("User A scrape'i → enqueue User A userId ile çağrılır, User B ile çağrılmaz", async () => {
      // Her iki kullanıcıya da fixture hazırla
      const { store: storeA, job: jobA, scan: scanA } = await seedFixtures(
        userAId,
        `s3a-${suffix}`,
      );
      await seedFixtures(userBId, `s3b-${suffix}`);

      // Yalnızca User A scrape'i çalıştır
      await handleScrapeCompetitor(
        buildJob({
          jobId: jobA.id,
          scanId: scanA.id,
          userId: userAId,
          competitorStoreId: storeA.id,
          type: CompetitorScanType.INITIAL_FULL,
        }),
      );

      // enqueueTrendClusterUpdate tam olarak 1 kez ve User A id'siyle çağrılmalı
      expect(vi.mocked(enqueueTrendClusterUpdate)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(enqueueTrendClusterUpdate)).toHaveBeenCalledWith(
        userAId,
      );

      // User B ID'siyle HİÇ çağrılmamalı
      const calls = vi.mocked(enqueueTrendClusterUpdate).mock.calls;
      for (const call of calls) {
        expect(call[0]).not.toBe(userBId);
      }
    });
  });
});
