// Phase 7 Task 5 — SelectionItem service integration testleri.
//
// Sözleşmeler (plan Task 5, design Section 2.3 + 2.4 + 4.3 + 4.4):
//
//   - addItems({ userId, setId, items }):
//       requireSetOwnership + assertSetMutable
//       duplicate (set'te zaten olan generatedDesignId) skip
//       position artışı: mevcut max + 1, 2, ... (boş set'te 0'dan)
//       sourceAssetId GeneratedDesign.assetId'sinden
//       cross-user GeneratedDesign filter (silent skip — pragmatic karar:
//         başka kullanıcının design'ı set'e eklenemez; throw değil silent
//         filter — çünkü duplicate skip da silent davranıyor; UX uyumluluğu)
//       ready/archived set → SetReadOnlyError
//
//   - updateItemStatus({ userId, setId, itemId, status }):
//       requireItemOwnership + assertSetMutable
//       Tüm 6 geçiş valid (pending↔selected, pending↔rejected, selected↔rejected)
//       cross-user item → NotFoundError
//       ready set → SetReadOnlyError
//
//   - bulkUpdateStatus({ userId, setId, itemIds, status }):
//       requireSetOwnership + assertSetMutable
//       atomik updateMany; cross-set itemId'ler filter edilir
//       ready set → SetReadOnlyError
//
//   - bulkDelete({ userId, setId, itemIds }):
//       requireSetOwnership + assertSetMutable
//       Asset entity DOKUNULMAZ — yalnız SelectionItem silinir
//       cross-set itemId filter
//       ready set → SetReadOnlyError
//
//   - reorderItems({ userId, setId, itemIds }):
//       requireSetOwnership + assertSetMutable
//       Tam eşleşme şartı: itemIds === current item id'leri (sayı + içerik)
//       Eksik / fazla / duplicate / cross-set → reject (Error)
//       Atomik tx: position = array index
//       ready set → SetReadOnlyError
//
// Fixture stratejisi: Phase 6 paterni. 2 user, fresh fixture per test (cleanup
// FK order). Cross-set/cross-user testleri için "ikinci set" + "ikinci design"
// fixture'ı.

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { NotFoundError, SetReadOnlyError } from "@/lib/errors";
import {
  addItems,
  bulkDelete,
  bulkUpdateStatus,
  reorderItems,
  updateItemStatus,
} from "@/server/services/selection/items.service";
import { createSet } from "@/server/services/selection/sets.service";

const PRODUCT_TYPE_KEY = "phase7-items-pt";
const REFERENCE_ASSET_ID = "phase7-items-ref-asset";
const REFERENCE_ID = "phase7-items-ref";

let userAId: string;
let userBId: string;

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

/**
 * Verilen `userId` için temel fixture'lar (productType, referenceAsset,
 * reference). Birden fazla design oluşturmak isteyenler `createDesign`
 * helper'ını ayrı çağırır.
 */
async function ensureBase(userId: string) {
  const productType = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "Phase7 Items Wall Art",
      isSystem: false,
    },
  });

  const refAsset = await db.asset.upsert({
    where: { id: `${REFERENCE_ASSET_ID}-${userId}` },
    update: {},
    create: {
      id: `${REFERENCE_ASSET_ID}-${userId}`,
      userId,
      storageProvider: "local",
      storageKey: `phase7-items/${userId}/ref.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-items-ref-hash-${userId}`,
    },
  });

  const reference = await db.reference.upsert({
    where: { id: `${REFERENCE_ID}-${userId}` },
    update: {},
    create: {
      id: `${REFERENCE_ID}-${userId}`,
      userId,
      assetId: refAsset.id,
      productTypeId: productType.id,
    },
  });

  return { productType, reference };
}

/**
 * Bir kullanıcı için yeni bir GeneratedDesign + onun Asset'ini yaratır.
 * `tag` benzersizliği test isolation için — her test farklı tag kullanmalı.
 */
