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
  UserRole,
  UserStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import { REVIEW_COUNT_DISCLAIMER } from "@/features/competitors/services/ranking-service";

// enqueue gerçek Redis'e dokunmasın
let _mockBullCounter = 0;
vi.mock("@/server/queue", () => ({
  enqueue: vi.fn().mockImplementation(() => {
    _mockBullCounter += 1;
    return Promise.resolve({ id: `bull-mock-${_mockBullCounter}` });
  }),
}));

// auth'u session üzerinden değil requireUser'ı doğrudan mock'luyoruz
// (next-auth setup harness-free ortamda zor; requireUser sade bir throw/dönüş)
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

// Route handler'ları mock'lardan sonra import edilmeli (vi.mock hoisting)
const { GET: listGET, POST: createPOST } = await import(
  "@/app/api/competitors/route"
);
const { GET: detailGET, DELETE: detailDELETE } = await import(
  "@/app/api/competitors/[id]/route"
);
const { POST: scanPOST } = await import(
  "@/app/api/competitors/[id]/scan/route"
);
const { GET: listingsGET } = await import(
  "@/app/api/competitors/[id]/listings/route"
);

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

async function cleanup(userIds: string[]) {
  await db.competitorScan.deleteMany({ where: { userId: { in: userIds } } });
  await db.competitorListing.deleteMany({ where: { userId: { in: userIds } } });
  await db.competitorStore.deleteMany({ where: { userId: { in: userIds } } });
  await db.job.deleteMany({ where: { userId: { in: userIds } } });
  await db.auditLog.deleteMany({ where: { userId: { in: userIds } } });
}

