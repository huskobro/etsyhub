// Phase 7 Task 20 — GET /api/selection/sets/[setId] integration testleri.
//
// Sözleşmeler (design Section 7.2; plan Task 20):
//   - GET /api/selection/sets/[setId]
//       Auth: requireUser; user.id ile getSet
//       Response: set + items[].review (mapper, varsa) + activeExport (yoksa null)
//       Items position asc sıralı (service kontratı)
//       cross-user setId → 404 (NotFoundError; varlık sızıntısı yok)
//       olmayan setId → 404
//       unauthenticated → 401
//
// Phase 6 paterni: requireUser vi.mock; Request standartı; service'ten
// NotFoundError typed AppError'lar withErrorHandling üzerinden HTTP'ye map.

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { ReviewStatus, UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { GET } from "@/app/api/selection/sets/[setId]/route";
import { requireUser } from "@/server/session";

const PRODUCT_TYPE_KEY = "phase7-api-set-detail-pt";

let userAId: string;
let userBId: string;
let productTypeId: string;

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

async function ensureBase(userId: string) {
  const refAsset = await db.asset.create({
    data: {
      userId,
      storageProvider: "local",
      storageKey: `phase7-api-set-detail/${userId}/${Math.random()}-ref.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-set-detail-ref-${userId}-${Math.random()}`,
    },
  });
  const reference = await db.reference.create({
    data: { userId, assetId: refAsset.id, productTypeId },
  });
  return { reference };
}

async function createDesign(userId: string, referenceId: string, tag: string) {
  const asset = await db.asset.create({
    data: {
      userId,
      storageProvider: "local",
      storageKey: `phase7-api-set-detail/${userId}/${tag}.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-set-detail-design-${userId}-${tag}-${Math.random()}`,
    },
  });
  const design = await db.generatedDesign.create({
    data: { userId, referenceId, assetId: asset.id, productTypeId },
  });
  return { asset, design };
}

function makeGetRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

async function cleanup() {
  const userIds = [userAId, userBId];
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: userIds } } },
  });
  await db.selectionSet.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.designReview.deleteMany({
    where: { generatedDesign: { userId: { in: userIds } } },
  });
  await db.generatedDesign.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.reference.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.asset.deleteMany({
    where: { userId: { in: userIds } },
  });
}

beforeAll(async () => {
  const a = await ensureUser("phase7-api-set-detail-a@etsyhub.local");
  const b = await ensureUser("phase7-api-set-detail-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;

  const pt = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "API Set Detail Wall Art",
      isSystem: false,
    },
  });
  productTypeId = pt.id;
});

beforeEach(async () => {
  (requireUser as ReturnType<typeof vi.fn>).mockReset();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("GET /api/selection/sets/[setId]", () => {
  it("ownership pass: 200 + set + items + activeExport(null)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "d1");
    const d2 = await createDesign(userAId, reference.id, "d2");

    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Detail A", status: "draft" },
    });
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: d1.design.id,
        sourceAssetId: d1.asset.id,
        position: 1,
      },
    });
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: d2.design.id,
        sourceAssetId: d2.asset.id,
        position: 0,
      },
    });

    const res = await GET(
      makeGetRequest(`http://localhost/api/selection/sets/${set.id}`),
      { params: { setId: set.id } },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(set.id);
    expect(data.name).toBe("Detail A");
    expect(data.status).toBe("draft");
    expect(data.userId).toBe(userAId);
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items).toHaveLength(2);
    // position asc sort: d2 (0), sonra d1 (1)
    expect(data.items[0].position).toBe(0);
    expect(data.items[1].position).toBe(1);
    // activeExport null (queue'da export job yok)
    expect(data.activeExport).toBeNull();
    // review opsiyonel — mapper null veya nesne
    expect(data.items[0]).toHaveProperty("review");
    expect(data.items[1]).toHaveProperty("review");
  });

  it("review verisi olan item: review payload'da; review olmayan item null", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const reviewed = await createDesign(userAId, reference.id, "reviewed");
    const noReview = await createDesign(userAId, reference.id, "noreview");

    // reviewed design'ı APPROVED + DesignReview oluştur
    await db.generatedDesign.update({
      where: { id: reviewed.design.id },
      data: {
        reviewStatus: ReviewStatus.APPROVED,
        reviewScore: 92,
        qualityScore: 80,
        reviewedAt: new Date(),
      },
    });
    await db.designReview.create({
      data: {
        generatedDesignId: reviewed.design.id,
        reviewer: "system",
        decision: ReviewStatus.APPROVED,
        score: 92,
        issues: [],
      },
    });

    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Review Mix", status: "draft" },
    });
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: reviewed.design.id,
        sourceAssetId: reviewed.asset.id,
        position: 0,
      },
    });
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: noReview.design.id,
        sourceAssetId: noReview.asset.id,
        position: 1,
      },
    });

    const res = await GET(
      makeGetRequest(`http://localhost/api/selection/sets/${set.id}`),
      { params: { setId: set.id } },
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    const withReview = data.items.find(
      (i: { generatedDesignId: string }) => i.generatedDesignId === reviewed.design.id,
    );
    const without = data.items.find(
      (i: { generatedDesignId: string }) => i.generatedDesignId === noReview.design.id,
    );
    expect(withReview.review).not.toBeNull();
    expect(withReview.review.score).toBe(92);
    expect(withReview.review.status).toBe("approved");
    expect(without.review).toBeNull();
  });

  it("cross-user: User A'nın seti User B sorgusu → 404", async () => {
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "A's secret", status: "draft" },
    });

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userBId });
    const res = await GET(
      makeGetRequest(`http://localhost/api/selection/sets/${set.id}`),
      { params: { setId: set.id } },
    );
    expect(res.status).toBe(404);
  });

  it("olmayan setId → 404", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const res = await GET(
      makeGetRequest("http://localhost/api/selection/sets/phase7-api-no-such-set"),
      { params: { setId: "phase7-api-no-such-set" } },
    );
    expect(res.status).toBe(404);
  });

  it("auth eksik → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );
    const res = await GET(
      makeGetRequest("http://localhost/api/selection/sets/anything"),
      { params: { setId: "anything" } },
    );
    expect(res.status).toBe(401);
  });
});
