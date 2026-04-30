// Phase 7 Task 4 — State machine guard'ları + finalize transaction
// integration testleri.
//
// Sözleşmeler (design Section 4.3 + 2.5 + 4.4, plan Task 4):
//   - assertSetMutable(set):
//       draft → pass (no-op)
//       ready → SetReadOnlyError
//       archived → SetReadOnlyError
//   - assertCanFinalize(set, items):
//       set.status !== draft → SetReadOnlyError (gate'ten önce)
//       selected count < 1 → FinalizeGateError
//       selected count >= 1 → pass (no-op)
//   - assertCanArchive(set):
//       draft, ready → pass
//       archived → InvalidStateTransitionError
//   - finalizeSet({ userId, setId }):
//       cross-user / yok → NotFoundError (Task 17 helper)
//       gate fail (0 selected) → FinalizeGateError, DB'de değişiklik yok (rollback)
//       gate pass (>=1 selected) → status `ready`, finalizedAt set edilir
//       pending item'lar finalize sonrası status'larını korur (donar — Section 4.3)
//   - archiveSet refactor regression: Task 3 archiveSet testleri PASS olmalı
//     (archived → archived artık InvalidStateTransitionError fırlatır;
//     davranış aynı: throw — sadece error class'ı specifically check edilirse
//     test güncellemesi gerekir; Task 3 test'i `.rejects.toThrow()` generic
//     matcher kullandığı için regression yok).

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import {
  NotFoundError,
  SetReadOnlyError,
  FinalizeGateError,
  InvalidStateTransitionError,
} from "@/lib/errors";
import {
  assertSetMutable,
  assertCanFinalize,
  assertCanArchive,
  finalizeSet,
} from "@/server/services/selection/state";
import { createSet } from "@/server/services/selection/sets.service";

const PRODUCT_TYPE_KEY = "phase7-state-pt";
const REFERENCE_ASSET_ID = "phase7-state-ref-asset";
const REFERENCE_ID = "phase7-state-ref";
const DESIGN_ASSET_ID = "phase7-state-design-asset";
const DESIGN_ID = "phase7-state-design";

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
      displayName: "Phase7 State Wall Art",
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
      storageKey: "phase7-state/ref.png",
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: "phase7-state-ref-hash",
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
    where: { id: DESIGN_ASSET_ID },
    update: {},
    create: {
      id: DESIGN_ASSET_ID,
      userId,
      storageProvider: "local",
      storageKey: "phase7-state/design.png",
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: "phase7-state-design-hash",
    },
  });

  const design = await db.generatedDesign.upsert({
    where: { id: DESIGN_ID },
    update: {},
    create: {
      id: DESIGN_ID,
      userId,
      referenceId: reference.id,
      assetId: designAsset.id,
      productTypeId: productType.id,
    },
  });

  return { productType, refAsset, reference, designAsset, design };
}

async function cleanupSelections() {
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: [userAId, userBId] } } },
  });
  await db.selectionSet.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
}

async function seedItem(args: {
  setId: string;
  designId: string;
  assetId: string;
  position: number;
  status?: "pending" | "selected" | "rejected";
}) {
  return db.selectionItem.create({
    data: {
      selectionSetId: args.setId,
      generatedDesignId: args.designId,
      sourceAssetId: args.assetId,
      position: args.position,
      status: args.status ?? "pending",
    },
  });
}

