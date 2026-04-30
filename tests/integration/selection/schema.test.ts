// Phase 7 Task 1 — SelectionSet / SelectionItem Prisma schema integration testleri.
//
// Sözleşme:
//   - SelectionSet: status default `draft`, auto fields (id, createdAt, updatedAt)
//     atanır; sourceMetadata Json? null kabul eder; userId FK User'a bağlıdır.
//   - SelectionItem: 3 ayrı Asset FK (source/edited/undoable), GeneratedDesign FK
//     (Restrict), SelectionSet FK (Cascade); status default `pending`,
//     editHistoryJson default `[]`; position Int.
//   - FK constraint: orphan SelectionItem (yokolan setId) reject edilir.
//   - Cascade: SelectionSet silinince ilgili SelectionItem rowları da silinir.
//   - Enum: SelectionSetStatus = {draft, ready, archived};
//           SelectionItemStatus = {pending, selected, rejected}.
//
// Bu testler Task 1 kapsamında migration (`phase7_selection`) uygulandıktan sonra
// PASS olmalıdır. Migration uygulanmadan önce Prisma client'da SelectionSet /
// SelectionItem tipi olmadığı için TypeScript compile aşamasında dahi fail
// olabilir — bu beklenen TDD davranışıdır (red → green).

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "@/server/db";

const USER_ID = "phase7-schema-user";
const PRODUCT_TYPE_KEY = "phase7-schema-pt";
const REFERENCE_ASSET_ID = "phase7-schema-ref-asset";
const REFERENCE_ID = "phase7-schema-ref";
const DESIGN_ASSET_ID_1 = "phase7-schema-design-asset-1";
const DESIGN_ASSET_ID_2 = "phase7-schema-design-asset-2";
const DESIGN_ASSET_ID_3 = "phase7-schema-design-asset-3";
const DESIGN_ID_1 = "phase7-schema-design-1";

async function setupBaseFixtures() {
  await db.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: {
      id: USER_ID,
      email: "phase7-schema@test.local",
      passwordHash: "x",
    },
  });

  const productType = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "Phase7 Schema Wall Art",
      isSystem: false,
    },
  });

  const refAsset = await db.asset.upsert({
    where: { id: REFERENCE_ASSET_ID },
    update: {},
    create: {
      id: REFERENCE_ASSET_ID,
      userId: USER_ID,
      storageProvider: "local",
      storageKey: "phase7/ref.png",
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: "phase7-ref-hash",
    },
  });

  const reference = await db.reference.upsert({
    where: { id: REFERENCE_ID },
    update: {},
    create: {
      id: REFERENCE_ID,
      userId: USER_ID,
      assetId: refAsset.id,
      productTypeId: productType.id,
    },
  });

  // Source asset for the design (immutable role)
  const designAsset1 = await db.asset.upsert({
    where: { id: DESIGN_ASSET_ID_1 },
    update: {},
    create: {
      id: DESIGN_ASSET_ID_1,
      userId: USER_ID,
      storageProvider: "local",
      storageKey: "phase7/design-1.png",
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: "phase7-design-hash-1",
    },
  });
  const designAsset2 = await db.asset.upsert({
    where: { id: DESIGN_ASSET_ID_2 },
    update: {},
    create: {
      id: DESIGN_ASSET_ID_2,
      userId: USER_ID,
      storageProvider: "local",
      storageKey: "phase7/design-2.png",
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: "phase7-design-hash-2",
    },
  });
  const designAsset3 = await db.asset.upsert({
    where: { id: DESIGN_ASSET_ID_3 },
    update: {},
    create: {
      id: DESIGN_ASSET_ID_3,
      userId: USER_ID,
      storageProvider: "local",
      storageKey: "phase7/design-3.png",
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: "phase7-design-hash-3",
    },
  });

  const design = await db.generatedDesign.upsert({
    where: { id: DESIGN_ID_1 },
    update: {},
    create: {
      id: DESIGN_ID_1,
      userId: USER_ID,
      referenceId: reference.id,
      assetId: designAsset1.id,
      productTypeId: productType.id,
    },
  });

  return {
    productType,
    refAsset,
    reference,
    designAsset1,
    designAsset2,
    designAsset3,
    design,
  };
}

async function cleanupSelections() {
  // Cascade üstünden item'lar silinir; ama izolasyon için iki tabloyu da
  // temizliyoruz. Set silinmesi item'ları otomatik düşürür (Cascade).
  await db.selectionItem.deleteMany({ where: { selectionSet: { userId: USER_ID } } });
  await db.selectionSet.deleteMany({ where: { userId: USER_ID } });
}

beforeEach(async () => {
  await cleanupSelections();
});

afterAll(async () => {
  await cleanupSelections();
});

