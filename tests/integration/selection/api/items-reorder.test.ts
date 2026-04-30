// Phase 7 Task 21 — POST /api/selection/sets/[setId]/items/reorder integration testleri.
//
// Reorder endpoint sözleşmesi (design Section 7.2; plan Task 21):
//   - body: ReorderInputSchema { itemIds: string[] }
//   - Auth: requireUser; user.id ile reorderItems
//   - Success: 200 + { items: SelectionItem[] }; itemIds sırasında
//     position 0..N-1 atanmış
//   - Tam eşleşme şartı (service-level ReorderMismatchError → 400):
//     itemIds set'in TÜM item id'lerine birebir eşit (sayı + içerik;
//     duplicate yok). Eksik / fazla / duplicate / cross-set → 400
//   - Ready set → 409 (SetReadOnlyError)
//   - Cross-user setId → 404 (NotFoundError)
//   - Unauthenticated → 401
//
// Reorder mismatch mapping kararı: typed `ReorderMismatchError extends
// AppError` (status 400, code "REORDER_MISMATCH"). Service generic Error
// yerine 400 atar; route boundary `withErrorHandling` üzerinden HTTP'ye
// otomatik map. (Task 21 kararı — daha temiz HTTP semantik.)

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { POST } from "@/app/api/selection/sets/[setId]/items/reorder/route";
import { requireUser } from "@/server/session";

const PRODUCT_TYPE_KEY = "phase7-api-items-reorder-pt";

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
      storageKey: `phase7-api-items-reorder/${userId}/${Math.random()}-ref.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-items-reorder-ref-${userId}-${Math.random()}`,
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
      storageKey: `phase7-api-items-reorder/${userId}/${tag}.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-items-reorder-design-${userId}-${tag}-${Math.random()}`,
    },
  });
  const design = await db.generatedDesign.create({
    data: { userId, referenceId, assetId: asset.id, productTypeId },
  });
  return { asset, design };
}

async function createItem(
  setId: string,
  designId: string,
  assetId: string,
  position: number,
) {
  return db.selectionItem.create({
    data: {
      selectionSetId: setId,
      generatedDesignId: designId,
      sourceAssetId: assetId,
      position,
      status: "pending",
    },
  });
}

function makePostRequest(setId: string, body: unknown): Request {
  return new Request(
    `http://localhost/api/selection/sets/${setId}/items/reorder`,
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
  const a = await ensureUser("phase7-api-items-reorder-a@etsyhub.local");
  const b = await ensureUser("phase7-api-items-reorder-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;

  const pt = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "API Items Reorder Wall Art",
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

describe("POST /api/selection/sets/[setId]/items/reorder", () => {
  it("itemIds sırasıyla position 0..N-1; 200 + { items }", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "r1");
    const d2 = await createDesign(userAId, reference.id, "r2");
    const d3 = await createDesign(userAId, reference.id, "r3");

    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Reorder", status: "draft" },
    });
    const i1 = await createItem(set.id, d1.design.id, d1.asset.id, 0);
    const i2 = await createItem(set.id, d2.design.id, d2.asset.id, 1);
    const i3 = await createItem(set.id, d3.design.id, d3.asset.id, 2);

    // Ters sırada gönder
    const reverseIds = [i3.id, i2.id, i1.id];
    const res = await POST(
      makePostRequest(set.id, { itemIds: reverseIds }),
      { params: { setId: set.id } },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items).toHaveLength(3);
    expect(data.items.map((it: { id: string }) => it.id)).toEqual(reverseIds);
    expect(
      data.items.map((it: { position: number }) => it.position),
    ).toEqual([0, 1, 2]);

    // DB
    const fresh = await db.selectionItem.findMany({
      where: { selectionSetId: set.id },
      orderBy: { position: "asc" },
    });
    expect(fresh.map((f) => f.id)).toEqual(reverseIds);
  });

  it("itemIds eksik (set'in tüm item'ları yoksa) → 400 ReorderMismatchError", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "rs1");
    const d2 = await createDesign(userAId, reference.id, "rs2");

    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Short", status: "draft" },
    });
    const i1 = await createItem(set.id, d1.design.id, d1.asset.id, 0);
    await createItem(set.id, d2.design.id, d2.asset.id, 1);

    const res = await POST(
      makePostRequest(set.id, { itemIds: [i1.id] }), // 2 item var, 1 verildi
      { params: { setId: set.id } },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("REORDER_MISMATCH");
  });

  it("itemIds fazla (set'te olmayan id) → 400 ReorderMismatchError", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "rl1");

    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Long", status: "draft" },
    });
    const i1 = await createItem(set.id, d1.design.id, d1.asset.id, 0);

    const res = await POST(
      makePostRequest(set.id, {
        itemIds: [i1.id, "phase7-api-bogus-id"],
      }),
      { params: { setId: set.id } },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("REORDER_MISMATCH");
  });

  it("itemIds duplicate → 400 ReorderMismatchError", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "rd1");
    const d2 = await createDesign(userAId, reference.id, "rd2");

    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Dup", status: "draft" },
    });
    const i1 = await createItem(set.id, d1.design.id, d1.asset.id, 0);
    await createItem(set.id, d2.design.id, d2.asset.id, 1);

    const res = await POST(
      makePostRequest(set.id, {
        itemIds: [i1.id, i1.id], // duplicate, ayrıca sayı tutmuyor
      }),
      { params: { setId: set.id } },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("REORDER_MISMATCH");
  });

  it("ready set → 409 (SetReadOnlyError)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "ror1");

    const set = await db.selectionSet.create({
      data: {
        userId: userAId,
        name: "ReadyReorder",
        status: "ready",
        finalizedAt: new Date(),
      },
    });
    const i1 = await createItem(set.id, d1.design.id, d1.asset.id, 0);

    const res = await POST(
      makePostRequest(set.id, { itemIds: [i1.id] }),
      { params: { setId: set.id } },
    );
    expect(res.status).toBe(409);
  });

  it("cross-user setId → 404", async () => {
    const setA = await db.selectionSet.create({
      data: { userId: userAId, name: "A's", status: "draft" },
    });

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userBId });
    const res = await POST(
      makePostRequest(setA.id, { itemIds: ["x"] }),
      { params: { setId: setA.id } },
    );
    expect(res.status).toBe(404);
  });

  it("auth eksik → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );
    const res = await POST(
      makePostRequest("any", { itemIds: ["x"] }),
      { params: { setId: "any" } },
    );
    expect(res.status).toBe(401);
  });
});