beforeAll(async () => {
  const a = await ensureUser("phase7-state-a@etsyhub.local");
  const b = await ensureUser("phase7-state-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;
});

beforeEach(async () => {
  await cleanupSelections();
});

afterAll(async () => {
  await cleanupSelections();
});

// ────────────────────────────────────────────────────────────
// assertSetMutable
// ────────────────────────────────────────────────────────────

describe("Phase 7 state — assertSetMutable", () => {
  it("draft set: pass (no-op)", async () => {
    const set = await createSet({ userId: userAId, name: "Draft" });
    expect(() => assertSetMutable(set)).not.toThrow();
  });

  it("ready set: SetReadOnlyError", async () => {
    const draft = await createSet({ userId: userAId, name: "Ready" });
    const ready = await db.selectionSet.update({
      where: { id: draft.id },
      data: { status: "ready", finalizedAt: new Date() },
    });
    expect(() => assertSetMutable(ready)).toThrow(SetReadOnlyError);
  });

  it("archived set: SetReadOnlyError", async () => {
    const draft = await createSet({ userId: userAId, name: "Archived" });
    const archived = await db.selectionSet.update({
      where: { id: draft.id },
      data: { status: "archived", archivedAt: new Date() },
    });
    expect(() => assertSetMutable(archived)).toThrow(SetReadOnlyError);
  });
});

// ────────────────────────────────────────────────────────────
// assertCanFinalize
// ────────────────────────────────────────────────────────────

describe("Phase 7 state — assertCanFinalize", () => {
  it("ready set: SetReadOnlyError (gate'ten önce — read-only önce kontrol edilir)", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const draft = await createSet({ userId: userAId, name: "Already Ready" });
    const ready = await db.selectionSet.update({
      where: { id: draft.id },
      data: { status: "ready", finalizedAt: new Date() },
    });
    const items = [
      await seedItem({
        setId: ready.id,
        designId: design.id,
        assetId: designAsset.id,
        position: 0,
        status: "selected",
      }),
    ];
    expect(() => assertCanFinalize(ready, items)).toThrow(SetReadOnlyError);
  });

  it("0 selected (hepsi pending): FinalizeGateError", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const set = await createSet({ userId: userAId, name: "All Pending" });
    const items = [
      await seedItem({
        setId: set.id,
        designId: design.id,
        assetId: designAsset.id,
        position: 0,
        status: "pending",
      }),
      await seedItem({
        setId: set.id,
        designId: design.id,
        assetId: designAsset.id,
        position: 1,
        status: "pending",
      }),
    ];
    expect(() => assertCanFinalize(set, items)).toThrow(FinalizeGateError);
  });

  it("0 selected (hepsi rejected): FinalizeGateError — rejected sayılmaz", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const set = await createSet({ userId: userAId, name: "All Rejected" });
    const items = [
      await seedItem({
        setId: set.id,
        designId: design.id,
        assetId: designAsset.id,
        position: 0,
        status: "rejected",
      }),
    ];
    expect(() => assertCanFinalize(set, items)).toThrow(FinalizeGateError);
  });

  it("0 item (boş set): FinalizeGateError", async () => {
    const set = await createSet({ userId: userAId, name: "Empty" });
    expect(() => assertCanFinalize(set, [])).toThrow(FinalizeGateError);
  });

  it("1 selected (yanında pending+rejected): pass (no-op)", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const set = await createSet({ userId: userAId, name: "1 Selected" });
    const items = [
      await seedItem({
        setId: set.id,
        designId: design.id,
        assetId: designAsset.id,
        position: 0,
        status: "selected",
      }),
      await seedItem({
        setId: set.id,
        designId: design.id,
        assetId: designAsset.id,
        position: 1,
        status: "pending",
      }),
      await seedItem({
        setId: set.id,
        designId: design.id,
        assetId: designAsset.id,
        position: 2,
        status: "rejected",
      }),
    ];
    expect(() => assertCanFinalize(set, items)).not.toThrow();
  });

  it("3 selected: pass", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const set = await createSet({ userId: userAId, name: "3 Selected" });
    const items = [
      await seedItem({
        setId: set.id,
        designId: design.id,
        assetId: designAsset.id,
        position: 0,
        status: "selected",
      }),
      await seedItem({
        setId: set.id,
        designId: design.id,
        assetId: designAsset.id,
        position: 1,
        status: "selected",
      }),
      await seedItem({
        setId: set.id,
        designId: design.id,
        assetId: designAsset.id,
        position: 2,
        status: "selected",
      }),
    ];
    expect(() => assertCanFinalize(set, items)).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────
// assertCanArchive
// ────────────────────────────────────────────────────────────

describe("Phase 7 state — assertCanArchive", () => {
  it("draft: pass", async () => {
    const set = await createSet({ userId: userAId, name: "Draft" });
    expect(() => assertCanArchive(set)).not.toThrow();
  });

  it("ready: pass", async () => {
    const draft = await createSet({ userId: userAId, name: "Ready" });
    const ready = await db.selectionSet.update({
      where: { id: draft.id },
      data: { status: "ready", finalizedAt: new Date() },
    });
    expect(() => assertCanArchive(ready)).not.toThrow();
  });

  it("archived: InvalidStateTransitionError", async () => {
    const draft = await createSet({ userId: userAId, name: "Archived" });
    const archived = await db.selectionSet.update({
      where: { id: draft.id },
      data: { status: "archived", archivedAt: new Date() },
    });
    expect(() => assertCanArchive(archived)).toThrow(
      InvalidStateTransitionError,
    );
  });
});

// ────────────────────────────────────────────────────────────
// finalizeSet — transaction
// ────────────────────────────────────────────────────────────

describe("Phase 7 state — finalizeSet", () => {
  it("gate pass + transaction: status ready, finalizedAt set", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const set = await createSet({ userId: userAId, name: "Ready For Finalize" });
    await seedItem({
      setId: set.id,
      designId: design.id,
      assetId: designAsset.id,
      position: 0,
      status: "selected",
    });

    const before = Date.now();
    const result = await finalizeSet({ userId: userAId, setId: set.id });

    expect(result.status).toBe("ready");
    expect(result.finalizedAt).toBeInstanceOf(Date);
    expect(result.finalizedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);

    // DB doğrulaması
    const fresh = await db.selectionSet.findUnique({ where: { id: set.id } });
    expect(fresh?.status).toBe("ready");
    expect(fresh?.finalizedAt).toBeInstanceOf(Date);
  });

  it("gate fail (0 selected): FinalizeGateError, status değişmez (rollback)", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const set = await createSet({ userId: userAId, name: "No Selected" });
    await seedItem({
      setId: set.id,
      designId: design.id,
      assetId: designAsset.id,
      position: 0,
      status: "pending",
    });

    await expect(
      finalizeSet({ userId: userAId, setId: set.id }),
    ).rejects.toThrow(FinalizeGateError);

    // Hiçbir alan değişmemeli
    const fresh = await db.selectionSet.findUnique({ where: { id: set.id } });
    expect(fresh?.status).toBe("draft");
    expect(fresh?.finalizedAt).toBeNull();
  });

  it("gate fail (boş set): FinalizeGateError, status değişmez", async () => {
    const set = await createSet({ userId: userAId, name: "Empty Set" });

    await expect(
      finalizeSet({ userId: userAId, setId: set.id }),
    ).rejects.toThrow(FinalizeGateError);

    const fresh = await db.selectionSet.findUnique({ where: { id: set.id } });
    expect(fresh?.status).toBe("draft");
    expect(fresh?.finalizedAt).toBeNull();
  });

  it("zaten ready set'i tekrar finalize: SetReadOnlyError, status değişmez", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const draft = await createSet({ userId: userAId, name: "Already Ready" });
    await seedItem({
      setId: draft.id,
      designId: design.id,
      assetId: designAsset.id,
      position: 0,
      status: "selected",
    });
    const finalizedAt = new Date(Date.now() - 60_000);
    await db.selectionSet.update({
      where: { id: draft.id },
      data: { status: "ready", finalizedAt },
    });

    await expect(
      finalizeSet({ userId: userAId, setId: draft.id }),
    ).rejects.toThrow(SetReadOnlyError);

    // finalizedAt değişmemiş olmalı
    const fresh = await db.selectionSet.findUnique({ where: { id: draft.id } });
    expect(fresh?.status).toBe("ready");
    expect(fresh?.finalizedAt?.getTime()).toBe(finalizedAt.getTime());
  });

  it("cross-user → NotFoundError", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const set = await createSet({ userId: userAId, name: "A's Set" });
    await seedItem({
      setId: set.id,
      designId: design.id,
      assetId: designAsset.id,
      position: 0,
      status: "selected",
    });

    await expect(
      finalizeSet({ userId: userBId, setId: set.id }),
    ).rejects.toThrow(NotFoundError);

    // A'nın set'i değişmemiş olmalı
    const fresh = await db.selectionSet.findUnique({ where: { id: set.id } });
    expect(fresh?.status).toBe("draft");
    expect(fresh?.finalizedAt).toBeNull();
  });

  it("olmayan setId → NotFoundError", async () => {
    await expect(
      finalizeSet({ userId: userAId, setId: "phase7-state-nonexistent" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("pending item'lar finalize sonrası status'larını korur (donar — Section 4.3)", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const set = await createSet({ userId: userAId, name: "Mixed Statuses" });
    const selectedItem = await seedItem({
      setId: set.id,
      designId: design.id,
      assetId: designAsset.id,
      position: 0,
      status: "selected",
    });
    const pendingItem = await seedItem({
      setId: set.id,
      designId: design.id,
      assetId: designAsset.id,
      position: 1,
      status: "pending",
    });
    const rejectedItem = await seedItem({
      setId: set.id,
      designId: design.id,
      assetId: designAsset.id,
      position: 2,
      status: "rejected",
    });

    await finalizeSet({ userId: userAId, setId: set.id });

    const items = await db.selectionItem.findMany({
      where: { selectionSetId: set.id },
      orderBy: { position: "asc" },
    });
    const byId = new Map(items.map((i) => [i.id, i]));

    expect(byId.get(selectedItem.id)?.status).toBe("selected");
    // KRİTİK: pending donar (otomatik selected/rejected'a çevrilmez)
    expect(byId.get(pendingItem.id)?.status).toBe("pending");
    expect(byId.get(rejectedItem.id)?.status).toBe("rejected");
  });
});
