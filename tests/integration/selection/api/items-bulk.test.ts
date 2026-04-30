// Phase 7 Task 21 — PATCH /api/selection/sets/[setId]/items/bulk integration testleri.
//
// Bulk status update endpoint sözleşmesi (design Section 7.2; plan Task 21):
//   - body: BulkUpdateStatusInputSchema { itemIds: string[], status: enum }
//   - Auth: requireUser; user.id ile bulkUpdateStatus
//   - Success: 200 + { updatedCount } (atomik updateMany)
//   - Cross-set itemIds → silent filter (selectionSetId where; updatedCount sadece eşleşen sayı)
//   - Ready set → 409 (SetReadOnlyError)
//   - Cross-user setId → 404 (NotFoundError)
//   - Boş itemIds array → 400 (zod min(1))
//   - Invalid status enum → 400 (zod reject)
//   - Unauthenticated → 401
//
// Phase 6 paterni: requireUser vi.mock; ValidationError → 400; AppError
// alt-sınıfları withErrorHandling üzerinden HTTP'ye otomatik map.

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { PATCH } from "@/app/api/selection/sets/[setId]/items/bulk/route";
import { requireUser } from "@/server/session";

const PRODUCT_TYPE_KEY = "phase7-api-items-bulk-pt";

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
      storageKey: `phase7-api-items-bulk/${userId}/${Math.random()}-ref.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-items-bulk-ref-${userId}-${Math.random()}`,
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
      storageKey: `phase7-api-items-bulk/${userId}/${tag}.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-items-bulk-design-${userId}-${tag}-${Math.random()}`,
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
  status: "pending" | "selected" | "rejected" = "pending",
) {
  return db.selectionItem.create({
    data: {
      selectionSetId: setId,
      generatedDesignId: designId,
      sourceAssetId: assetId,
      position,
      status,
    },
  });
}

function makePatchRequest(setId: string, body: unknown): Request {
  return new Request(
    `http://localhost/api/selection/sets/${setId}/items/bulk`,
    {
      method: "PATCH",
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
  const a = await ensureUser("phase7-api-items-bulk-a@etsyhub.local");
  const b = await ensureUser("phase7-api-items-bulk-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;

  const pt = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "API Items Bulk Wall Art",
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

describe("PATCH /api/selection/sets/[setId]/items/bulk", () => {
  it("3 item'ı atomik selected yapar; 200 + { updatedCount: 3 }", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "b1");
    const d2 = await createDesign(userAId, reference.id, "b2");
    const d3 = await createDesign(userAId, reference.id, "b3");

    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Bulk Set", status: "draft" },
    });
    const i1 = await createItem(set.id, d1.design.id, d1.asset.id, 0);
    const i2 = await createItem(set.id, d2.design.id, d2.asset.id, 1);
    const i3 = await createItem(set.id, d3.design.id, d3.asset.id, 2);

    const res = await PATCH(
      makePatchRequest(set.id, {
        itemIds: [i1.id, i2.id, i3.id],
        status: "selected",
      }),
      { params: { setId: set.id } },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updatedCount).toBe(3);

    const rows = await db.selectionItem.findMany({
      where: { selectionSetId: set.id },
      orderBy: { position: "asc" },
    });
    expect(rows.map((r) => r.status)).toEqual(["selected", "selected", "selected"]);
  });

  it("cross-set itemId silent filter — yalnız hedef set'in item'ları update", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const dA = await createDesign(userAId, reference.id, "csa");
    const dB = await createDesign(userAId, reference.id, "csb");

    const setA = await db.selectionSet.create({
      data: { userId: userAId, name: "A", status: "draft" },
    });
    const setB = await db.selectionSet.create({
      data: { userId: userAId, name: "B", status: "draft" },
    });

    const itemA = await createItem(setA.id, dA.design.id, dA.asset.id, 0);
    const itemB = await createItem(setB.id, dB.design.id, dB.asset.id, 0);

    const res = await PATCH(
      makePatchRequest(setA.id, {
        itemIds: [itemA.id, itemB.id], // itemB başka set'in
        status: "selected",
      }),
      { params: { setId: setA.id } },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    // Yalnız itemA güncellendi; itemB filter'da elendi
    expect(data.updatedCount).toBe(1);

    const rowA = await db.selectionItem.findUnique({ where: { id: itemA.id } });
    const rowB = await db.selectionItem.findUnique({ where: { id: itemB.id } });
    expect(rowA!.status).toBe("selected");
    expect(rowB!.status).toBe("pending"); // dokunulmadı
  });

  it("ready set → 409 (SetReadOnlyError)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "ro1");

    const set = await db.selectionSet.create({
      data: {
        userId: userAId,
        name: "Ready",
        status: "ready",
        finalizedAt: new Date(),
      },
    });
    const item = await createItem(set.id, d1.design.id, d1.asset.id, 0);

    const res = await PATCH(
      makePatchRequest(set.id, {
        itemIds: [item.id],
        status: "selected",
      }),
      { params: { setId: set.id } },
    );

    expect(res.status).toBe(409);

    const row = await db.selectionItem.findUnique({ where: { id: item.id } });
    expect(row!.status).toBe("pending");
  });

  it("cross-user setId → 404", async () => {
    const setA = await db.selectionSet.create({
      data: { userId: userAId, name: "A's", status: "draft" },
    });

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userBId });
    const res = await PATCH(
      makePatchRequest(setA.id, {
        itemIds: ["any"],
        status: "selected",
      }),
      { params: { setId: setA.id } },
    );
    expect(res.status).toBe(404);
  });

  it("invalid status enum → 400", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Inv", status: "draft" },
    });

    const res = await PATCH(
      makePatchRequest(set.id, {
        itemIds: ["x"],
        status: "approved", // invalid
      }),
      { params: { setId: set.id } },
    );
    expect(res.status).toBe(400);
  });

  it("boş itemIds array → 400 (zod min(1))", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Empty", status: "draft" },
    });

    const res = await PATCH(
      makePatchRequest(set.id, {
        itemIds: [],
        status: "selected",
      }),
      { params: { setId: set.id } },
    );
    expect(res.status).toBe(400);
  });

  it("auth eksik → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );
    const res = await PATCH(
      makePatchRequest("any", {
        itemIds: ["x"],
        status: "selected",
      }),
      { params: { setId: "any" } },
    );
    expect(res.status).toBe(401);
  });
});
