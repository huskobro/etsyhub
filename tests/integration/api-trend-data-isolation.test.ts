/**
 * Integration test: Trend Stories API veri izolasyonu
 *
 * Test kapsamı:
 * 1. User A'nın cluster'ına User B erişemez → 404
 * 2. User A'nın feed item'ları User B'nin feed'inde görünmez
 * 3. clusters endpoint yalnızca ilgili kullanıcının cluster'larını döner
 * 4. Admin olmayan kullanıcı recompute endpoint'ini çağıramaz → 403
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

// BullMQ mock'u
let _mockBullCounter = 0;
vi.mock("@/server/queue", () => ({
  enqueue: vi.fn().mockImplementation(() => {
    _mockBullCounter += 1;
    return Promise.resolve({ id: `bull-mock-${_mockBullCounter}` });
  }),
}));

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
const { GET: feedGET } = await import(
  "@/app/api/trend-stories/feed/route"
);
const { POST: recomputePOST } = await import(
  "@/app/api/admin/trend-clusters/recompute/route"
);

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

async function enableFlags() {
  await db.featureFlag.upsert({
    where: { key: "trend_stories.enabled" },
    create: { key: "trend_stories.enabled", enabled: true },
    update: { enabled: true },
  });
  await db.featureFlag.upsert({
    where: { key: "competitors.enabled" },
    create: { key: "competitors.enabled", enabled: true },
    update: { enabled: true },
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
}) {
  return db.competitorListing.create({
    data: {
      userId: args.userId,
      competitorStoreId: args.competitorStoreId,
      externalId: args.externalId,
      platform: SourcePlatform.ETSY,
      sourceUrl: `https://www.etsy.com/listing/${args.externalId}`,
      title: args.title,
      reviewCount: 5,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      status: CompetitorListingStatus.ACTIVE,
    },
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("api/trend-stories data isolation", () => {
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const a = await ensureUser("api-trend-iso-a@etsyhub.local");
    const b = await ensureUser("api-trend-iso-b@etsyhub.local");
    userAId = a.id;
    userBId = b.id;
    await cleanup([userAId, userBId]);
    await enableFlags();
  });

  afterAll(async () => {
    await cleanup([userAId, userBId]);
  });

  beforeEach(() => {
    currentUser.id = null;
    currentUser.role = UserRole.USER;
  });

  // -------------------------------------------------------------------------
  // Test 1: Cross-user cluster detail → 404
  // -------------------------------------------------------------------------

  it("User B, User A'nın cluster detail'ine erişemez → 404", async () => {
    // User A'ya ait cluster oluştur
    const clusterA = await db.trendCluster.create({
      data: {
        userId: userAId,
        signature: `sig-iso-${Date.now()}`,
        label: "User A Gizli Cluster",
        windowDays: 7,
        memberCount: 1,
        storeCount: 1,
        status: TrendClusterStatus.ACTIVE,
        clusterScore: 50,
      },
    });

    // User B bu cluster'a erişmeye çalışır
    currentUser.id = userBId;
    const res = await clusterDetailGET(
      new Request(
        `http://localhost/api/trend-stories/clusters/${clusterA.id}`,
      ),
      { params: { id: clusterA.id } },
    );
    expect(res.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // Test 2: Feed izolasyonu — sadece kendi listing'leri
  // -------------------------------------------------------------------------

  it("User B'nin feed'inde User A'nın listing'leri görünmez", async () => {
    const ts = Date.now();

    // User A'ya ait store ve listing
    const storeA = await createStore(userAId, `ts-iso-store-a-${ts}`);
    await createListing({
      userId: userAId,
      competitorStoreId: storeA.id,
      externalId: `iso-listing-a-${ts}`,
      title: "User A Listing",
    });

    // User B'ye ait store ve listing
    const storeB = await createStore(userBId, `ts-iso-store-b-${ts}`);
    await createListing({
      userId: userBId,
      competitorStoreId: storeB.id,
      externalId: `iso-listing-b-${ts}`,
      title: "User B Listing",
    });

    // User B'nin feed'i
    currentUser.id = userBId;
    const res = await feedGET(
      new Request("http://localhost/api/trend-stories/feed?window=30"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ competitorStoreId: string }>;
    };

    // Feed'de User A'nın store'u olmamalı
    const storeIds = body.items.map((i) => i.competitorStoreId);
    expect(storeIds).not.toContain(storeA.id);
  });

  // -------------------------------------------------------------------------
  // Test 3: Clusters endpoint izolasyonu
  // -------------------------------------------------------------------------

  it("clusters endpoint sadece ilgili kullanıcının cluster'larını döner", async () => {
    const ts = Date.now();

    // User A'ya ait cluster
    const clusterA = await db.trendCluster.create({
      data: {
        userId: userAId,
        signature: `sig-clusters-iso-a-${ts}`,
        label: "User A Cluster",
        windowDays: 7,
        memberCount: 1,
        storeCount: 1,
        status: TrendClusterStatus.ACTIVE,
        clusterScore: 80,
      },
    });

    // User B'ye ait cluster
    await db.trendCluster.create({
      data: {
        userId: userBId,
        signature: `sig-clusters-iso-b-${ts}`,
        label: "User B Cluster",
        windowDays: 7,
        memberCount: 1,
        storeCount: 1,
        status: TrendClusterStatus.ACTIVE,
        clusterScore: 90,
      },
    });

    // User B sadece kendi cluster'ını görür
    currentUser.id = userBId;
    const res = await clustersGET(
      new Request("http://localhost/api/trend-stories/clusters?window=7"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { clusters: Array<{ id: string }> };
    const clusterIds = body.clusters.map((c) => c.id);
    expect(clusterIds).not.toContain(clusterA.id);
  });

  // -------------------------------------------------------------------------
  // Test 4: Admin olmayan kullanıcı recompute endpoint'ini çağıramaz → 403
  // -------------------------------------------------------------------------

  it("Admin olmayan kullanıcı recompute POST'u → 403", async () => {
    currentUser.id = userAId;
    currentUser.role = UserRole.USER;

    const res = await recomputePOST(
      new Request("http://localhost/api/admin/trend-clusters/recompute", {
        method: "POST",
        body: JSON.stringify({ userId: userBId }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(403);
  });
});
