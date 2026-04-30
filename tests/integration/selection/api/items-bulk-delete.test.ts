// Phase 7 Task 21 — POST /api/selection/sets/[setId]/items/bulk-delete integration testleri.
//
// Bulk hard-delete endpoint sözleşmesi (design Section 7.2; plan Task 21):
//   - body: BulkDeleteInputSchema { itemIds: string[], confirmation: "SİL" }
//   - TypingConfirmation server-side enforcement: zod literal "SİL"
//     (Türkçe büyük İ; case-sensitive; trim YOK)
//     - "SIL" (ASCII), "sil" (küçük), " SİL " (whitespace), eksik → reject
//   - Auth: requireUser; user.id ile bulkDelete
//   - Success: 200 + { deletedCount }
//   - Cross-set itemIds → silent filter (deletedCount sadece eşleşen sayı)
//   - Ready set → 409 (SetReadOnlyError)
//   - Cross-user setId → 404 (NotFoundError)
//   - Boş itemIds array → 400 (zod min(1))
//   - Unauthenticated → 401
//   - Asset entity DOKUNULMAZ — bulkDelete yalnız SelectionItem siler
//     (Section 2.3 ASSET DOKUNULMAZ kuralı; carry-forward stratejisi)

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { POST } from "@/app/api/selection/sets/[setId]/items/bulk-delete/route";
import { requireUser } from "@/server/session";

