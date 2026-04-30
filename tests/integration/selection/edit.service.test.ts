// Phase 7 Task 6 — Edit service (orchestrator) integration testleri.
//
// Sözleşmeler (plan Task 6, design Section 4.5 + 5 + 5.1):
//
//   - applyEdit({ userId, setId, itemId, op }):
//       requireItemOwnership + assertSetMutable
//       Aktif görüntü kuralı: input = item.editedAssetId ?? item.sourceAssetId
//       op delegation:
//         - "crop"              → cropAsset({ inputAssetId, params })
//         - "transparent-check" → transparentCheck({ inputAssetId })
//                                 ASSET ÜRETMEZ — yalnız history record
//         - "background-remove" → REJECT (heavy op; applyEditAsync kullan)
//       Asset üreten op'ta DB update (tek tx):
//         - eski editedAssetId (varsa) → lastUndoableAssetId
//         - yeni asset → editedAssetId
//         - editHistoryJson push: { op, params?, at }
//       transparent-check'te:
//         - editedAssetId değişmez, lastUndoableAssetId değişmez
//         - editHistoryJson push: { op: "transparent-check", at, result }
//
//   - undoEdit({ userId, setId, itemId }):
//       requireItemOwnership + assertSetMutable
//       Guard: item.lastUndoableAssetId yoksa → throw
//       Swap: editedAssetId = lastUndoableAssetId, lastUndoableAssetId = null
//       History pop (Section 4.5: "lastUndoableAssetId swap, history son op
//       pop" — pragmatic karar).
//
//   - resetItem({ userId, setId, itemId }):
//       requireItemOwnership + assertSetMutable
//       editedAssetId = null, lastUndoableAssetId = null, editHistoryJson = []
//       Asset cleanup YAPMAZ (carry-forward asset-orphan-cleanup).
//
//   - applyEditAsync({ userId, setId, itemId, op }):
//       requireItemOwnership + assertSetMutable
//       Yalnız "background-remove" kabul; "crop" / "transparent-check" reject
//       (instant op'lar applyEdit'ten gider).
//       Stub return: { jobId } — gerçek BullMQ enqueue Task 10'da.
//       Paralel heavy yasağı bu task'te STUB (Task 10'da real lock).
//
// Mock stratejisi:
//   vi.mock ile edit-ops fonksiyonları override edilir. Orchestrator'ın
//   doğru fonksiyonu doğru argümanla çağırdığını ve sonucunu DB invariant'larına
//   doğru çevirdiğini test ederiz. Edit-ops kendi implementasyonu Task 7-9'da
//   ayrı test'lenecek.
//
// Fixture: items.service.test.ts patterni (2 user, fresh per test, FK cleanup).

import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { NotFoundError, SetReadOnlyError } from "@/lib/errors";
import { addItems } from "@/server/services/selection/items.service";
import { createSet } from "@/server/services/selection/sets.service";

// Edit-ops mock'lanır — gerçek implementasyon Task 7-9'da. Orchestrator'ın
// doğru fonksiyonu çağırdığı + sonucu invariant'lara doğru process ettiği test
// edilir.
vi.mock("@/server/services/selection/edit-ops/crop", () => ({
  cropAsset: vi.fn(),
}));
vi.mock(
  "@/server/services/selection/edit-ops/transparent-check",
  () => ({
    transparentCheck: vi.fn(),
  }),
);

// İmport mock'lardan SONRA — vi.mock hoist edilir, orchestrator kullanırken
// mocked versiyonu görür.
import {
  applyEdit,
  applyEditAsync,
  resetItem,
  undoEdit,
} from "@/server/services/selection/edit.service";
import { cropAsset } from "@/server/services/selection/edit-ops/crop";
import { transparentCheck } from "@/server/services/selection/edit-ops/transparent-check";

const PRODUCT_TYPE_KEY = "phase7-edit-pt";
const REFERENCE_ASSET_ID = "phase7-edit-ref-asset";
const REFERENCE_ID = "phase7-edit-ref";

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

