/**
 * Integration test: TrendCluster detail endpoint — kısmi/eksik veri toleransı
 *
 * Test kapsamı:
 * 1. heroListing DELETED status'ta → response hero === null
 * 2. Üye listing DELETED status'ta → deleted: true döner
 * 3. seasonalTag === null → response.cluster.seasonalTag === null, çökme yok
 * 4. productType === null → response.cluster.productType === null, çökme yok
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
  requireAdmin: vi.fn(),
}));

// Route handler mock'lardan sonra import et
const { GET: clusterDetailGET } = await import(
  "@/app/api/trend-stories/clusters/[id]/route"
);

// ---------------------------------------------------------------------------
// Yardımcı fonksiyonlar
// ---------------------------------------------------------------------------

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
      reviewCount: 5,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      status: args.status ?? CompetitorListingStatus.ACTIVE,
    },
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("api/trend-stories cluster detail — kısmi veri toleransı", () => {
  let userId: string;

  beforeAll(async () => {
    const user = await ensureUser("api-trend-partial@etsyhub.local");
    userId = user.id;
    await cleanup([userId]);
    await enableFlags();
  });

  afterAll(async () => {
    await cleanup([userId]);
  });

  beforeEach(async () => {
    // Re-assert flags before every test to guard against parallel file flag toggles
    await enableFlags();
    currentUser.id = userId;
    currentUser.role = UserRole.USER;
  });

  // -------------------------------------------------------------------------
  // Test 1: heroListing DELETED → hero: null
  // -------------------------------------------------------------------------

  it("heroListing DELETED status'ta ise hero: null döner", async () => {
    const ts = Date.now();
    const store = await createStore(userId, `partial-store-hero-${ts}`);

    // DELETED status'lu hero listing oluştur
    const heroListing = await createListing({
      userId,
      competitorStoreId: store.id,
      externalId: `partial-hero-deleted-${ts}`,
      title: "Silinmiş Hero Listing",
      status: CompetitorListingStatus.DELETED,
    });

    const cluster = await db.trendCluster.create({
      data: {
        userId,
        signature: `sig-hero-deleted-${ts}`,
        label: "Hero Silindi Cluster",
        windowDays: 7,
        heroListingId: heroListing.id,
        memberCount: 0,
        storeCount: 1,
        status: TrendClusterStatus.ACTIVE,
        clusterScore: 10,
        seasonalTag: "christmas",
      },
    });

    const res = await clusterDetailGET(
      new Request(
        `http://localhost/api/trend-stories/clusters/${cluster.id}`,
      ),
      { params: { id: cluster.id } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cluster: { hero: null } };
    expect(body.cluster.hero).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 2: Üye listing DELETED → deleted: true
  // -------------------------------------------------------------------------

  it("Üye listing DELETED status'ta ise deleted: true döner", async () => {
    const ts = Date.now();
    const store = await createStore(userId, `partial-store-member-${ts}`);

    const activeListing = await createListing({
      userId,
      competitorStoreId: store.id,
      externalId: `partial-member-active-${ts}`,
      title: "Aktif Üye",
      status: CompetitorListingStatus.ACTIVE,
    });

    const deletedListing = await createListing({
      userId,
      competitorStoreId: store.id,
      externalId: `partial-member-deleted-${ts}`,
      title: "Silinmiş Üye",
      status: CompetitorListingStatus.DELETED,
    });

    const cluster = await db.trendCluster.create({
      data: {
        userId,
        signature: `sig-member-deleted-${ts}`,
        label: "Üye Silindi Cluster",
        windowDays: 7,
        memberCount: 2,
        storeCount: 1,
        status: TrendClusterStatus.ACTIVE,
        clusterScore: 20,
      },
    });

    await db.trendClusterMember.createMany({
      data: [
        { clusterId: cluster.id, listingId: activeListing.id, userId },
        { clusterId: cluster.id, listingId: deletedListing.id, userId },
      ],
    });

    const res = await clusterDetailGET(
      new Request(
        `http://localhost/api/trend-stories/clusters/${cluster.id}`,
      ),
      { params: { id: cluster.id } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      members: Array<{ listingId: string; deleted: boolean }>;
    };

    const activeMember = body.members.find(
      (m) => m.listingId === activeListing.id,
    );
    const deletedMember = body.members.find(
      (m) => m.listingId === deletedListing.id,
    );

    expect(activeMember?.deleted).toBe(false);
    expect(deletedMember?.deleted).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 3: seasonalTag === null → response'ta null, çökme yok
  // -------------------------------------------------------------------------

  it("seasonalTag null ise response.cluster.seasonalTag === null ve çökme olmaz", async () => {
    const ts = Date.now();

    const cluster = await db.trendCluster.create({
      data: {
        userId,
        signature: `sig-no-seasonal-${ts}`,
        label: "Mevsim Etiketi Yok",
        windowDays: 7,
        memberCount: 0,
        storeCount: 1,
        status: TrendClusterStatus.ACTIVE,
        clusterScore: 30,
        seasonalTag: null,
      },
    });

    const res = await clusterDetailGET(
      new Request(
        `http://localhost/api/trend-stories/clusters/${cluster.id}`,
      ),
      { params: { id: cluster.id } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      cluster: { seasonalTag: string | null };
    };
    expect(body.cluster.seasonalTag).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 4: productType === null → response'ta null, çökme yok
  // -------------------------------------------------------------------------

  it("productType null ise response.cluster.productType === null ve çökme olmaz", async () => {
    const ts = Date.now();

    const cluster = await db.trendCluster.create({
      data: {
        userId,
        signature: `sig-no-product-type-${ts}`,
        label: "Ürün Tipi Yok",
        windowDays: 7,
        productTypeId: null,
        memberCount: 0,
        storeCount: 1,
        status: TrendClusterStatus.ACTIVE,
        clusterScore: 40,
      },
    });

    const res = await clusterDetailGET(
      new Request(
        `http://localhost/api/trend-stories/clusters/${cluster.id}`,
      ),
      { params: { id: cluster.id } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      cluster: { productType: null | object };
    };
    expect(body.cluster.productType).toBeNull();
  });
});
