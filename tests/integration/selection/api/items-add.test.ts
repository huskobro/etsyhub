// Phase 7 Task 20 — POST /api/selection/sets/[setId]/items integration testleri.
//
// Sözleşmeler (design Section 2.2, 7.2; plan Task 20):
//   - body: AddItemsInputSchema { items: [{ generatedDesignId }] }
//   - Auth: requireUser; user.id ile addItems
//   - success: 201 + { items } (yeni eklenen rows; position artan)
//   - duplicate generatedDesignId silent skip (set'te zaten varsa)
//   - ready set → 409 (SetReadOnlyError; assertSetMutable)
//   - cross-user setId → 404 (NotFoundError)
//   - boş items array → 400 (zod min(1))
//   - unauthenticated → 401
//
// Phase 6 paterni: requireUser vi.mock; ValidationError → 400; AppError
// alt-sınıfları withErrorHandling üzerinden HTTP'ye otomatik map.

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { POST } from "@/app/api/selection/sets/[setId]/items/route";
import { requireUser } from "@/server/session";

const PRODUCT_TYPE_KEY = "phase7-api-items-add-pt";

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
      storageKey: `phase7-api-items-add/${userId}/${Math.random()}-ref.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-items-add-ref-${userId}-${Math.random()}`,
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
      storageKey: `phase7-api-items-add/${userId}/${tag}.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-items-add-design-${userId}-${tag}-${Math.random()}`,
    },
  });
  const design = await db.generatedDesign.create({
    data: { userId, referenceId, assetId: asset.id, productTypeId },
  });
  return { asset, design };
}

function makePostRequest(setId: string, body: unknown): Request {
  return new Request(
    `http://localhost/api/selection/sets/${setId}/items`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function cleanup() {
  const userIds = [userAId, userBId];
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: userIds } } },
  });
  await db.selectionSet.deleteMany({
    where: { userId: { in: userIds } },
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
  const a = await ensureUser("phase7-api-items-add-a@etsyhub.local");
  const b = await ensureUser("phase7-api-items-add-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;

  const pt = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "API Items Add Wall Art",
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

describe("POST /api/selection/sets/[setId]/items", () => {
  it("yeni items: 201 + items[] döner; position artan", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "a1");
    const d2 = await createDesign(userAId, reference.id, "a2");

    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Add Target", status: "draft" },
    });

    const res = await POST(
      makePostRequest(set.id, {
        items: [
          { generatedDesignId: d1.design.id },
          { generatedDesignId: d2.design.id },
        ],
      }),
      { params: { setId: set.id } },
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items).toHaveLength(2);
    const positions = data.items
      .map((i: { position: number }) => i.position)
      .sort((a: number, b: number) => a - b);
    expect(positions).toEqual([0, 1]);

    const dbItems = await db.selectionItem.findMany({
      where: { selectionSetId: set.id },
    });
    expect(dbItems).toHaveLength(2);
  });

  it("duplicate generatedDesignId silent skip", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "dup1");
    const d2 = await createDesign(userAId, reference.id, "dup2");

    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Dup Target", status: "draft" },
    });

    // d1 zaten setin içinde
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: d1.design.id,
        sourceAssetId: d1.asset.id,
        position: 0,
      },
    });

    const res = await POST(
      makePostRequest(set.id, {
        items: [
          { generatedDesignId: d1.design.id }, // skip
          { generatedDesignId: d2.design.id }, // ekle
        ],
      }),
      { params: { setId: set.id } },
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    // Yalnız 1 yeni item (d2)
    expect(data.items).toHaveLength(1);
    expect(data.items[0].generatedDesignId).toBe(d2.design.id);
    expect(data.items[0].position).toBe(1);

    // DB toplamda 2 item
    const dbItems = await db.selectionItem.findMany({
      where: { selectionSetId: set.id },
    });
    expect(dbItems).toHaveLength(2);
  });

  it("ready set → 409 (SetReadOnlyError)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "ro1");

    const set = await db.selectionSet.create({
      data: {
        userId: userAId,
        name: "Ready Set",
        status: "ready",
        finalizedAt: new Date(),
      },
    });

    const res = await POST(
      makePostRequest(set.id, {
        items: [{ generatedDesignId: d1.design.id }],
      }),
      { params: { setId: set.id } },
    );
    expect(res.status).toBe(409);

    const dbItems = await db.selectionItem.findMany({
      where: { selectionSetId: set.id },
    });
    expect(dbItems).toHaveLength(0);
  });

  it("cross-user setId → 404", async () => {
    // User A'nın setine User B'den ekleme denemesi
    const setA = await db.selectionSet.create({
      data: { userId: userAId, name: "A's set", status: "draft" },
    });

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userBId });
    const res = await POST(
      makePostRequest(setA.id, {
        items: [{ generatedDesignId: "any-id" }],
      }),
      { params: { setId: setA.id } },
    );
    expect(res.status).toBe(404);
  });

  it("boş items array → 400 (zod min(1))", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Empty Items", status: "draft" },
    });

    const res = await POST(
      makePostRequest(set.id, { items: [] }),
      { params: { setId: set.id } },
    );
    expect(res.status).toBe(400);
  });

  it("auth eksik → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );
    const res = await POST(
      makePostRequest("any-set", {
        items: [{ generatedDesignId: "x" }],
      }),
      { params: { setId: "any-set" } },
    );
    expect(res.status).toBe(401);
  });
});
