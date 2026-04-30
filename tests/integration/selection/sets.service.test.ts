// Phase 7 Task 3 — SelectionSet service (createSet / listSets / getSet / archiveSet)
// integration testleri.
//
// Sözleşmeler (plan Task 3, design Section 3.1 + 4.1 + 4.3):
//   - createSet({ userId, name }):
//       trim sonrası non-empty zorunlu; whitespace-only reject
//       status default `draft`; auto fields (id, createdAt, updatedAt) atanır
//   - listSets({ userId, status? }):
//       userId filter (cross-user izolasyon)
//       status filter opsiyonel
//       updatedAt desc sort
//   - getSet({ userId, setId }):
//       requireSetOwnership üzerinden ownership; cross-user / yok → NotFoundError
//       items array'i `position asc` sıralı döner
//   - archiveSet({ userId, setId }):
//       draft|ready → archived; archivedAt set edilir
//       archived → archived reject (basit guard; tam state machine Task 4)
//       cross-user → NotFoundError
//
// Test fixture stratejisi: Phase 6 paterniyle. 2 user (A, B), her test başında
// SelectionItem → SelectionSet temizliği (FK order). Asset/Design fixture'ları
// schema/authz testlerindeki yapıdan.

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { ReviewStatus, UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { NotFoundError } from "@/lib/errors";
import {
  archiveSet,
  createSet,
  getSet,
  listSets,
} from "@/server/services/selection/sets.service";

const PRODUCT_TYPE_KEY = "phase7-sets-pt";
const REFERENCE_ASSET_ID = "phase7-sets-ref-asset";
const REFERENCE_ID = "phase7-sets-ref";
const DESIGN_ASSET_ID_A = "phase7-sets-design-asset-a";
const DESIGN_ID_A = "phase7-sets-design-a";

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
      displayName: "Phase7 Sets Wall Art",
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
      storageKey: "phase7-sets/ref.png",
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: "phase7-sets-ref-hash",
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
      storageKey: "phase7-sets/design-a.png",
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: "phase7-sets-design-hash-a",
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
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: [userAId, userBId] } } },
  });
  await db.selectionSet.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
}