describe("Phase 7 schema — SelectionSet / SelectionItem", () => {
  it("SelectionSet create — status default draft, id/createdAt/updatedAt otomatik atanır", async () => {
    await setupBaseFixtures();

    const set = await db.selectionSet.create({
      data: {
        userId: USER_ID,
        name: "Test Set",
      },
    });

    expect(set.id).toBeTruthy();
    expect(set.userId).toBe(USER_ID);
    expect(set.name).toBe("Test Set");
    expect(set.status).toBe("draft");
    expect(set.createdAt).toBeInstanceOf(Date);
    expect(set.updatedAt).toBeInstanceOf(Date);
    expect(set.sourceMetadata).toBeNull();
    expect(set.lastExportedAt).toBeNull();
    expect(set.finalizedAt).toBeNull();
    expect(set.archivedAt).toBeNull();
  });

  it("SelectionItem create — FK relations (set, design, asset) çalışır + status default pending, editHistoryJson default []", async () => {
    const { design, designAsset1 } = await setupBaseFixtures();

    const set = await db.selectionSet.create({
      data: { userId: USER_ID, name: "Item Test Set" },
    });

    const item = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: designAsset1.id,
        position: 0,
      },
    });

    expect(item.id).toBeTruthy();
    expect(item.selectionSetId).toBe(set.id);
    expect(item.generatedDesignId).toBe(design.id);
    expect(item.sourceAssetId).toBe(designAsset1.id);
    expect(item.editedAssetId).toBeNull();
    expect(item.lastUndoableAssetId).toBeNull();
    expect(item.status).toBe("pending");
    expect(item.position).toBe(0);
    expect(item.editHistoryJson).toEqual([]);
    expect(item.createdAt).toBeInstanceOf(Date);
    expect(item.updatedAt).toBeInstanceOf(Date);
  });

  it("SelectionItem 3 ayrı Asset FK — editedAssetId + lastUndoableAssetId set edilebilir", async () => {
    const { design, designAsset1, designAsset2, designAsset3 } = await setupBaseFixtures();

    const set = await db.selectionSet.create({
      data: { userId: USER_ID, name: "Multi-FK Test Set" },
    });

    const item = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: designAsset1.id,
        editedAssetId: designAsset2.id,
        lastUndoableAssetId: designAsset3.id,
        position: 0,
      },
    });

    expect(item.sourceAssetId).toBe(designAsset1.id);
    expect(item.editedAssetId).toBe(designAsset2.id);
    expect(item.lastUndoableAssetId).toBe(designAsset3.id);
  });

  it("FK constraint — orphan SelectionItem (yokolan setId) insert reject edilir", async () => {
    const { design, designAsset1 } = await setupBaseFixtures();

    await expect(
      db.selectionItem.create({
        data: {
          selectionSetId: "phase7-nonexistent-set-id",
          generatedDesignId: design.id,
          sourceAssetId: designAsset1.id,
          position: 0,
        },
      }),
    ).rejects.toThrow();
  });

  it("Cascade delete — SelectionSet silinince items da silinir", async () => {
    const { design, designAsset1 } = await setupBaseFixtures();

    const set = await db.selectionSet.create({
      data: { userId: USER_ID, name: "Cascade Test Set" },
    });
    const item = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: designAsset1.id,
        position: 0,
      },
    });

    // sanity: item exists
    const before = await db.selectionItem.findUnique({ where: { id: item.id } });
    expect(before).not.toBeNull();

    // delete set
    await db.selectionSet.delete({ where: { id: set.id } });

    // item should be cascade-deleted
    const after = await db.selectionItem.findUnique({ where: { id: item.id } });
    expect(after).toBeNull();
  });

  it("SelectionItemStatus enum default pending + diğer geçerli değerler kabul edilir", async () => {
    const { design, designAsset1 } = await setupBaseFixtures();

    const set = await db.selectionSet.create({
      data: { userId: USER_ID, name: "Status Test Set" },
    });

    const pending = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: designAsset1.id,
        position: 0,
      },
    });
    expect(pending.status).toBe("pending");

    const selected = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: designAsset1.id,
        position: 1,
        status: "selected",
      },
    });
    expect(selected.status).toBe("selected");

    const rejected = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: designAsset1.id,
        position: 2,
        status: "rejected",
      },
    });
    expect(rejected.status).toBe("rejected");
  });

  it("SelectionSetStatus enum — ready ve archived geçerli değerler kabul edilir", async () => {
    await setupBaseFixtures();

    const ready = await db.selectionSet.create({
      data: { userId: USER_ID, name: "Ready Set", status: "ready" },
    });
    expect(ready.status).toBe("ready");

    const archived = await db.selectionSet.create({
      data: { userId: USER_ID, name: "Archived Set", status: "archived" },
    });
    expect(archived.status).toBe("archived");
  });

  it("SelectionSet sourceMetadata Json kabul eder (quick-start metadata)", async () => {
    await setupBaseFixtures();

    const set = await db.selectionSet.create({
      data: {
        userId: USER_ID,
        name: "Quick Start Set",
        sourceMetadata: {
          kind: "reference-batch",
          referenceId: REFERENCE_ID,
          batchId: "batch-123",
          productTypeId: "pt-123",
          batchCreatedAt: "2026-04-30T00:00:00.000Z",
          originalCount: 6,
        },
      },
    });

    expect(set.sourceMetadata).toEqual({
      kind: "reference-batch",
      referenceId: REFERENCE_ID,
      batchId: "batch-123",
      productTypeId: "pt-123",
      batchCreatedAt: "2026-04-30T00:00:00.000Z",
      originalCount: 6,
    });
  });
});
