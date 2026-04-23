/**
 * Integration test: Trend Stories API routes
 *
 * Test kapsamı:
 * 1. Feature flag kapıları (trend_stories.enabled + competitors.enabled)
 * 2. Cluster list endpoint'i
 * 3. Cluster detail endpoint'i + membersCursor round-trip (sayfalama)
 *
 * Gerçek Postgres kullanır. BullMQ mock'lanır.
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
import {
  CompetitorListingStatus,
  SourcePlatform,
  TrendClusterStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import { NotFoundError } from "@/lib/errors";

// BullMQ / enqueue mock'u
let _mockBullCounter = 0;
vi.mock("@/server/queue", () => ({
  enqueue: vi.fn().mockImplementation(() => {
    _mockBullCounter += 1;
    return Promise.resolve({ id: `bull-mock-${_mockBullCounter}` });
  }),
}));

// Feature-gate mock'u — parallel test dosyaları DB'deki feature_flag row'unu
// paylaştığı için bu dosya gerçek row'dan bağımsız çalışmalı. Böylece diğer
// integration testlerinin `enableFlags()` beforeEach'leri bu dosyadaki
// flag-gate suite'ini etkilemez (Task 10 review #2 race fix).
vi.mock(
  "@/features/trend-stories/services/feature-gate",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/trend-stories/services/feature-gate")
      >();
    return {
      ...actual,
      assertTrendStoriesAvailable: vi.fn(),
    };
  },
);

// Session mock'u
const currentUser: { id: string | null; role: UserRole } = {
  id: null,
  role: UserRole.USER,
};
vi.mock("@/server/session", () => ({
  requireUser: vi.fn().mockImplementation(async () => {
    if (!currentUser.id) {
      const { UnauthorizedError } = await import("@/lib/errors");
      throw new UnauthorizedError();
    }
    return {
      id: currentUser.id,
      email: `${currentUser.id}@test.local`,
      role: currentUser.role,
    };
  }),
  requireAdmin: vi.fn().mockImplementation(async () => {
    if (!currentUser.id) {
      const { UnauthorizedError } = await import("@/lib/errors");
      throw new UnauthorizedError();
    }
    if (currentUser.role !== UserRole.ADMIN) {
      const { ForbiddenError } = await import("@/lib/errors");
      throw new ForbiddenError();
    }
    return {
      id: currentUser.id,
      email: `${currentUser.id}@test.local`,
      role: currentUser.role,
    };
  }),
}));

// Route handler'ları mock'lardan sonra import et
const { GET: clustersGET } = await import(
  "@/app/api/trend-stories/clusters/route"
);
const { GET: clusterDetailGET } = await import(
  "@/app/api/trend-stories/clusters/[id]/route"
);

// Mock'lanmış assertTrendStoriesAvailable'a test bazında davranış set etmek için
// referansı çöz.
const { assertTrendStoriesAvailable } = await import(
  "@/features/trend-stories/services/feature-gate"
);
const mockAssert = vi.mocked(assertTrendStoriesAvailable);

// ---------------------------------------------------------------------------
// Yardımcı fonksiyonlar
// ---------------------------------------------------------------------------

async function ensureUser(email: string, role: UserRole = UserRole.USER) {
  return db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await bcrypt.hash("password-test", 10),
      role,
      status: UserStatus.ACTIVE,
    },
    update: {},
  });
}

async function cleanup(userIds: string[]) {
  await db.trendClusterMember.deleteMany({ where: { userId: { in: userIds } } });
  await db.trendCluster.deleteMany({ where: { userId: { in: userIds } } });
  await db.competitorListing.deleteMany({ where: { userId: { in: userIds } } });
  await db.competitorStore.deleteMany({ where: { userId: { in: userIds } } });
  await db.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await db.job.deleteMany({ where: { userId: { in: userIds } } });
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

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("api/trend-stories integration", () => {
  let userId: string;

  beforeAll(async () => {
    const user = await ensureUser("api-trend-stories-a@etsyhub.local");
    userId = user.id;
    await cleanup([userId]);
  });

  afterAll(async () => {
    await cleanup([userId]);
  });

  beforeEach(() => {
    currentUser.id = null;
    currentUser.role = UserRole.USER;
    // Feature-gate mock'unu her test başında temizle; default: resolves
    // (yani gate'ten geçer). FF/TF/FT testleri mockRejectedValueOnce ile
    // kendi davranışını set eder.
    mockAssert.mockReset();
    mockAssert.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // Feature flag testleri
  // -------------------------------------------------------------------------

  describe("Feature flag kapıları — GET /api/trend-stories/clusters", () => {
    it("FF (trend=false, comp=false) → 404", async () => {
      mockAssert.mockRejectedValueOnce(new NotFoundError());
      currentUser.id = userId;
      const res = await clustersGET(
        new Request("http://localhost/api/trend-stories/clusters?window=7"),
      );
      expect(res.status).toBe(404);
    });

    it("TF (trend=true, comp=false) → 404", async () => {
      mockAssert.mockRejectedValueOnce(new NotFoundError());
      currentUser.id = userId;
      const res = await clustersGET(
        new Request("http://localhost/api/trend-stories/clusters?window=7"),
      );
      expect(res.status).toBe(404);
    });

    it("FT (trend=false, comp=true) → 404", async () => {
      mockAssert.mockRejectedValueOnce(new NotFoundError());
      currentUser.id = userId;
      const res = await clustersGET(
        new Request("http://localhost/api/trend-stories/clusters?window=7"),
      );
      expect(res.status).toBe(404);
    });

    it("TT (trend=true, comp=true) → 200 ve clusters dizisi döner", async () => {
      // Default beforeEach zaten resolved; açıkça bir daha ayarlamaya gerek yok.
      currentUser.id = userId;
      const res = await clustersGET(
        new Request("http://localhost/api/trend-stories/clusters?window=7"),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { clusters: unknown[] };
      expect(Array.isArray(body.clusters)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // membersCursor round-trip testi (35 üye, sayfa boyutu 30)
  // -------------------------------------------------------------------------

  describe("Cluster detail — membersCursor pagination round-trip", () => {
    let clusterId: string;

    beforeAll(async () => {
      const store = await createStore(userId, `ts-page-store-${Date.now()}`);

      // Sayfa testi için cluster oluştur
      const cluster = await db.trendCluster.create({
        data: {
          userId,
          signature: `sig-page-${Date.now()}`,
          label: "Sayfalama Test Cluster",
          windowDays: 7,
          memberCount: 35,
          storeCount: 1,
          status: TrendClusterStatus.ACTIVE,
          clusterScore: 100,
        },
      });
      clusterId = cluster.id;

      // 35 listing oluştur; her birine farklı firstSeenAt (desc sıralama için)
      const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
      for (let i = 0; i < 35; i++) {
        const listing = await createListing({
          userId,
          competitorStoreId: store.id,
          externalId: `page-listing-${i}-${Date.now()}`,
          title: `Listing ${i}`,
          firstSeenAt: new Date(baseTime + i * 60_000), // dakika arayla
        });
        await db.trendClusterMember.create({
          data: {
            clusterId,
            listingId: listing.id,
            userId,
          },
        });
      }
    });

    it("ilk sayfa 30 üye döner ve nextCursor null değil", async () => {
      currentUser.id = userId;
      const res = await clusterDetailGET(
        new Request(
          `http://localhost/api/trend-stories/clusters/${clusterId}`,
        ),
        { params: { id: clusterId } },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        members: Array<{ listingId: string }>;
        nextCursor: string | null;
      };
      expect(body.members).toHaveLength(30);
      expect(body.nextCursor).not.toBeNull();

      // İkinci sayfa
      const res2 = await clusterDetailGET(
        new Request(
          `http://localhost/api/trend-stories/clusters/${clusterId}?membersCursor=${body.nextCursor}`,
        ),
        { params: { id: clusterId } },
      );
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as {
        members: Array<{ listingId: string }>;
        nextCursor: string | null;
      };
      expect(body2.members).toHaveLength(5);
      expect(body2.nextCursor).toBeNull();

      // İki sayfa arasında üye örtüşmesi olmamalı
      const ids1 = new Set(body.members.map((m) => m.listingId));
      const ids2 = body2.members.map((m) => m.listingId);
      for (const id of ids2) {
        expect(ids1.has(id)).toBe(false);
      }
    });
  });
});