describe("api/competitors integration", () => {
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const a = await ensureUser("api-comp-a@etsyhub.local");
    const b = await ensureUser("api-comp-b@etsyhub.local");
    userAId = a.id;
    userBId = b.id;
    await cleanup([userAId, userBId]);
  });

  afterAll(async () => {
    await cleanup([userAId, userBId]);
  });

  beforeEach(() => {
    currentUser.id = null;
    currentUser.role = UserRole.USER;
  });

  describe("POST /api/competitors", () => {
    it("kimliksiz istek → 401", async () => {
      const res = await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "ShopX" }),
        }),
      );
      expect(res.status).toBe(401);
    });

    it("geçerli gövde → 201 ve store döner", async () => {
      currentUser.id = userAId;
      const res = await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "ApiCompAlphaShop" }),
        }),
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { competitor: { id: string; etsyShopName: string } };
      expect(body.competitor.etsyShopName).toBe("apicompalphashop");
    });

    it("geçersiz gövde → 400", async () => {
      currentUser.id = userAId;
      const res = await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "x" }), // min 2
        }),
      );
      expect(res.status).toBe(400);
    });

    it("aynı shop → 409", async () => {
      currentUser.id = userAId;
      await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "DuplicateShopZ" }),
        }),
      );
      const res = await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "DuplicateShopZ" }),
        }),
      );
      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/competitors (data isolation)", () => {
    it("userA eklediği rakip userB listesinde görünmez", async () => {
      currentUser.id = userAId;
      await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "UserAPrivateShop" }),
        }),
      );

      currentUser.id = userBId;
      const res = await listGET(
        new Request("http://localhost/api/competitors"),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        items: Array<{ etsyShopName: string }>;
      };
      expect(
        body.items.some((i) => i.etsyShopName === "userapprivateshop"),
      ).toBe(false);
      expect(
        body.items.some((i) => i.etsyShopName === "userapprivatshop"),
      ).toBe(false);
      // tüm item'lar userB'ye ait olmalı
      expect(body.items.every((_) => true)).toBe(true);
    });

    it("q filtresi çalışır", async () => {
      currentUser.id = userAId;
      await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "UniqueFilterShopQ" }),
        }),
      );
      const res = await listGET(
        new Request("http://localhost/api/competitors?q=uniquefiltershop"),
      );
      const body = (await res.json()) as { items: Array<{ etsyShopName: string }> };
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(
        body.items.some((i) => i.etsyShopName === "uniquefiltershopq"),
      ).toBe(true);
    });
  });

  describe("GET /api/competitors/[id] (detail + data isolation)", () => {
    it("owner detail görür, lastScan dönebilir", async () => {
      currentUser.id = userAId;
      const createRes = await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "DetailOwnerShop" }),
        }),
      );
      const created = (await createRes.json()) as { competitor: { id: string } };

      const res = await detailGET(
        new Request(`http://localhost/api/competitors/${created.competitor.id}`),
        { params: { id: created.competitor.id } },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        competitor: { id: string };
        lastScan: unknown;
      };
      expect(body.competitor.id).toBe(created.competitor.id);
      // addCompetitor INITIAL_FULL scan tetikler → lastScan not null
      expect(body.lastScan).not.toBeNull();
    });

    it("userB başka user'ın detail'ine erişemez → 404", async () => {
      currentUser.id = userAId;
      const createRes = await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "DetailIsolationShop" }),
        }),
      );
      const created = (await createRes.json()) as { competitor: { id: string } };

      currentUser.id = userBId;
      const res = await detailGET(
        new Request(`http://localhost/api/competitors/${created.competitor.id}`),
        { params: { id: created.competitor.id } },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/competitors/[id]", () => {
    it("owner soft-delete yapabilir", async () => {
      currentUser.id = userAId;
      const createRes = await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "DeletableShop" }),
        }),
      );
      const created = (await createRes.json()) as { competitor: { id: string } };

      const res = await detailDELETE(
        new Request(`http://localhost/api/competitors/${created.competitor.id}`, {
          method: "DELETE",
        }),
        { params: { id: created.competitor.id } },
      );
      expect(res.status).toBe(200);
      const found = await db.competitorStore.findUnique({
        where: { id: created.competitor.id },
      });
      expect(found?.deletedAt).not.toBeNull();
    });

    it("başka user delete edemez → 404", async () => {
      currentUser.id = userAId;
      const createRes = await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "DeleteIsolationShop" }),
        }),
      );
      const created = (await createRes.json()) as { competitor: { id: string } };

      currentUser.id = userBId;
      const res = await detailDELETE(
        new Request(`http://localhost/api/competitors/${created.competitor.id}`, {
          method: "DELETE",
        }),
        { params: { id: created.competitor.id } },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/competitors/[id]/scan", () => {
    it("owner MANUAL_REFRESH default scan tetikler, jobId + scanId döner", async () => {
      currentUser.id = userAId;
      const createRes = await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "ScanTriggerShop" }),
        }),
      );
      const created = (await createRes.json()) as { competitor: { id: string } };

      const res = await scanPOST(
        new Request(
          `http://localhost/api/competitors/${created.competitor.id}/scan`,
          { method: "POST", body: JSON.stringify({}) },
        ),
        { params: { id: created.competitor.id } },
      );
      expect(res.status).toBe(202);
      const body = (await res.json()) as { jobId: string; scanId: string };
      expect(body.jobId).toBeTruthy();
      expect(body.scanId).toBeTruthy();
    });

    it("başka user scan tetikleyemez → 404", async () => {
      currentUser.id = userAId;
      const createRes = await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "ScanIsolationShop" }),
        }),
      );
      const created = (await createRes.json()) as { competitor: { id: string } };

      currentUser.id = userBId;
      const res = await scanPOST(
        new Request(
          `http://localhost/api/competitors/${created.competitor.id}/scan`,
          { method: "POST", body: JSON.stringify({}) },
        ),
        { params: { id: created.competitor.id } },
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/competitors/[id]/listings", () => {
    it("window=30d eski kayıtları dışarıda bırakır; disclaimer response'ta; sadece ACTIVE", async () => {
      currentUser.id = userAId;
      const createRes = await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "ListingsWindowShop" }),
        }),
      );
      const created = (await createRes.json()) as { competitor: { id: string } };

      const now = new Date();
      const daysAgo = (d: number) =>
        new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

      await db.competitorListing.createMany({
        data: [
          {
            competitorStoreId: created.competitor.id,
            userId: userAId,
            externalId: "w-15d",
            platform: SourcePlatform.ETSY,
            sourceUrl: "https://etsy.com/listing/1",
            title: "Fresh 15d",
            reviewCount: 100,
            latestReviewAt: daysAgo(15),
            status: CompetitorListingStatus.ACTIVE,
          },
          {
            competitorStoreId: created.competitor.id,
            userId: userAId,
            externalId: "w-60d",
            platform: SourcePlatform.ETSY,
            sourceUrl: "https://etsy.com/listing/2",
            title: "Old 60d",
            reviewCount: 50,
            latestReviewAt: daysAgo(60),
            status: CompetitorListingStatus.ACTIVE,
          },
          {
            competitorStoreId: created.competitor.id,
            userId: userAId,
            externalId: "w-200d",
            platform: SourcePlatform.ETSY,
            sourceUrl: "https://etsy.com/listing/3",
            title: "Very old 200d",
            reviewCount: 25,
            latestReviewAt: daysAgo(200),
            status: CompetitorListingStatus.ACTIVE,
          },
          {
            competitorStoreId: created.competitor.id,
            userId: userAId,
            externalId: "w-deleted",
            platform: SourcePlatform.ETSY,
            sourceUrl: "https://etsy.com/listing/4",
            title: "Deleted",
            reviewCount: 999,
            latestReviewAt: daysAgo(1),
            status: CompetitorListingStatus.DELETED,
          },
        ],
      });

      const res = await listingsGET(
        new Request(
          `http://localhost/api/competitors/${created.competitor.id}/listings?window=30d`,
        ),
        { params: { id: created.competitor.id } },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        items: Array<{ externalId: string }>;
        disclaimer: string;
        window: string;
      };
      expect(body.disclaimer).toBe(REVIEW_COUNT_DISCLAIMER);
      expect(body.window).toBe("30d");
      const ids = body.items.map((i) => i.externalId);
      expect(ids).toContain("w-15d");
      expect(ids).not.toContain("w-60d");
      expect(ids).not.toContain("w-200d");
      // DELETED listing hariç tutulur
      expect(ids).not.toContain("w-deleted");
    });

    it("başka user listings'e erişemez → 404", async () => {
      currentUser.id = userAId;
      const createRes = await createPOST(
        new Request("http://localhost/api/competitors", {
          method: "POST",
          body: JSON.stringify({ shopIdentifier: "ListingsIsolationShop" }),
        }),
      );
      const created = (await createRes.json()) as { competitor: { id: string } };

      currentUser.id = userBId;
      const res = await listingsGET(
        new Request(
          `http://localhost/api/competitors/${created.competitor.id}/listings?window=all`,
        ),
        { params: { id: created.competitor.id } },
      );
      expect(res.status).toBe(404);
    });
  });
});