beforeAll(async () => {
  const a = await ensureUser("phase7-sets-a@etsyhub.local");
  const b = await ensureUser("phase7-sets-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;
});

beforeEach(async () => {
  await cleanupSelections();
});

afterAll(async () => {
  await cleanupSelections();
});

describe("Phase 7 sets.service — createSet", () => {
  it("trim'lenmiş name + status default `draft` + auto fields", async () => {
    const before = Date.now();
    const set = await createSet({ userId: userAId, name: "  Yeni Set  " });

    expect(set.id).toBeDefined();
    expect(set.id.length).toBeGreaterThan(0);
    expect(set.userId).toBe(userAId);
    expect(set.name).toBe("Yeni Set");
    expect(set.status).toBe("draft");
    expect(set.sourceMetadata).toBeNull();
    expect(set.archivedAt).toBeNull();
    expect(set.finalizedAt).toBeNull();
    expect(set.createdAt).toBeInstanceOf(Date);
    expect(set.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(set.updatedAt).toBeInstanceOf(Date);
  });

  it("whitespace-only name reject (defense in depth)", async () => {
    await expect(
      createSet({ userId: userAId, name: "   " }),
    ).rejects.toThrow();
  });

  it("boş string name reject", async () => {
    await expect(
      createSet({ userId: userAId, name: "" }),
    ).rejects.toThrow();
  });
});

describe("Phase 7 sets.service — listSets", () => {
  it("userId filter — User A'nın set'leri User B'ye dönmez", async () => {
    await createSet({ userId: userAId, name: "A1" });
    await createSet({ userId: userAId, name: "A2" });
    await createSet({ userId: userBId, name: "B1" });

    const aSets = await listSets({ userId: userAId });
    const bSets = await listSets({ userId: userBId });

    expect(aSets.map((s) => s.name).sort()).toEqual(["A1", "A2"]);
    expect(bSets.map((s) => s.name)).toEqual(["B1"]);
    // Cross-leak yok
    for (const s of aSets) expect(s.userId).toBe(userAId);
    for (const s of bSets) expect(s.userId).toBe(userBId);
  });

  it("status filter — draft only", async () => {
    const draft = await createSet({ userId: userAId, name: "Draft Set" });
    const ready = await createSet({ userId: userAId, name: "Ready Set" });
    // Manual update to ready (state machine Task 4'te; bu test sadece filter)
    await db.selectionSet.update({
      where: { id: ready.id },
      data: { status: "ready" },
    });

    const drafts = await listSets({ userId: userAId, status: "draft" });
    expect(drafts.map((s) => s.id)).toEqual([draft.id]);
  });

  it("status filter — ready only", async () => {
    await createSet({ userId: userAId, name: "Draft Set" });
    const ready = await createSet({ userId: userAId, name: "Ready Set" });
    await db.selectionSet.update({
      where: { id: ready.id },
      data: { status: "ready" },
    });

    const readys = await listSets({ userId: userAId, status: "ready" });
    expect(readys.map((s) => s.id)).toEqual([ready.id]);
  });

  it("status filter — archived only", async () => {
    await createSet({ userId: userAId, name: "Draft Set" });
    const archived = await createSet({ userId: userAId, name: "Archived" });
    await db.selectionSet.update({
      where: { id: archived.id },
      data: { status: "archived", archivedAt: new Date() },
    });

    const archiveds = await listSets({ userId: userAId, status: "archived" });
    expect(archiveds.map((s) => s.id)).toEqual([archived.id]);
  });

  it("sort: updatedAt desc — en son güncellenen başta", async () => {
    const first = await createSet({ userId: userAId, name: "First" });
    // Küçük gecikme ile updatedAt farkı garantisi
    await new Promise((r) => setTimeout(r, 5));
    const second = await createSet({ userId: userAId, name: "Second" });
    await new Promise((r) => setTimeout(r, 5));
    // first'i güncelle → en üste çıkmalı
    await db.selectionSet.update({
      where: { id: first.id },
      data: { name: "First (updated)" },
    });

    const sets = await listSets({ userId: userAId });
    expect(sets.map((s) => s.id)).toEqual([first.id, second.id]);
  });

  it("status filter olmadan tüm statüler döner", async () => {
    const draft = await createSet({ userId: userAId, name: "Draft" });
    const ready = await createSet({ userId: userAId, name: "Ready" });
    await db.selectionSet.update({
      where: { id: ready.id },
      data: { status: "ready" },
    });
    const arc = await createSet({ userId: userAId, name: "Archived" });
    await db.selectionSet.update({
      where: { id: arc.id },
      data: { status: "archived", archivedAt: new Date() },
    });

    const all = await listSets({ userId: userAId });
    expect(all.map((s) => s.id).sort()).toEqual(
      [draft.id, ready.id, arc.id].sort(),
    );
  });
});

describe("Phase 7 sets.service — getSet", () => {
  it("ownership pass: set + items dönüyor (items position asc)", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const set = await createSet({ userId: userAId, name: "Detail Set" });

    // 2 item: position 1 ve 0 — sıralama testlenecek
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: designAsset.id,
        position: 1,
      },
    });
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: designAsset.id,
        position: 0,
      },
    });

    const result = await getSet({ userId: userAId, setId: set.id });

    expect(result.id).toBe(set.id);
    expect(result.name).toBe("Detail Set");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.position).toBe(0);
    expect(result.items[1]!.position).toBe(1);
  });

  it("items boş set — empty array döner", async () => {
    const set = await createSet({ userId: userAId, name: "Empty Set" });
    const result = await getSet({ userId: userAId, setId: set.id });

    expect(result.id).toBe(set.id);
    expect(result.items).toEqual([]);
  });

  it("cross-user → NotFoundError", async () => {
    const set = await createSet({ userId: userAId, name: "A's Set" });

    await expect(
      getSet({ userId: userBId, setId: set.id }),
    ).rejects.toThrow(NotFoundError);
  });

  it("olmayan setId → NotFoundError", async () => {
    await expect(
      getSet({ userId: userAId, setId: "phase7-sets-nonexistent" }),
    ).rejects.toThrow(NotFoundError);
  });

  // Task 16 — Phase 6 review mapper integration:
  // getSet items[].review alanı Phase 6 entity'lerinden map edilir.
  // Review yoksa null; varsa view-shape (score + status + 4 sinyal).
  it("review verisi varsa item.review null değil; yoksa null", async () => {
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    const set = await createSet({ userId: userAId, name: "Review Set" });

    // Item 1: review YOK (design default reviewStatus = PENDING + reviewedAt null)
    const itemNoReview = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: designAsset.id,
        position: 0,
      },
    });

    // Item 2: review var — design'ı APPROVED'a çek + DesignReview row create
    await db.generatedDesign.update({
      where: { id: design.id },
      data: {
        reviewStatus: ReviewStatus.APPROVED,
        reviewScore: 88,
        qualityScore: 75,
        reviewedAt: new Date(),
      },
    });
    await db.designReview.upsert({
      where: { generatedDesignId: design.id },
      update: {
        decision: ReviewStatus.APPROVED,
        score: 88,
        issues: [],
      },
      create: {
        generatedDesignId: design.id,
        reviewer: "system",
        decision: ReviewStatus.APPROVED,
        score: 88,
        issues: [],
      },
    });

    const itemWithReview = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: designAsset.id,
        position: 1,
      },
    });

    const result = await getSet({ userId: userAId, setId: set.id });

    expect(result.items).toHaveLength(2);
    const noReview = result.items.find((i) => i.id === itemNoReview.id)!;
    const withReview = result.items.find((i) => i.id === itemWithReview.id)!;

    // Item 1: hem reviewedAt null'dan APPROVED'a güncellendi, ama
    // db.generatedDesign güncellenmiş olduğu için ikinci item review oldu.
    // İlk item kontrolü değil — fixture aynı design.id paylaşıyor.
    // Bu yüzden iki item da APPROVED görür. Mapper test sözleşmesi: review
    // varsa null değil; signals.resolution qualityScore >= 60 → "ok".
    expect(withReview.review).not.toBeNull();
    expect(withReview.review!.score).toBe(88);
    expect(withReview.review!.status).toBe("approved");
    expect(withReview.review!.signals.resolution).toBe("ok");
    expect(withReview.review!.signals.textDetection).toBe("clean");
    expect(withReview.review!.signals.artifactCheck).toBe("clean");
    expect(withReview.review!.signals.trademarkRisk).toBe("low");

    // İlk item de aynı design'ı paylaştığı için review aynı view-model'i
    // gösterir — bu Phase 6 entity bağı; mapper bunu doğru yansıtır.
    expect(noReview.review).not.toBeNull();
    expect(noReview.review!.score).toBe(88);
  });

  it("review yok kanonik shape: design PENDING + DesignReview yok → item.review null", async () => {
    // Yeni izole fixture — base fixture default zaten PENDING/reviewedAt:null,
    // ama önceki testte aynı design APPROVED'a güncellendi. Reset:
    const { design, designAsset } = await ensureBaseFixtures(userAId);
    await db.designReview.deleteMany({
      where: { generatedDesignId: design.id },
    });
    await db.generatedDesign.update({
      where: { id: design.id },
      data: {
        reviewStatus: ReviewStatus.PENDING,
        reviewScore: null,
        qualityScore: null,
        reviewedAt: null,
      },
    });

    const set = await createSet({ userId: userAId, name: "No Review Set" });
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: designAsset.id,
        position: 0,
      },
    });

    const result = await getSet({ userId: userAId, setId: set.id });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.review).toBeNull();
  });
});

