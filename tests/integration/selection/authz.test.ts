// Phase 7 Task 17 — Authorization helpers (404 disiplini) integration testleri.
//
// Sözleşme:
//   - `requireSetOwnership({ userId, setId })`:
//       owner match → SelectionSet entity döner
//       owner miss / yok → NotFoundError throw
//   - `requireItemOwnership({ userId, setId, itemId })`:
//       owner match + item set'e bağlı → SelectionItem entity döner
//       set ownership fail → NotFoundError (item ownership kontrolü yapılmadan)
//       item başka set'e bağlı → NotFoundError
//
// Cross-user disiplin: 403 değil 404 (varlık sızıntısını engellemek için).
// Phase 6 emsalı: `src/app/api/review/decisions/route.ts` — `findFirst({ id, userId })`
// dönmediyse `throw new NotFoundError()`.
//
// Test fixture stratejisi:
//   - 2 user (User A, User B). Her test başında selection tablolarını temizle
//     (cascade ile item'lar da gider; izolasyon için item temizliği de eklendi).
//   - Her user için 1 set; User A set'inde 1 item.
//   - Asset/Design fixture'ları schema test'inden alınan pattern.

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { NotFoundError } from "@/lib/errors";
import {
  requireItemOwnership,
  requireSetOwnership,
} from "@/server/services/selection/authz";

const PRODUCT_TYPE_KEY = "phase7-authz-pt";
const REFERENCE_ASSET_ID = "phase7-authz-ref-asset";
const REFERENCE_ID = "phase7-authz-ref";
const DESIGN_ASSET_ID_A = "phase7-authz-design-asset-a";
const DESIGN_ID_A = "phase7-authz-design-a";

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

let userAId: string;
let userBId: string;

async function ensureBaseFixtures(userId: string) {
  const productType = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "Phase7 Authz Wall Art",
      isSystem: false,
    },
  });

  const refAsset = await db.asset.upsert({
    where: { id: REFERENCE_ASSET_ID },
    update: {},
    create: {
      id: REFERENCE_ASSET_ID,
      userId,
      storageProvider: "local",
      storageKey: "phase7-authz/ref.png",
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: "phase7-authz-ref-hash",
    },
  });

  const reference = await db.reference.upsert({
    where: { id: REFERENCE_ID },
    update: {},
    create: {
      id: REFERENCE_ID,
      userId,
      assetId: refAsset.id,
      productTypeId: productType.id,
    },
  });

  const designAsset = await db.asset.upsert({
    where: { id: DESIGN_ASSET_ID_A },
    update: {},
    create: {
      id: DESIGN_ASSET_ID_A,
      userId,
      storageProvider: "local",
      storageKey: "phase7-authz/design-a.png",
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: "phase7-authz-design-hash-a",
    },
  });

  const design = await db.generatedDesign.upsert({
    where: { id: DESIGN_ID_A },
    update: {},
    create: {
      id: DESIGN_ID_A,
      userId,
      referenceId: reference.id,
      assetId: designAsset.id,
      productTypeId: productType.id,
    },
  });

  return { productType, refAsset, reference, designAsset, design };
}

async function cleanupSelections() {
  // Önce item, sonra set (cascade zaten var ama açık olalım).
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: [userAId, userBId] } } },
  });
  await db.selectionSet.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
}

beforeAll(async () => {
  const a = await ensureUser("phase7-authz-a@etsyhub.local");
  const b = await ensureUser("phase7-authz-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;
});

beforeEach(async () => {
  await cleanupSelections();
});

afterAll(async () => {
  await cleanupSelections();
});

describe("Phase 7 authz — requireSetOwnership", () => {
  it("User A set'ine User A erişimi → set entity döner", async () => {
    await ensureBaseFixtures(userAId);
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Set A" },
    });

    const result = await requireSetOwnership({
      userId: userAId,
      setId: set.id,
    });

    expect(result.id).toBe(set.id);
    expect(result.userId).toBe(userAId);
    expect(result.name).toBe("Set A");
  });

  it("User A set'ine User B erişimi → NotFoundError", async () => {
    await ensureBaseFixtures(userAId);
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Set A" },
    });

    await expect(
      requireSetOwnership({ userId: userBId, setId: set.id }),
    ).rejects.toThrow(NotFoundError);
  });

  it("Olmayan setId → NotFoundError", async () => {
    await expect(
      requireSetOwnership({
        userId: userAId,
        setId: "phase7-authz-nonexistent-set-id",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("Phase 7 authz — requireItemOwnership", () => {
  it("User A set + User A item → item entity döner", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Set A" },
    });
    const item = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: designAsset.id,
        position: 0,
      },
    });

    const result = await requireItemOwnership({
      userId: userAId,
      setId: set.id,
      itemId: item.id,
    });

    expect(result.id).toBe(item.id);
    expect(result.selectionSetId).toBe(set.id);
    expect(result.generatedDesignId).toBe(design.id);
  });

  it("User A set'ine User B userId ile erişim → NotFoundError (set ownership check'te düşer)", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Set A" },
    });
    const item = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: designAsset.id,
        position: 0,
      },
    });

    await expect(
      requireItemOwnership({
        userId: userBId,
        setId: set.id,
        itemId: item.id,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("User A set'i ama itemId başka set'in item'ı → NotFoundError", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const setA1 = await db.selectionSet.create({
      data: { userId: userAId, name: "Set A1" },
    });
    const setA2 = await db.selectionSet.create({
      data: { userId: userAId, name: "Set A2" },
    });
    // Item, setA2'ye bağlı.
    const itemInA2 = await db.selectionItem.create({
      data: {
        selectionSetId: setA2.id,
        generatedDesignId: design.id,
        sourceAssetId: designAsset.id,
        position: 0,
      },
    });

    // setA1.id + itemInA2.id ile erişim → 404 (item başka set'in)
    await expect(
      requireItemOwnership({
        userId: userAId,
        setId: setA1.id,
        itemId: itemInA2.id,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