async function createDesign(args: {
  userId: string;
  productTypeId: string;
  referenceId: string;
  tag: string;
}) {
  const asset = await db.asset.create({
    data: {
      userId: args.userId,
      storageProvider: "local",
      storageKey: `phase7-items/${args.userId}/${args.tag}.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-items-design-hash-${args.userId}-${args.tag}-${Math.random()}`,
    },
  });
  const design = await db.generatedDesign.create({
    data: {
      userId: args.userId,
      referenceId: args.referenceId,
      assetId: asset.id,
      productTypeId: args.productTypeId,
    },
  });
  return { asset, design };
}

async function cleanupAll() {
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: [userAId, userBId] } } },
  });
  await db.selectionSet.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
  await db.generatedDesign.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
  await db.reference.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
  await db.asset.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
}

beforeAll(async () => {
  const a = await ensureUser("phase7-items-a@etsyhub.local");
  const b = await ensureUser("phase7-items-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;
});

beforeEach(async () => {
  await cleanupAll();
});

afterAll(async () => {
  await cleanupAll();
});

// ────────────────────────────────────────────────────────────
// addItems
// ────────────────────────────────────────────────────────────

describe("Phase 7 items — addItems", () => {
  it("boş set'te ilk eklemeler position 0'dan sıralı", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Empty Add" });

    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "d1",
    });
    const d2 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "d2",
    });
    const d3 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "d3",
    });

    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [
        { generatedDesignId: d1.design.id },
        { generatedDesignId: d2.design.id },
        { generatedDesignId: d3.design.id },
      ],
    });

    expect(created).toHaveLength(3);
    const positions = created.map((i) => i.position).sort((a, b) => a - b);
    expect(positions).toEqual([0, 1, 2]);
  });

  it("mevcut item'lar varken position max+1'den devam", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Existing" });

    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "ex1",
    });
    const d2 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "ex2",
    });
    const d3 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "ex3",
    });

    // İlk parti
    await addItems({
      userId: userAId,
      setId: set.id,
      items: [
        { generatedDesignId: d1.design.id },
        { generatedDesignId: d2.design.id },
      ],
    });

    // İkinci parti
    const second = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d3.design.id }],
    });

    expect(second).toHaveLength(1);
    expect(second[0]!.position).toBe(2);
  });

  it("duplicate generatedDesignId set'te varsa skip — sadece yeniler eklenir", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Dup" });

    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "dup1",
    });
    const d2 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "dup2",
    });

    await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });

    const second = await addItems({
      userId: userAId,
      setId: set.id,
      items: [
        { generatedDesignId: d1.design.id }, // duplicate — skip
        { generatedDesignId: d2.design.id }, // yeni — eklenir
      ],
    });

    expect(second).toHaveLength(1);
    expect(second[0]!.generatedDesignId).toBe(d2.design.id);
    expect(second[0]!.position).toBe(1);

    const all = await db.selectionItem.findMany({
      where: { selectionSetId: set.id },
    });
    expect(all).toHaveLength(2);
  });

  it("sourceAssetId GeneratedDesign.assetId'den okunur", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "AssetCheck" });

    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "ac1",
    });

    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });

    expect(created).toHaveLength(1);
    expect(created[0]!.sourceAssetId).toBe(d1.asset.id);
  });

  it("cross-user GeneratedDesign silent skip — başka user'ın design'ı eklenmez", async () => {
    const baseA = await ensureBase(userAId);
    const baseB = await ensureBase(userBId);
    const set = await createSet({ userId: userAId, name: "CrossUser" });

    const designA = await createDesign({
      userId: userAId,
      productTypeId: baseA.productType.id,
      referenceId: baseA.reference.id,
      tag: "cua",
    });
    const designB = await createDesign({
      userId: userBId,
      productTypeId: baseB.productType.id,
      referenceId: baseB.reference.id,
      tag: "cub",
    });

    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [
        { generatedDesignId: designA.design.id }, // valid
        { generatedDesignId: designB.design.id }, // cross-user → skip
      ],
    });

    expect(created).toHaveLength(1);
    expect(created[0]!.generatedDesignId).toBe(designA.design.id);

    const all = await db.selectionItem.findMany({
      where: { selectionSetId: set.id },
    });
    expect(all).toHaveLength(1);
  });

  it("ready set → SetReadOnlyError", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const draft = await createSet({ userId: userAId, name: "WillReady" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "ro1",
    });
    await db.selectionSet.update({
      where: { id: draft.id },
      data: { status: "ready", finalizedAt: new Date() },
    });

    await expect(
      addItems({
        userId: userAId,
        setId: draft.id,
        items: [{ generatedDesignId: d1.design.id }],
      }),
    ).rejects.toThrow(SetReadOnlyError);
  });

  it("cross-user set → NotFoundError", async () => {
    const baseA = await ensureBase(userAId);
    const baseB = await ensureBase(userBId);
    const setA = await createSet({ userId: userAId, name: "A's set" });
    const designB = await createDesign({
      userId: userBId,
      productTypeId: baseB.productType.id,
      referenceId: baseB.reference.id,
      tag: "xset",
    });
    void baseA;

    await expect(
      addItems({
        userId: userBId,
        setId: setA.id,
        items: [{ generatedDesignId: designB.design.id }],
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

// ────────────────────────────────────────────────────────────
// updateItemStatus
// ────────────────────────────────────────────────────────────

describe("Phase 7 items — updateItemStatus", () => {
  it("6 geçiş matrisinin tamamı valid (pending↔selected, pending↔rejected, selected↔rejected)", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Transitions" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "t1",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemId = created[0]!.id;

    const transitions: Array<"pending" | "selected" | "rejected"> = [
      "selected", // pending → selected
      "pending", // selected → pending
      "rejected", // pending → rejected
      "pending", // rejected → pending
      "selected", // pending → selected (yine)
      "rejected", // selected → rejected
      "selected", // rejected → selected
    ];
    for (const next of transitions) {
      const result = await updateItemStatus({
        userId: userAId,
        setId: set.id,
        itemId,
        status: next,
      });
      expect(result.status).toBe(next);
    }
  });

  it("ready set → SetReadOnlyError", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "RO" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "ro_us",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    await db.selectionSet.update({
      where: { id: set.id },
      data: { status: "ready", finalizedAt: new Date() },
    });

    await expect(
      updateItemStatus({
        userId: userAId,
        setId: set.id,
        itemId: created[0]!.id,
        status: "selected",
      }),
    ).rejects.toThrow(SetReadOnlyError);
  });

  it("cross-user item → NotFoundError", async () => {
    const baseA = await ensureBase(userAId);
    const setA = await createSet({ userId: userAId, name: "A set" });
    const designA = await createDesign({
      userId: userAId,
      productTypeId: baseA.productType.id,
      referenceId: baseA.reference.id,
      tag: "x1",
    });
    const created = await addItems({
      userId: userAId,
      setId: setA.id,
      items: [{ generatedDesignId: designA.design.id }],
    });

    // userB, A'nın item'ını güncellemeye çalışır
    await expect(
      updateItemStatus({
        userId: userBId,
        setId: setA.id,
        itemId: created[0]!.id,
        status: "selected",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("olmayan itemId → NotFoundError", async () => {
    const set = await createSet({ userId: userAId, name: "NoItem" });
    await expect(
      updateItemStatus({
        userId: userAId,
        setId: set.id,
        itemId: "phase7-items-nonexistent",
        status: "selected",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

// ────────────────────────────────────────────────────────────
// bulkUpdateStatus
// ────────────────────────────────────────────────────────────

describe("Phase 7 items — bulkUpdateStatus", () => {
  it("set'in item'larını atomik update; updatedCount doğru", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Bulk" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "b1",
    });
    const d2 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "b2",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [
        { generatedDesignId: d1.design.id },
        { generatedDesignId: d2.design.id },
      ],
    });

    const result = await bulkUpdateStatus({
      userId: userAId,
      setId: set.id,
      itemIds: created.map((i) => i.id),
      status: "selected",
    });

    expect(result.updatedCount).toBe(2);
    const fresh = await db.selectionItem.findMany({
      where: { selectionSetId: set.id },
    });
    expect(fresh.every((i) => i.status === "selected")).toBe(true);
  });

  it("cross-set itemId filter — başka set'in item'ı update edilmez", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const setA = await createSet({ userId: userAId, name: "A" });
    const setB = await createSet({ userId: userAId, name: "B" });

    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "cs1",
    });
    const d2 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "cs2",
    });

    const itemsA = await addItems({
      userId: userAId,
      setId: setA.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemsB = await addItems({
      userId: userAId,
      setId: setB.id,
      items: [{ generatedDesignId: d2.design.id }],
    });

    // setA'ya updateMany çağırırken setB'nin item id'sini de yolla — filter
    // edilmeli
    const result = await bulkUpdateStatus({
      userId: userAId,
      setId: setA.id,
      itemIds: [itemsA[0]!.id, itemsB[0]!.id],
      status: "rejected",
    });

    expect(result.updatedCount).toBe(1);
    const aFresh = await db.selectionItem.findUnique({
      where: { id: itemsA[0]!.id },
    });
    const bFresh = await db.selectionItem.findUnique({
      where: { id: itemsB[0]!.id },
    });
    expect(aFresh?.status).toBe("rejected");
    expect(bFresh?.status).toBe("pending"); // değişmedi
  });

  it("ready set → SetReadOnlyError", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "RO Bulk" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "robulk",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    await db.selectionSet.update({
      where: { id: set.id },
      data: { status: "ready", finalizedAt: new Date() },
    });

    await expect(
      bulkUpdateStatus({
        userId: userAId,
        setId: set.id,
        itemIds: [created[0]!.id],
        status: "selected",
      }),
    ).rejects.toThrow(SetReadOnlyError);
  });

  it("cross-user set → NotFoundError", async () => {
    const set = await createSet({ userId: userAId, name: "A set" });
    await expect(
      bulkUpdateStatus({
        userId: userBId,
        setId: set.id,
        itemIds: ["x"],
        status: "selected",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

// ────────────────────────────────────────────────────────────
// bulkDelete
// ────────────────────────────────────────────────────────────

describe("Phase 7 items — bulkDelete", () => {
  it("yalnız SelectionItem silinir; Asset DB'de kalır", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Del" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "del1",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });

    const result = await bulkDelete({
      userId: userAId,
      setId: set.id,
      itemIds: [created[0]!.id],
    });

    expect(result.deletedCount).toBe(1);

    // SelectionItem silindi
    const items = await db.selectionItem.findMany({
      where: { selectionSetId: set.id },
    });
    expect(items).toHaveLength(0);

    // Asset hâlâ var (carry-forward)
    const assetStill = await db.asset.findUnique({
      where: { id: d1.asset.id },
    });
    expect(assetStill).not.toBeNull();

    // GeneratedDesign hâlâ var
    const designStill = await db.generatedDesign.findUnique({
      where: { id: d1.design.id },
    });
    expect(designStill).not.toBeNull();
  });

  it("cross-set itemId filter — başka set'in item'ı silinmez", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const setA = await createSet({ userId: userAId, name: "A" });
    const setB = await createSet({ userId: userAId, name: "B" });

    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "delcs1",
    });
    const d2 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "delcs2",
    });

    const itemsA = await addItems({
      userId: userAId,
      setId: setA.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemsB = await addItems({
      userId: userAId,
      setId: setB.id,
      items: [{ generatedDesignId: d2.design.id }],
    });

    const result = await bulkDelete({
      userId: userAId,
      setId: setA.id,
      itemIds: [itemsA[0]!.id, itemsB[0]!.id],
    });

    expect(result.deletedCount).toBe(1);

    const stillA = await db.selectionItem.findUnique({
      where: { id: itemsA[0]!.id },
    });
    const stillB = await db.selectionItem.findUnique({
      where: { id: itemsB[0]!.id },
    });
    expect(stillA).toBeNull();
    expect(stillB).not.toBeNull();
  });

  it("ready set → SetReadOnlyError", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "RO Del" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "rodel",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    await db.selectionSet.update({
      where: { id: set.id },
      data: { status: "ready", finalizedAt: new Date() },
    });

    await expect(
      bulkDelete({
        userId: userAId,
        setId: set.id,
        itemIds: [created[0]!.id],
      }),
    ).rejects.toThrow(SetReadOnlyError);
  });
});

// ────────────────────────────────────────────────────────────
// reorderItems
// ────────────────────────────────────────────────────────────

describe("Phase 7 items — reorderItems", () => {
  it("tam eşleşen itemIds + position update (atomik)", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Reorder" });

    const designs = await Promise.all(
      ["r1", "r2", "r3"].map((tag) =>
        createDesign({
          userId: userAId,
          productTypeId: productType.id,
          referenceId: reference.id,
          tag,
        }),
      ),
    );
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: designs.map((d) => ({ generatedDesignId: d.design.id })),
    });

    // Ters sıraya çevir
    const reverseIds = [...created].reverse().map((i) => i.id);
    const reordered = await reorderItems({
      userId: userAId,
      setId: set.id,
      itemIds: reverseIds,
    });

    expect(reordered.map((i) => i.id)).toEqual(reverseIds);
    expect(reordered.map((i) => i.position)).toEqual([0, 1, 2]);

    // DB doğrulaması
    const fresh = await db.selectionItem.findMany({
      where: { selectionSetId: set.id },
      orderBy: { position: "asc" },
    });
    expect(fresh.map((i) => i.id)).toEqual(reverseIds);
  });

  it("itemIds eksikse reject", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Short" });
    const designs = await Promise.all(
      ["s1", "s2"].map((tag) =>
        createDesign({
          userId: userAId,
          productTypeId: productType.id,
          referenceId: reference.id,
          tag,
        }),
      ),
    );
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: designs.map((d) => ({ generatedDesignId: d.design.id })),
    });

    await expect(
      reorderItems({
        userId: userAId,
        setId: set.id,
        itemIds: [created[0]!.id], // 2 item var, 1 verildi
      }),
    ).rejects.toThrow();

    // Hiçbir position değişmemiş olmalı
    const fresh = await db.selectionItem.findMany({
      where: { selectionSetId: set.id },
      orderBy: { position: "asc" },
    });
    expect(fresh.map((i) => i.position)).toEqual([0, 1]);
  });

  it("itemIds fazlaysa reject", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Long" });
    const designs = await Promise.all(
      ["l1"].map((tag) =>
        createDesign({
          userId: userAId,
          productTypeId: productType.id,
          referenceId: reference.id,
          tag,
        }),
      ),
    );
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: designs.map((d) => ({ generatedDesignId: d.design.id })),
    });

    await expect(
      reorderItems({
        userId: userAId,
        setId: set.id,
        itemIds: [created[0]!.id, "phase7-items-bogus"],
      }),
    ).rejects.toThrow();
  });

  it("başka set'in item'ı içerirse reject (tam eşleşme bozulur)", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const setA = await createSet({ userId: userAId, name: "A" });
    const setB = await createSet({ userId: userAId, name: "B" });

    const dA = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "rxa",
    });
    const dB = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "rxb",
    });

    const itemsA = await addItems({
      userId: userAId,
      setId: setA.id,
      items: [{ generatedDesignId: dA.design.id }],
    });
    const itemsB = await addItems({
      userId: userAId,
      setId: setB.id,
      items: [{ generatedDesignId: dB.design.id }],
    });

    await expect(
      reorderItems({
        userId: userAId,
        setId: setA.id,
        itemIds: [itemsA[0]!.id, itemsB[0]!.id], // setB'nin item'ı
      }),
    ).rejects.toThrow();
  });

  it("ready set → SetReadOnlyError", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "RO Reorder" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "ror",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    await db.selectionSet.update({
      where: { id: set.id },
      data: { status: "ready", finalizedAt: new Date() },
    });

    await expect(
      reorderItems({
        userId: userAId,
        setId: set.id,
        itemIds: [created[0]!.id],
      }),
    ).rejects.toThrow(SetReadOnlyError);
  });
});