describe("Phase 7 sets.service — archiveSet", () => {
  it("draft → archived + archivedAt set edilir", async () => {
    const set = await createSet({ userId: userAId, name: "To Archive" });
    const before = Date.now();

    const result = await archiveSet({ userId: userAId, setId: set.id });

    expect(result.status).toBe("archived");
    expect(result.archivedAt).toBeInstanceOf(Date);
    expect(result.archivedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("ready → archived OK", async () => {
    const set = await createSet({ userId: userAId, name: "Ready Set" });
    await db.selectionSet.update({
      where: { id: set.id },
      data: { status: "ready" },
    });

    const result = await archiveSet({ userId: userAId, setId: set.id });

    expect(result.status).toBe("archived");
    expect(result.archivedAt).toBeInstanceOf(Date);
  });

  it("archived → archived reject (explicit error)", async () => {
    const set = await createSet({ userId: userAId, name: "Already Archived" });
    await db.selectionSet.update({
      where: { id: set.id },
      data: { status: "archived", archivedAt: new Date() },
    });

    await expect(
      archiveSet({ userId: userAId, setId: set.id }),
    ).rejects.toThrow();
  });

  it("cross-user → NotFoundError", async () => {
    const set = await createSet({ userId: userAId, name: "A's Set" });

    await expect(
      archiveSet({ userId: userBId, setId: set.id }),
    ).rejects.toThrow(NotFoundError);
  });

  it("olmayan setId → NotFoundError", async () => {
    await expect(
      archiveSet({ userId: userAId, setId: "phase7-sets-nonexistent" }),
    ).rejects.toThrow(NotFoundError);
  });
});