async function ensureBase(userId: string) {
  const productType = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "Phase7 Edit Wall Art",
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
      storageKey: `phase7-edit/${userId}/ref.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-edit-ref-hash-${userId}`,
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
      storageKey: `phase7-edit/${args.userId}/${args.tag}.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-edit-design-hash-${args.userId}-${args.tag}-${Math.random()}`,
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

/**
 * Edit-op çıktısını temsil eden ham Asset row yaratır. Gerçek implementasyon
 * Task 7'de (Sharp + storage upload). Test'te yalnız Asset entity DB'de var
 * olmalı (FK constraint için).
 */
async function createEditOutputAsset(userId: string, tag: string) {
  return db.asset.create({
    data: {
      userId,
      storageProvider: "local",
      storageKey: `phase7-edit/${userId}/edit-out-${tag}.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-edit-out-${userId}-${tag}-${Math.random()}`,
    },
  });
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
  const a = await ensureUser("phase7-edit-a@etsyhub.local");
  const b = await ensureUser("phase7-edit-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;
});

beforeEach(async () => {
  await cleanupAll();
  vi.mocked(cropAsset).mockReset();
  vi.mocked(transparentCheck).mockReset();
});

afterAll(async () => {
  await cleanupAll();
});

// ────────────────────────────────────────────────────────────
// applyEdit — crop (asset üreten instant op)
// ────────────────────────────────────────────────────────────

describe("Phase 7 edit — applyEdit crop", () => {
  it("ilk crop sonrası editedAssetId yeni asset, sourceAssetId değişmez, history push", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Crop1" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "c1",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemId = created[0]!.id;

    const newAsset = await createEditOutputAsset(userAId, "c1-out1");
    vi.mocked(cropAsset).mockResolvedValue({ assetId: newAsset.id });

    const result = await applyEdit({
      userId: userAId,
      setId: set.id,
      itemId,
      op: { op: "crop", params: { ratio: "2:3" } },
    });

    // Edit-op doğru argümanla çağrıldı (input = sourceAssetId, edited yok)
    expect(cropAsset).toHaveBeenCalledTimes(1);
    expect(cropAsset).toHaveBeenCalledWith({
      inputAssetId: d1.asset.id,
      params: { ratio: "2:3" },
    });

    // Invariant'lar
    expect(result.sourceAssetId).toBe(d1.asset.id);
    expect(result.editedAssetId).toBe(newAsset.id);
    expect(result.lastUndoableAssetId).toBeNull();

    const history = result.editHistoryJson as Array<{
      op: string;
      params?: Record<string, unknown>;
      at: string;
    }>;
    expect(history).toHaveLength(1);
    expect(history[0]!.op).toBe("crop");
    expect(history[0]!.params).toEqual({ ratio: "2:3" });
    expect(typeof history[0]!.at).toBe("string");
  });

  it("ikinci crop sonrası eski editedAssetId lastUndoableAssetId'ye düşer (chaining)", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Crop2" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "c2",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemId = created[0]!.id;

    const out1 = await createEditOutputAsset(userAId, "c2-out1");
    const out2 = await createEditOutputAsset(userAId, "c2-out2");

    vi.mocked(cropAsset)
      .mockResolvedValueOnce({ assetId: out1.id })
      .mockResolvedValueOnce({ assetId: out2.id });

    // İlk crop
    await applyEdit({
      userId: userAId,
      setId: set.id,
      itemId,
      op: { op: "crop", params: { ratio: "2:3" } },
    });

    // İkinci crop — input artık out1 (editedAssetId), out1 → undoable, out2 → edited
    const second = await applyEdit({
      userId: userAId,
      setId: set.id,
      itemId,
      op: { op: "crop", params: { ratio: "1:1" } },
    });

    expect(cropAsset).toHaveBeenNthCalledWith(2, {
      inputAssetId: out1.id, // ikinci çağrı input olarak ilk edit'in çıktısını alır
      params: { ratio: "1:1" },
    });

    expect(second.sourceAssetId).toBe(d1.asset.id);
    expect(second.editedAssetId).toBe(out2.id);
    expect(second.lastUndoableAssetId).toBe(out1.id);

    const history = second.editHistoryJson as Array<{ op: string }>;
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.op)).toEqual(["crop", "crop"]);
  });
});

// ────────────────────────────────────────────────────────────
// applyEdit — transparent-check (asset ÜRETMEZ)
// ────────────────────────────────────────────────────────────

