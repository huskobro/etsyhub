/**
 * Integration test: TREND_CLUSTER_UPDATE worker + recomputeTrendClustersForUser
 *
 * Gerçek Postgres + Redis kullanır (docker compose up olmalı).
 * Worker handler doğrudan çağrılır — BullMQ queue round-trip kullanılmaz.
 * Test izolasyonu: zaman damgalı unique email'ler, beforeAll/afterAll cleanup.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import {
  CompetitorListingStatus,
  JobStatus,
  JobType,
  SourcePlatform,
  TrendClusterStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import { handleTrendClusterUpdate } from "@/server/workers/trend-cluster-update.worker";

// ---------------------------------------------------------------------------
// Yardımcı fonksiyonlar
// ---------------------------------------------------------------------------

async function createUser(email: string) {
  return db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await bcrypt.hash("test-password", 10),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
    update: {},
  });
}

async function createJobRecord(userId: string) {
  return db.job.create({
    data: {
      userId,
      type: JobType.TREND_CLUSTER_UPDATE,
      status: JobStatus.QUEUED,
    },
  });
}

async function createStore(userId: string, shopName: string) {
  return db.competitorStore.create({
    data: {
      userId,
      etsyShopName: shopName,
      shopUrl: `https://www.etsy.com/shop/${shopName}`,
      platform: SourcePlatform.ETSY,
    },
  });
}

async function createListing(args: {
  userId: string;
  competitorStoreId: string;
  externalId: string;
  title: string;
  firstSeenAt: Date;
  status?: CompetitorListingStatus;
}) {
  return db.competitorListing.create({
    data: {
      userId: args.userId,
      competitorStoreId: args.competitorStoreId,
      externalId: args.externalId,
      platform: SourcePlatform.ETSY,
      sourceUrl: `https://www.etsy.com/listing/${args.externalId}`,
      title: args.title,
      reviewCount: 10,
      firstSeenAt: args.firstSeenAt,
      lastSeenAt: args.firstSeenAt,
      status: args.status ?? CompetitorListingStatus.ACTIVE,
    },
  });
}

/** Son N gün içindeki tarih döner. */
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("TREND_CLUSTER_UPDATE worker", () => {
  // Suffix ile test izolasyonu sağlanır — paralel çalıştırmalarda çakışmaz.
  const suffix = Date.now().toString(36);
  const emailA = `cluster-worker-a-${suffix}@etsyhub.local`;
  const emailB = `cluster-worker-b-${suffix}@etsyhub.local`;

  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const userA = await createUser(emailA);
    const userB = await createUser(emailB);
    userAId = userA.id;
    userBId = userB.id;
  });

  afterAll(async () => {
    // Bağımlı veriler cascade ile silinir; önce Job sonra user temizle.
    for (const uid of [userAId, userBId]) {
      await db.trendClusterMember.deleteMany({ where: { userId: uid } });
      await db.trendCluster.deleteMany({ where: { userId: uid } });
      await db.competitorListing.deleteMany({ where: { userId: uid } });
      await db.competitorStore.deleteMany({ where: { userId: uid } });
      await db.bookmark.deleteMany({ where: { userId: uid } });
      await db.job.deleteMany({ where: { userId: uid } });
    }
  });

  // ---------------------------------------------------------------------------
  // Senaryo 1: 7G penceresinde "boho wall art" konusu 2 store / 3 listing → ACTIVE cluster
  // ---------------------------------------------------------------------------
  describe("Senaryo 1: 7G penceresinde yeterli listing varken ACTIVE cluster oluşur", () => {
    let storeA1Id: string;
    let storeA2Id: string;
    let listingIds: string[];

    beforeAll(async () => {
      // İki farklı competitor store
      const storeA1 = await createStore(userAId, `boho-store-1-${suffix}`);
      const storeA2 = await createStore(userAId, `boho-store-2-${suffix}`);
      storeA1Id = storeA1.id;
      storeA2Id = storeA2.id;

      // 3 listing — aynı "boho wall art" kümesi, son 7 gün içinde, farklı store'lardan
      // Başlıklar "boho wall art" token'larını paylaşıyor → ortak n-gram oluşur.
      const l1 = await createListing({
        userId: userAId,
        competitorStoreId: storeA1Id,
        externalId: `boho-001-${suffix}`,
        title: "Boho Wall Art Print Modern",
        firstSeenAt: daysAgo(2),
      });
      const l2 = await createListing({
        userId: userAId,
        competitorStoreId: storeA1Id,
        externalId: `boho-002-${suffix}`,
        title: "Boho Wall Art Digital Print",
        firstSeenAt: daysAgo(3),
      });
      const l3 = await createListing({
        userId: userAId,
        competitorStoreId: storeA2Id,
        externalId: `boho-003-${suffix}`,
        title: "Boho Wall Art Printable Decor",
        firstSeenAt: daysAgo(4),
      });
      listingIds = [l1.id, l2.id, l3.id];
    });

    afterAll(async () => {
      await db.trendClusterMember.deleteMany({ where: { userId: userAId } });
      await db.trendCluster.deleteMany({ where: { userId: userAId } });
      await db.competitorListing.deleteMany({
        where: { id: { in: listingIds } },
      });
      await db.competitorStore.deleteMany({
        where: { id: { in: [storeA1Id, storeA2Id] } },
      });
    });

    it("recompute sonrası ACTIVE TrendCluster oluşturur — memberCount>=3, storeCount>=2", async () => {
      const job = await createJobRecord(userAId);

      await handleTrendClusterUpdate({ data: { jobId: job.id, userId: userAId } });

      // Job başarılı mı?
      const updatedJob = await db.job.findUniqueOrThrow({
        where: { id: job.id },
      });
      expect(updatedJob.status).toBe(JobStatus.SUCCESS);
      expect(updatedJob.progress).toBe(100);
      expect(updatedJob.finishedAt).not.toBeNull();

      // User A için ACTIVE cluster var mı?
      const clusters = await db.trendCluster.findMany({
        where: { userId: userAId, status: TrendClusterStatus.ACTIVE },
        include: { members: true },
      });
      expect(clusters.length).toBeGreaterThanOrEqual(1);

      // En az bir cluster'da memberCount >= 3 ve storeCount >= 2 olmalı
      const relevantCluster = clusters.find(
        (c) => c.memberCount >= 3 && c.storeCount >= 2,
      );
      expect(
        relevantCluster,
        "7G penceresinde memberCount>=3 ve storeCount>=2 olan ACTIVE cluster bekleniyor",
      ).toBeDefined();

      // windowDays 7 olan cluster bulunmalı (WINDOW_DAYS const'undan)
      const window7Cluster = clusters.find((c) => c.windowDays === 7);
      expect(window7Cluster).toBeDefined();
      if (window7Cluster) {
        expect(window7Cluster.status).toBe(TrendClusterStatus.ACTIVE);
      }

      // TrendClusterMember'lar doğru set'i içermeli
      const memberClusters = clusters.filter(
        (c) => c.memberCount >= 3 && c.storeCount >= 2,
      );
      for (const cluster of memberClusters) {
        const memberListingIds = cluster.members.map((m) => m.listingId);
        // Hiçbir üye başka user'ın listing'i olmamalı
        for (const memberId of memberListingIds) {
          expect(listingIds).toContain(memberId);
        }
      }

      // Job cleanup
      await db.job.delete({ where: { id: job.id } });
    });
  });

  // ---------------------------------------------------------------------------
  // Senaryo 2: Eşik altına düşünce cluster STALE olur
  // ---------------------------------------------------------------------------
  describe("Senaryo 2: Eşik altına düşünce ACTIVE cluster STALE olur", () => {
    let storeS1Id: string;
    let storeS2Id: string;
    let listingS1Id: string;
    let listingS2Id: string;
    let listingS3Id: string;

    beforeAll(async () => {
      const storeS1 = await createStore(userAId, `stale-store-1-${suffix}`);
      const storeS2 = await createStore(userAId, `stale-store-2-${suffix}`);
      storeS1Id = storeS1.id;
      storeS2Id = storeS2.id;

      const l1 = await createListing({
        userId: userAId,
        competitorStoreId: storeS1Id,
        externalId: `stale-001-${suffix}`,
        title: "Minimalist Art Canvas Modern",
        firstSeenAt: daysAgo(2),
      });
      const l2 = await createListing({
        userId: userAId,
        competitorStoreId: storeS1Id,
        externalId: `stale-002-${suffix}`,
        title: "Minimalist Art Canvas Print",
        firstSeenAt: daysAgo(3),
      });
      const l3 = await createListing({
        userId: userAId,
        competitorStoreId: storeS2Id,
        externalId: `stale-003-${suffix}`,
        title: "Minimalist Art Canvas Decor",
        firstSeenAt: daysAgo(4),
      });
      listingS1Id = l1.id;
      listingS2Id = l2.id;
      listingS3Id = l3.id;
    });

    afterAll(async () => {
      await db.trendClusterMember.deleteMany({
        where: { userId: userAId, listingId: { in: [listingS1Id, listingS2Id, listingS3Id] } },
      });
      await db.trendCluster.deleteMany({
        where: { userId: userAId, signature: { contains: "minimalist art" } },
      });
      await db.competitorListing.deleteMany({
        where: { id: { in: [listingS1Id, listingS2Id, listingS3Id] } },
      });
      await db.competitorStore.deleteMany({
        where: { id: { in: [storeS1Id, storeS2Id] } },
      });
    });

    it("önce ACTIVE cluster oluşur, sonra listing'ler DELETED yapılınca cluster STALE olur", async () => {
      // İlk recompute → ACTIVE cluster oluşmalı
      const job1 = await createJobRecord(userAId);
      await handleTrendClusterUpdate({
        data: { jobId: job1.id, userId: userAId },
      });
      await db.job.delete({ where: { id: job1.id } });

      // ACTIVE cluster var mı?
      const activeClusters = await db.trendCluster.findMany({
        where: { userId: userAId, status: TrendClusterStatus.ACTIVE },
      });
      expect(activeClusters.length).toBeGreaterThanOrEqual(1);

      // Listing'leri DELETED yap → eşik altına düşsün
      await db.competitorListing.updateMany({
        where: { id: { in: [listingS1Id, listingS2Id, listingS3Id] } },
        data: { status: CompetitorListingStatus.DELETED },
      });

      // İkinci recompute → cluster STALE olmalı
      const job2 = await createJobRecord(userAId);
      await handleTrendClusterUpdate({
        data: { jobId: job2.id, userId: userAId },
      });

      // Job başarılı mı?
      const updatedJob2 = await db.job.findUniqueOrThrow({
        where: { id: job2.id },
      });
      expect(updatedJob2.status).toBe(JobStatus.SUCCESS);
      await db.job.delete({ where: { id: job2.id } });

      // Artık bu user için ACTIVE cluster kalmamış olmalı
      // (Önceki senaryonun cluster'ları da STALE olmuş olabilir — sadece bu userA için kontrol ediyoruz)
      const remainingActive = await db.trendCluster.findMany({
        where: {
          userId: userAId,
          status: TrendClusterStatus.ACTIVE,
        },
      });

      // Silinen listing'lerle oluşan cluster STALE olmalı
      const staleCluster = await db.trendCluster.findFirst({
        where: {
          userId: userAId,
          status: TrendClusterStatus.STALE,
        },
      });
      expect(staleCluster).not.toBeNull();

      // computedAt güncel olmalı (birkaç ms önce)
      if (staleCluster) {
        const ageMs = Date.now() - staleCluster.computedAt.getTime();
        expect(ageMs).toBeLessThan(10_000); // 10 sn içinde güncellenmeli
      }

      // Kalan ACTIVE cluster'ların hiçbirinde bu listing'ler member olmamalı
      for (const activeCluster of remainingActive) {
        const members = await db.trendClusterMember.findMany({
          where: {
            clusterId: activeCluster.id,
            listingId: { in: [listingS1Id, listingS2Id, listingS3Id] },
          },
        });
        expect(members).toHaveLength(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Senaryo 3: STALE sonrası Bookmark.trendClusterLabelSnapshot korunur
  // ---------------------------------------------------------------------------
  describe("Senaryo 3: STALE'e düşen cluster'a bağlı Bookmark snapshot'ı korunur", () => {
    // Schema kontrolü: Bookmark modelinde trendClusterId + trendClusterLabelSnapshot mevcut.
    // prisma/schema.prisma → Bookmark: trendClusterId, trendClusterLabelSnapshot, trendWindowDaysSnapshot
    // Bu senaryo SKIP DEĞİL — alanlar mevcut.

    let storeSnapId: string;
    let storeSnap2Id: string;
    let listingSn1Id: string;
    let listingSn2Id: string;
    let listingSn3Id: string;
    let clusterId: string;
    let bookmarkId: string;
    const snapshotLabel = "snapshot wall art canvas";

    beforeAll(async () => {
      const storeSnap1 = await createStore(userAId, `snap-store-1-${suffix}`);
      const storeSnap2 = await createStore(userAId, `snap-store-2-${suffix}`);
      storeSnapId = storeSnap1.id;
      storeSnap2Id = storeSnap2.id;

      const l1 = await createListing({
        userId: userAId,
        competitorStoreId: storeSnap1.id,
        externalId: `snap-001-${suffix}`,
        title: "Canvas Wall Art Abstract Modern",
        firstSeenAt: daysAgo(2),
      });
      const l2 = await createListing({
        userId: userAId,
        competitorStoreId: storeSnap1.id,
        externalId: `snap-002-${suffix}`,
        title: "Canvas Wall Art Nordic Print",
        firstSeenAt: daysAgo(3),
      });
      const l3 = await createListing({
        userId: userAId,
        competitorStoreId: storeSnap2.id,
        externalId: `snap-003-${suffix}`,
        title: "Canvas Wall Art Boho Style",
        firstSeenAt: daysAgo(4),
      });
      listingSn1Id = l1.id;
      listingSn2Id = l2.id;
      listingSn3Id = l3.id;

      // İlk recompute → ACTIVE cluster oluştur
      const job1 = await createJobRecord(userAId);
      await handleTrendClusterUpdate({
        data: { jobId: job1.id, userId: userAId },
      });
      await db.job.delete({ where: { id: job1.id } });

      // Oluşan ACTIVE cluster'lardan birini al
      const activeCluster = await db.trendCluster.findFirst({
        where: { userId: userAId, status: TrendClusterStatus.ACTIVE },
      });
      expect(activeCluster).not.toBeNull();
      clusterId = activeCluster!.id;

      // Bookmark oluştur — trendClusterId + trendClusterLabelSnapshot ile
      const bookmark = await db.bookmark.create({
        data: {
          userId: userAId,
          title: "Snapshot test bookmark",
          trendClusterId: clusterId,
          trendClusterLabelSnapshot: snapshotLabel,
          trendWindowDaysSnapshot: 7,
        },
      });
      bookmarkId = bookmark.id;

      // Listing'leri DELETED yap → cluster STALE'e düşsün
      await db.competitorListing.updateMany({
        where: {
          id: { in: [listingSn1Id, listingSn2Id, listingSn3Id] },
        },
        data: { status: CompetitorListingStatus.DELETED },
      });

      // İkinci recompute → STALE
      const job2 = await createJobRecord(userAId);
      await handleTrendClusterUpdate({
        data: { jobId: job2.id, userId: userAId },
      });
      await db.job.delete({ where: { id: job2.id } });
    });

    afterAll(async () => {
      if (bookmarkId) {
        await db.bookmark.deleteMany({ where: { id: bookmarkId } });
      }
      await db.trendClusterMember.deleteMany({
        where: {
          listingId: { in: [listingSn1Id, listingSn2Id, listingSn3Id] },
        },
      });
      await db.trendCluster.deleteMany({
        where: { userId: userAId, id: clusterId },
      });
      await db.competitorListing.deleteMany({
        where: { id: { in: [listingSn1Id, listingSn2Id, listingSn3Id] } },
      });
      await db.competitorStore.deleteMany({
        where: { id: { in: [storeSnapId, storeSnap2Id] } },
      });
    });

    it("cluster STALE olsa da Bookmark.trendClusterLabelSnapshot aynen korunur", async () => {
      // Cluster STALE olmalı
      const cluster = await db.trendCluster.findUnique({
        where: { id: clusterId },
      });
      expect(cluster?.status).toBe(TrendClusterStatus.STALE);

      // Bookmark snapshot değişmemiş olmalı — cluster STALE ama silinmedi
      const bookmark = await db.bookmark.findUniqueOrThrow({
        where: { id: bookmarkId },
      });
      expect(bookmark.trendClusterId).toBe(clusterId);
      expect(bookmark.trendClusterLabelSnapshot).toBe(snapshotLabel);
      expect(bookmark.trendWindowDaysSnapshot).toBe(7);
    });
  });

  // ---------------------------------------------------------------------------
  // Senaryo 4: User B verisi User A cluster'ına karışmaz
  // ---------------------------------------------------------------------------
  describe("Senaryo 4: User B listingleri User A cluster'larına karışmaz", () => {
    let storeA_iso: string;
    let storeB_iso: string;
    let storeA2_iso: string;
    let listingA1Id: string;
    let listingA2Id: string;
    let listingA3Id: string;
    let listingB1Id: string;
    let listingB2Id: string;
    let listingB3Id: string;

    beforeAll(async () => {
      // Her iki user için aynı başlıklı listing'ler (potansiyel karışma riski)
      const sA1 = await createStore(userAId, `iso-store-a1-${suffix}`);
      const sA2 = await createStore(userAId, `iso-store-a2-${suffix}`);
      const sB1 = await createStore(userBId, `iso-store-b1-${suffix}`);
      storeA_iso = sA1.id;
      storeA2_iso = sA2.id;
      storeB_iso = sB1.id;

      // User A listing'leri
      const la1 = await createListing({
        userId: userAId,
        competitorStoreId: storeA_iso,
        externalId: `iso-a-001-${suffix}`,
        title: "Nordic Print Poster Art",
        firstSeenAt: daysAgo(2),
      });
      const la2 = await createListing({
        userId: userAId,
        competitorStoreId: storeA_iso,
        externalId: `iso-a-002-${suffix}`,
        title: "Nordic Print Poster Modern",
        firstSeenAt: daysAgo(3),
      });
      const la3 = await createListing({
        userId: userAId,
        competitorStoreId: storeA2_iso,
        externalId: `iso-a-003-${suffix}`,
        title: "Nordic Print Poster Wall",
        firstSeenAt: daysAgo(4),
      });

      // User B listing'leri — aynı başlık pattern
      const lb1 = await createListing({
        userId: userBId,
        competitorStoreId: storeB_iso,
        externalId: `iso-b-001-${suffix}`,
        title: "Nordic Print Poster Art",
        firstSeenAt: daysAgo(2),
      });
      const lb2 = await createListing({
        userId: userBId,
        competitorStoreId: storeB_iso,
        externalId: `iso-b-002-${suffix}`,
        title: "Nordic Print Poster Modern",
        firstSeenAt: daysAgo(3),
      });
      const lb3 = await createListing({
        userId: userBId,
        competitorStoreId: storeB_iso,
        externalId: `iso-b-003-${suffix}`,
        title: "Nordic Print Poster Wall",
        firstSeenAt: daysAgo(4),
      });

      listingA1Id = la1.id;
      listingA2Id = la2.id;
      listingA3Id = la3.id;
      listingB1Id = lb1.id;
      listingB2Id = lb2.id;
      listingB3Id = lb3.id;
    });

    afterAll(async () => {
      const allListings = [
        listingA1Id,
        listingA2Id,
        listingA3Id,
        listingB1Id,
        listingB2Id,
        listingB3Id,
      ];
      await db.trendClusterMember.deleteMany({
        where: { listingId: { in: allListings } },
      });
      await db.trendCluster.deleteMany({
        where: { userId: { in: [userAId, userBId] }, signature: { contains: "nordic" } },
      });
      await db.competitorListing.deleteMany({
        where: { id: { in: allListings } },
      });
      await db.competitorStore.deleteMany({
        where: {
          id: { in: [storeA_iso, storeA2_iso, storeB_iso] },
        },
      });
    });

    it("User A recompute → cluster member'ları sadece User A listing'leri, User B ID'leri dahil değil", async () => {
      const job = await createJobRecord(userAId);
      await handleTrendClusterUpdate({
        data: { jobId: job.id, userId: userAId },
      });
      await db.job.delete({ where: { id: job.id } });

      // User A cluster'larını al
      const userAClusters = await db.trendCluster.findMany({
        where: { userId: userAId },
        include: { members: true },
      });

      // User A için cluster oluşmuş olmalı
      expect(userAClusters.length).toBeGreaterThanOrEqual(1);

      const userAListingIds = new Set([listingA1Id, listingA2Id, listingA3Id]);
      const userBListingIds = new Set([listingB1Id, listingB2Id, listingB3Id]);

      for (const cluster of userAClusters) {
        // Her cluster'ın userId'si User A olmalı
        expect(cluster.userId).toBe(userAId);

        // Member listing'lerden hiçbiri User B'ye ait olmamalı
        for (const member of cluster.members) {
          expect(userBListingIds.has(member.listingId)).toBe(false);
          // User A'nın listing'lerinden biri olmalı
          expect(userAListingIds.has(member.listingId)).toBe(true);
          // Member userId de User A olmalı
          expect(member.userId).toBe(userAId);
        }
      }

      // User B için cluster oluşmamış olmalı (User B recompute yapılmadı)
      const userBClusters = await db.trendCluster.findMany({
        where: { userId: userBId },
      });
      expect(userBClusters).toHaveLength(0);
    });

    it("User B recompute kendi store'larını kendi cluster'ına yazar, User A'ya karışmaz", async () => {
      const job = await createJobRecord(userBId);
      await handleTrendClusterUpdate({
        data: { jobId: job.id, userId: userBId },
      });
      await db.job.delete({ where: { id: job.id } });

      // User B için cluster oluşmuş olabilir (tek store, minStore=2 gereği oluşmayabilir)
      const userBClusters = await db.trendCluster.findMany({
        where: { userId: userBId },
        include: { members: true },
      });

      // User B'nin cluster'larına User A listing'leri karışmamalı
      const userAListingIds = new Set([listingA1Id, listingA2Id, listingA3Id]);
      for (const cluster of userBClusters) {
        expect(cluster.userId).toBe(userBId);
        for (const member of cluster.members) {
          expect(userAListingIds.has(member.listingId)).toBe(false);
          expect(member.userId).toBe(userBId);
        }
      }

      // User A cluster'larında User B listing'leri hâlâ yok
      const userAClusters = await db.trendCluster.findMany({
        where: { userId: userAId },
        include: { members: true },
      });
      const userBListingIds = new Set([listingB1Id, listingB2Id, listingB3Id]);
      for (const cluster of userAClusters) {
        for (const member of cluster.members) {
          expect(userBListingIds.has(member.listingId)).toBe(false);
        }
      }
    });
  });
});
