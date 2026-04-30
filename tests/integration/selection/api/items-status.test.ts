// Phase 7 Task 20 — PATCH /api/selection/sets/[setId]/items/[itemId] integration testleri.
//
// Sözleşmeler (design Section 4.4, 7.2; plan Task 20):
//   - body: UpdateItemStatusInputSchema { status: "pending"|"selected"|"rejected" }
//   - Auth: requireUser; user.id ile updateItemStatus
//   - success: 200 + { item } (güncel SelectionItem row)
//   - state machine: pending↔selected↔rejected — tüm 6 geçiş valid
//   - ready set → 409 (SetReadOnlyError; assertSetMutable)
//   - cross-user setId/itemId → 404
//   - cross-set itemId (item başka set'e ait) → 404 (requireItemOwnership)
//   - invalid status enum → 400 (zod reject)
//   - unauthenticated → 401

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { PATCH } from "@/app/api/selection/sets/[setId]/items/[itemId]/route";
import { requireUser } from "@/server/session";

const PRODUCT_TYPE_KEY = "phase7-api-items-status-pt";

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
      storageKey: `phase7-api-items-status/${userId}/${Math.random()}-ref.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-items-status-ref-${userId}-${Math.random()}`,
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
      storageKey: `phase7-api-items-status/${userId}/${tag}.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-items-status-design-${userId}-${tag}-${Math.random()}`,
    },
  });
  const design = await db.generatedDesign.create({
    data: { userId, referenceId, assetId: asset.id, productTypeId },
  });
  return { asset, design };
}

function makePatchRequest(
  setId: string,
  itemId: string,
  body: unknown,
): Request {
  return new Request(
    `http://localhost/api/selection/sets/${setId}/items/${itemId}`,
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
  const a = await ensureUser("phase7-api-items-status-a@etsyhub.local");
  const b = await ensureUser("phase7-api-items-status-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;

  const pt = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "API Items Status Wall Art",
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

describe("PATCH /api/selection/sets/[setId]/items/[itemId]", () => {
  it("pending → selected: 200 + item.status='selected'", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "ps1");
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Status Set", status: "draft" },
    });
    const item = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: d1.design.id,
        sourceAssetId: d1.asset.id,
        position: 0,
        status: "pending",
      },
    });

    const res = await PATCH(
      makePatchRequest(set.id, item.id, { status: "selected" }),
      { params: { setId: set.id, itemId: item.id } },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.item.id).toBe(item.id);
    expect(data.item.status).toBe("selected");

    const row = await db.selectionItem.findUnique({ where: { id: item.id } });
    expect(row!.status).toBe("selected");
  });

  it("selected → rejected: 200", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "sr1");
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "S2R", status: "draft" },
    });
    const item = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: d1.design.id,
        sourceAssetId: d1.asset.id,
        position: 0,
        status: "selected",
      },
    });

    const res = await PATCH(
      makePatchRequest(set.id, item.id, { status: "rejected" }),
      { params: { setId: set.id, itemId: item.id } },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.item.status).toBe("rejected");
  });

  it("rejected → pending: 200", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "rp1");
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "R2P", status: "draft" },
    });
    const item = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: d1.design.id,
        sourceAssetId: d1.asset.id,
        position: 0,
        status: "rejected",
      },
    });

    const res = await PATCH(
      makePatchRequest(set.id, item.id, { status: "pending" }),
      { params: { setId: set.id, itemId: item.id } },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.item.status).toBe("pending");
  });

  it("ready set → 409 (SetReadOnlyError)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "ro1");
    const set = await db.selectionSet.create({
      data: {
        userId: userAId,
        name: "RO Set",
        status: "ready",
        finalizedAt: new Date(),
      },
    });
    const item = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: d1.design.id,
        sourceAssetId: d1.asset.id,
        position: 0,
        status: "pending",
      },
    });

    const res = await PATCH(
      makePatchRequest(set.id, item.id, { status: "selected" }),
      { params: { setId: set.id, itemId: item.id } },
    );
    expect(res.status).toBe(409);

    const row = await db.selectionItem.findUnique({ where: { id: item.id } });
    expect(row!.status).toBe("pending");
  });

  it("cross-user item: User B → 404", async () => {
    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "cu1");
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "A's", status: "draft" },
    });
    const item = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: d1.design.id,
        sourceAssetId: d1.asset.id,
        position: 0,
        status: "pending",
      },
    });

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userBId });
    const res = await PATCH(
      makePatchRequest(set.id, item.id, { status: "selected" }),
      { params: { setId: set.id, itemId: item.id } },
    );
    expect(res.status).toBe(404);

    const row = await db.selectionItem.findUnique({ where: { id: item.id } });
    expect(row!.status).toBe("pending");
  });

  it("cross-set itemId (item başka set'in) → 404", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "cs1");

    const setA = await db.selectionSet.create({
      data: { userId: userAId, name: "Set A", status: "draft" },
    });
    const setB = await db.selectionSet.create({
      data: { userId: userAId, name: "Set B", status: "draft" },
    });

    // Item setA'da
    const itemInA = await db.selectionItem.create({
      data: {
        selectionSetId: setA.id,
        generatedDesignId: d1.design.id,
        sourceAssetId: d1.asset.id,
        position: 0,
        status: "pending",
      },
    });

    // setB üzerinden itemInA hedeflenir → 404
    const res = await PATCH(
      makePatchRequest(setB.id, itemInA.id, { status: "selected" }),
      { params: { setId: setB.id, itemId: itemInA.id } },
    );
    expect(res.status).toBe(404);
  });

  it("invalid status enum → 400", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "iv1");
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Inv", status: "draft" },
    });
    const item = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: d1.design.id,
        sourceAssetId: d1.asset.id,
        position: 0,
        status: "pending",
      },
    });

    const res = await PATCH(
      makePatchRequest(set.id, item.id, { status: "approved" }), // invalid
      { params: { setId: set.id, itemId: item.id } },
    );
    expect(res.status).toBe(400);
  });

  it("auth eksik → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );
    const res = await PATCH(
      makePatchRequest("set", "item", { status: "selected" }),
      { params: { setId: "set", itemId: "item" } },
    );
    expect(res.status).toBe(401);
  });
});