describe("Phase 7 edit — applyEdit transparent-check", () => {
  it("transparent-check asset üretmez; editedAssetId/lastUndoableAssetId değişmez; history'ye record push", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "TC" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "tc1",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemId = created[0]!.id;

    vi.mocked(transparentCheck).mockResolvedValue({
      ok: true,
      signals: {
        hasAlphaChannel: true,
        alphaCoveragePercent: 42,
        edgeContaminationPercent: 1,
      },
      summary: "Clean transparent PNG",
    });

    const result = await applyEdit({
      userId: userAId,
      setId: set.id,
      itemId,
      op: { op: "transparent-check" },
    });

    expect(transparentCheck).toHaveBeenCalledTimes(1);
    expect(transparentCheck).toHaveBeenCalledWith({
      inputAssetId: d1.asset.id,
    });

    // Asset alanları DEĞİŞMEDİ
    expect(result.sourceAssetId).toBe(d1.asset.id);
    expect(result.editedAssetId).toBeNull();
    expect(result.lastUndoableAssetId).toBeNull();

    // History'de record var
    const history = result.editHistoryJson as Array<{
      op: string;
      result?: unknown;
    }>;
    expect(history).toHaveLength(1);
    expect(history[0]!.op).toBe("transparent-check");
    expect(history[0]!.result).toMatchObject({
      ok: true,
      summary: "Clean transparent PNG",
    });
  });

  it("transparent-check var iken sonradan crop yapılabilir — undoable doğru chain", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "TC+Crop" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "tcc",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemId = created[0]!.id;

    vi.mocked(transparentCheck).mockResolvedValue({
      ok: false,
      signals: {
        hasAlphaChannel: false,
        alphaCoveragePercent: 0,
        edgeContaminationPercent: 0,
      },
      summary: "No alpha",
    });

    await applyEdit({
      userId: userAId,
      setId: set.id,
      itemId,
      op: { op: "transparent-check" },
    });

    const out = await createEditOutputAsset(userAId, "tcc-crop");
    vi.mocked(cropAsset).mockResolvedValue({ assetId: out.id });

    const result = await applyEdit({
      userId: userAId,
      setId: set.id,
      itemId,
      op: { op: "crop", params: { ratio: "1:1" } },
    });

    // Crop input = sourceAssetId (henüz editedAssetId yok)
    expect(cropAsset).toHaveBeenCalledWith({
      inputAssetId: d1.asset.id,
      params: { ratio: "1:1" },
    });

    expect(result.editedAssetId).toBe(out.id);
    // transparent-check asset üretmediği için undoable hâlâ null
    expect(result.lastUndoableAssetId).toBeNull();

    const history = result.editHistoryJson as Array<{ op: string }>;
    expect(history.map((h) => h.op)).toEqual([
      "transparent-check",
      "crop",
    ]);
  });
});

// ────────────────────────────────────────────────────────────
// applyEdit — heavy op REJECT
// ────────────────────────────────────────────────────────────

describe("Phase 7 edit — applyEdit heavy op reject", () => {
  it("background-remove applyEdit'ten reject; applyEditAsync kullanılmalı", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "BgR" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "bgr",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });

    await expect(
      applyEdit({
        userId: userAId,
        setId: set.id,
        itemId: created[0]!.id,
        op: { op: "background-remove" },
      }),
    ).rejects.toThrow(/heavy op/i);
  });
});

// ────────────────────────────────────────────────────────────
// applyEdit — guards
// ────────────────────────────────────────────────────────────

describe("Phase 7 edit — applyEdit guards", () => {
  it("ready set → SetReadOnlyError", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "RO" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "roe",
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
      applyEdit({
        userId: userAId,
        setId: set.id,
        itemId: created[0]!.id,
        op: { op: "crop", params: { ratio: "2:3" } },
      }),
    ).rejects.toThrow(SetReadOnlyError);
  });

  it("cross-user item → NotFoundError", async () => {
    const baseA = await ensureBase(userAId);
    const setA = await createSet({ userId: userAId, name: "A" });
    const dA = await createDesign({
      userId: userAId,
      productTypeId: baseA.productType.id,
      referenceId: baseA.reference.id,
      tag: "xua",
    });
    const itemsA = await addItems({
      userId: userAId,
      setId: setA.id,
      items: [{ generatedDesignId: dA.design.id }],
    });

    await expect(
      applyEdit({
        userId: userBId,
        setId: setA.id,
        itemId: itemsA[0]!.id,
        op: { op: "crop", params: { ratio: "2:3" } },
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

// ────────────────────────────────────────────────────────────
// undoEdit
// ────────────────────────────────────────────────────────────

describe("Phase 7 edit — undoEdit", () => {
  it("editedAssetId ↔ lastUndoableAssetId swap; lastUndoable null'a düşer; history pop", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Undo" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "u1",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemId = created[0]!.id;

    const out1 = await createEditOutputAsset(userAId, "u1-1");
    const out2 = await createEditOutputAsset(userAId, "u1-2");
    vi.mocked(cropAsset)
      .mockResolvedValueOnce({ assetId: out1.id })
      .mockResolvedValueOnce({ assetId: out2.id });

    // İki crop — sonunda edited=out2, undoable=out1
    await applyEdit({
      userId: userAId,
      setId: set.id,
      itemId,
      op: { op: "crop", params: { ratio: "2:3" } },
    });
    await applyEdit({
      userId: userAId,
      setId: set.id,
      itemId,
      op: { op: "crop", params: { ratio: "1:1" } },
    });

    const undone = await undoEdit({
      userId: userAId,
      setId: set.id,
      itemId,
    });

    // Tek seviye undo: edited = out1, undoable = null
    expect(undone.editedAssetId).toBe(out1.id);
    expect(undone.lastUndoableAssetId).toBeNull();
    expect(undone.sourceAssetId).toBe(d1.asset.id);

    // History pop — son op kaldırıldı
    const history = undone.editHistoryJson as Array<{
      op: string;
      params?: Record<string, unknown>;
    }>;
    expect(history).toHaveLength(1);
    expect(history[0]!.params).toEqual({ ratio: "2:3" });
  });

  it("lastUndoableAssetId yoksa reject", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "NoUndo" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "nu",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });

    await expect(
      undoEdit({
        userId: userAId,
        setId: set.id,
        itemId: created[0]!.id,
      }),
    ).rejects.toThrow();
  });

  it("ready set → SetReadOnlyError", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "URO" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "uro",
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
      undoEdit({
        userId: userAId,
        setId: set.id,
        itemId: created[0]!.id,
      }),
    ).rejects.toThrow(SetReadOnlyError);
  });
});