const PRODUCT_TYPE_KEY = "phase7-api-items-bulk-delete-pt";

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
      storageKey: `phase7-api-items-bulk-delete/${userId}/${Math.random()}-ref.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-items-bulk-delete-ref-${userId}-${Math.random()}`,
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
      storageKey: `phase7-api-items-bulk-delete/${userId}/${tag}.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-items-bulk-delete-design-${userId}-${tag}-${Math.random()}`,
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
    `http://localhost/api/selection/sets/${setId}/items/bulk-delete`,
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
  const a = await ensureUser("phase7-api-items-bulk-delete-a@etsyhub.local");
  const b = await ensureUser("phase7-api-items-bulk-delete-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;

  const pt = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "API Items Bulk Delete Wall Art",
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

describe("POST /api/selection/sets/[setId]/items/bulk-delete", () => {
  it("confirmation='SİL' ile 3 item silinir; 200 + { deletedCount: 3 }", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "bd1");
    const d2 = await createDesign(userAId, reference.id, "bd2");
    const d3 = await createDesign(userAId, reference.id, "bd3");

    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Delete Set", status: "draft" },
    });
    const i1 = await createItem(set.id, d1.design.id, d1.asset.id, 0);
    const i2 = await createItem(set.id, d2.design.id, d2.asset.id, 1);
    const i3 = await createItem(set.id, d3.design.id, d3.asset.id, 2);

    const res = await POST(
      makePostRequest(set.id, {
        itemIds: [i1.id, i2.id, i3.id],
        confirmation: "SİL",
      }),
      { params: { setId: set.id } },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deletedCount).toBe(3);

    const remaining = await db.selectionItem.findMany({
      where: { selectionSetId: set.id },
    });
    expect(remaining).toHaveLength(0);
  });

  it("confirmation eksik → 400", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "NoConf", status: "draft" },
    });

    const res = await POST(
      makePostRequest(set.id, {
        itemIds: ["any"],
        // confirmation YOK
      }),
      { params: { setId: set.id } },
    );
    expect(res.status).toBe(400);
  });

  it("confirmation 'SIL' (ASCII) → 400 — case/charset enforcement", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "AsciiSIL", status: "draft" },
    });

    const res = await POST(
      makePostRequest(set.id, {
        itemIds: ["any"],
        confirmation: "SIL", // ASCII I, Türkçe İ değil
      }),
      { params: { setId: set.id } },
    );
    expect(res.status).toBe(400);
  });

  it("confirmation 'sil' (küçük harf) → 400 — case-sensitive enforcement", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "LowerSil", status: "draft" },
    });

    const res = await POST(
      makePostRequest(set.id, {
        itemIds: ["any"],
        confirmation: "sil",
      }),
      { params: { setId: set.id } },
    );
    expect(res.status).toBe(400);
  });

  it("confirmation ' SİL ' (whitespace) → 400 — trim YOK", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Pad", status: "draft" },
    });

    const res = await POST(
      makePostRequest(set.id, {
        itemIds: ["any"],
        confirmation: " SİL ",
      }),
      { params: { setId: set.id } },
    );
    expect(res.status).toBe(400);
  });

  it("cross-set itemId silent filter — yalnız hedef set'in item'ları silinir", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const dA = await createDesign(userAId, reference.id, "csda");
    const dB = await createDesign(userAId, reference.id, "csdb");

    const setA = await db.selectionSet.create({
      data: { userId: userAId, name: "A", status: "draft" },
    });
    const setB = await db.selectionSet.create({
      data: { userId: userAId, name: "B", status: "draft" },
    });

    const itemA = await createItem(setA.id, dA.design.id, dA.asset.id, 0);
    const itemB = await createItem(setB.id, dB.design.id, dB.asset.id, 0);

    const res = await POST(
      makePostRequest(setA.id, {
        itemIds: [itemA.id, itemB.id], // itemB başka set'in
        confirmation: "SİL",
      }),
      { params: { setId: setA.id } },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    // Yalnız itemA silindi
    expect(data.deletedCount).toBe(1);

    const rowA = await db.selectionItem.findUnique({ where: { id: itemA.id } });
    const rowB = await db.selectionItem.findUnique({ where: { id: itemB.id } });
    expect(rowA).toBeNull();
    expect(rowB).not.toBeNull(); // dokunulmadı
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

    const res = await POST(
      makePostRequest(set.id, {
        itemIds: [item.id],
        confirmation: "SİL",
      }),
      { params: { setId: set.id } },
    );

    expect(res.status).toBe(409);

    const row = await db.selectionItem.findUnique({ where: { id: item.id } });
    expect(row).not.toBeNull();
  });

  it("cross-user setId → 404", async () => {
    const setA = await db.selectionSet.create({
      data: { userId: userAId, name: "A's", status: "draft" },
    });

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userBId });
    const res = await POST(
      makePostRequest(setA.id, {
        itemIds: ["any"],
        confirmation: "SİL",
      }),
      { params: { setId: setA.id } },
    );
    expect(res.status).toBe(404);
  });

  it("boş itemIds array → 400 (zod min(1))", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Empty", status: "draft" },
    });

    const res = await POST(
      makePostRequest(set.id, {
        itemIds: [],
        confirmation: "SİL",
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
    const res = await POST(
      makePostRequest("any", {
        itemIds: ["x"],
        confirmation: "SİL",
      }),
      { params: { setId: "any" } },
    );
    expect(res.status).toBe(401);
  });

  it("Asset entity korunur — bulkDelete sonrası asset hâlâ DB'de", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "akeep");

    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "AssetKeep", status: "draft" },
    });
    const item = await createItem(set.id, d1.design.id, d1.asset.id, 0);

    const res = await POST(
      makePostRequest(set.id, {
        itemIds: [item.id],
        confirmation: "SİL",
      }),
      { params: { setId: set.id } },
    );
    expect(res.status).toBe(200);

    // Item silindi
    const itemRow = await db.selectionItem.findUnique({ where: { id: item.id } });
    expect(itemRow).toBeNull();

    // Asset (sourceAssetId) DB'de durmalı — DOKUNULMAZ kuralı
    const assetRow = await db.asset.findUnique({ where: { id: d1.asset.id } });
    expect(assetRow).not.toBeNull();
    // GeneratedDesign de korunur (asset'le birebir)
    const designRow = await db.generatedDesign.findUnique({
      where: { id: d1.design.id },
    });
    expect(designRow).not.toBeNull();
  });
});