// ────────────────────────────────────────────────────────────
// resetItem
// ────────────────────────────────────────────────────────────

describe("Phase 7 edit — resetItem", () => {
  it("editedAssetId, lastUndoableAssetId null'a, history boş array'e düşer", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Reset" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "rs",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });
    const itemId = created[0]!.id;

    const out1 = await createEditOutputAsset(userAId, "rs-1");
    const out2 = await createEditOutputAsset(userAId, "rs-2");
    vi.mocked(cropAsset)
      .mockResolvedValueOnce({ assetId: out1.id })
      .mockResolvedValueOnce({ assetId: out2.id });

    await applyEdit({
      userId: userAId,
      setId: set.id,
      itemId,
      op: { op: "crop", params: { ratio: "2:3" } },
    });
    await applyEdit({
      userId: userAId,
      setId: set.id,
      itemId,
      op: { op: "crop", params: { ratio: "1:1" } },
    });

    const reset = await resetItem({
      userId: userAId,
      setId: set.id,
      itemId,
    });

    expect(reset.editedAssetId).toBeNull();
    expect(reset.lastUndoableAssetId).toBeNull();
    expect(reset.sourceAssetId).toBe(d1.asset.id);
    expect(reset.editHistoryJson).toEqual([]);

    // Asset cleanup yapılmadı — out1 ve out2 hâlâ DB'de (carry-forward)
    const out1Still = await db.asset.findUnique({ where: { id: out1.id } });
    const out2Still = await db.asset.findUnique({ where: { id: out2.id } });
    expect(out1Still).not.toBeNull();
    expect(out2Still).not.toBeNull();
  });

  it("ready set → SetReadOnlyError", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "RRO" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "rro",
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
      resetItem({
        userId: userAId,
        setId: set.id,
        itemId: created[0]!.id,
      }),
    ).rejects.toThrow(SetReadOnlyError);
  });
});

// ────────────────────────────────────────────────────────────
// applyEditAsync (heavy op stub)
// ────────────────────────────────────────────────────────────

describe("Phase 7 edit — applyEditAsync (heavy op enqueue stub)", () => {
  it("background-remove → { jobId } stub döner", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "Async" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "as",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });

    const result = await applyEditAsync({
      userId: userAId,
      setId: set.id,
      itemId: created[0]!.id,
      op: { op: "background-remove" },
    });

    expect(result.jobId).toBeTypeOf("string");
    expect(result.jobId.length).toBeGreaterThan(0);
  });

  it("instant op (crop) applyEditAsync'ten reject", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "WrongAsync" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "wa",
    });
    const created = await addItems({
      userId: userAId,
      setId: set.id,
      items: [{ generatedDesignId: d1.design.id }],
    });

    await expect(
      applyEditAsync({
        userId: userAId,
        setId: set.id,
        itemId: created[0]!.id,
        // Tip sözleşmesini bypass etmek için cast — runtime guard test'i
        op: { op: "crop", params: { ratio: "2:3" } } as never,
      }),
    ).rejects.toThrow();
  });

  it("ready set → SetReadOnlyError", async () => {
    const { productType, reference } = await ensureBase(userAId);
    const set = await createSet({ userId: userAId, name: "AsyncRO" });
    const d1 = await createDesign({
      userId: userAId,
      productTypeId: productType.id,
      referenceId: reference.id,
      tag: "asro",
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
      applyEditAsync({
        userId: userAId,
        setId: set.id,
        itemId: created[0]!.id,
        op: { op: "background-remove" },
      }),
    ).rejects.toThrow(SetReadOnlyError);
  });
});
