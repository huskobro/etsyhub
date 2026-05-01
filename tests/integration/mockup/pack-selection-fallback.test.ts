// Phase 8 Task 8 — K10 cover-fail fallback (recomputePackOnRenderComplete)
// integration testleri.
//
// Spec §4.6 cover invariant + §4.8 atomic slot swap pattern emsali.
//
// Senaryolar:
//   - cover render success → no-op
//   - cover FAILED + ilk success var → atomic slot swap
//   - cover FAILED + henüz success yok → idempotent wait
//   - tüm renders FAILED → no-op (Task 6 aggregate FAILED'a çekecek)
//   - idempotent: ikinci call no-op
//   - missing job → silent return
//   - coverRenderId null → silent return

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
import bcrypt from "bcryptjs";
import {
  UserRole,
  UserStatus,
  type MockupJob,
  type MockupRenderStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import { recomputePackOnRenderComplete } from "@/features/mockups/server/pack-selection.service";

// ────────────────────────────────────────────────────────────
// Fixture sabitleri (job-lifecycle.test.ts paterni)
// ────────────────────────────────────────────────────────────

const TEST_TPL_PREFIX = "phase8-pack-fallback-";
const PRODUCT_TYPE_KEY = "phase8-pack-fallback-pt";

let userAId: string;

// ────────────────────────────────────────────────────────────
// Fixture helpers
// ────────────────────────────────────────────────────────────

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

async function ensureProductType() {
  return db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "Phase8 PackFallback PT",
      aspectRatio: "2:3",
      isSystem: false,
    },
  });
}

async function makeAsset(userId: string, key: string) {
  return db.asset.create({
    data: {
      userId,
      storageProvider: "local",
      storageKey: key,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `hash-${key}-${Math.random().toString(36).slice(2, 8)}`,
    },
  });
}

async function makeReadySet(userId: string, productTypeId: string) {
  const asset = await makeAsset(userId, `ref-${userId}-${Date.now()}`);
  await db.reference.create({
    data: { userId, assetId: asset.id, productTypeId },
  });
  return db.selectionSet.create({
    data: {
      userId,
      name: "Phase8 PackFallback Set",
      status: "ready",
      finalizedAt: new Date(),
    },
  });
}

async function makeTemplateAndBinding(name: string) {
  const tpl = await db.mockupTemplate.create({
    data: {
      categoryId: "canvas",
      name: `${TEST_TPL_PREFIX}${name}`,
      status: "ACTIVE",
      thumbKey: `thumbs/${name}.png`,
      aspectRatios: ["2:3"],
      tags: ["phase8-test"],
      estimatedRenderMs: 2000,
      bindings: {
        create: {
          providerId: "LOCAL_SHARP",
          status: "ACTIVE",
          config: {
            providerId: "local-sharp",
            baseAssetKey: `${name}/base.png`,
            baseDimensions: { w: 2400, h: 1600 },
            safeArea: { type: "rect", x: 0.3, y: 0.2, w: 0.4, h: 0.5 },
            recipe: { blendMode: "normal" },
            coverPriority: 50,
          },
          estimatedRenderMs: 2000,
        },
      },
    },
    include: { bindings: true },
  });
  return tpl;
}

/**
 * Manuel MockupJob + N MockupRender yaratır + coverRenderId set eder
 * (handoff bypass; fallback testi için minimal kayıt seti).
 *
 * renders[0] cover slot (packPosition=0). renderStatuses sırasıyla
 * uygulanır.
 */
async function makeJobWithCover(args: {
  userId: string;
  renderStatuses: MockupRenderStatus[];
  setCoverRenderId?: boolean;
}): Promise<{
  job: MockupJob;
  renderIds: string[];
}> {
  const productType = await ensureProductType();
  const set = await makeReadySet(args.userId, productType.id);
  const tpl = await makeTemplateAndBinding(
    `tpl-${Math.random().toString(36).slice(2, 8)}`,
  );
  const binding = tpl.bindings[0];
  if (!binding) throw new Error("fixture: binding yok");

  const total = args.renderStatuses.length;

  const job = await db.mockupJob.create({
    data: {
      userId: args.userId,
      setId: set.id,
      setSnapshotId: `snap-${Math.random().toString(36).slice(2, 16)}`,
      categoryId: "canvas",
      status: "RUNNING",
      packSize: 10,
      actualPackSize: total,
      totalRenders: total,
      successRenders: args.renderStatuses.filter((s) => s === "SUCCESS").length,
      failedRenders: args.renderStatuses.filter((s) => s === "FAILED").length,
      startedAt: new Date(),
    },
  });

  const renderIds: string[] = [];
  for (let i = 0; i < args.renderStatuses.length; i++) {
    const status = args.renderStatuses[i]!;
    const render = await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId: `variant-${i}-${Math.random().toString(36).slice(2, 8)}`,
        bindingId: binding.id,
        templateSnapshot: {
          providerId: "LOCAL_SHARP",
          bindingVersion: 1,
          templateName: tpl.name,
          aspectRatios: tpl.aspectRatios,
          config: { baseAssetKey: `${tpl.name}/base.png` },
        },
        packPosition: i,
        selectionReason: i === 0 ? "COVER" : "TEMPLATE_DIVERSITY",
        status,
        outputKey: status === "SUCCESS" ? `out/${i}.png` : null,
        thumbnailKey: status === "SUCCESS" ? `thumb/${i}.png` : null,
        completedAt:
          status === "SUCCESS" || status === "FAILED" ? new Date() : null,
        errorClass: status === "FAILED" ? "PROVIDER_DOWN" : null,
        errorDetail: status === "FAILED" ? "fixture failure" : null,
      },
    });
    renderIds.push(render.id);
  }

  // Cover invariant: renders[0] coverRenderId.
  if (args.setCoverRenderId !== false) {
    await db.mockupJob.update({
      where: { id: job.id },
      data: { coverRenderId: renderIds[0] },
    });
  }

  // Re-fetch for updated coverRenderId.
  const refreshed = await db.mockupJob.findUniqueOrThrow({
    where: { id: job.id },
  });
  return { job: refreshed, renderIds };
}

// ────────────────────────────────────────────────────────────
// Cleanup
// ────────────────────────────────────────────────────────────

async function cleanup() {
  if (!userAId) return;

  await db.mockupRender.deleteMany({
    where: { job: { userId: userAId } },
  });
  await db.mockupJob.deleteMany({ where: { userId: userAId } });
  await db.mockupTemplateBinding.deleteMany({
    where: { template: { name: { startsWith: TEST_TPL_PREFIX } } },
  });
  await db.mockupTemplate.deleteMany({
    where: { name: { startsWith: TEST_TPL_PREFIX } },
  });
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: userAId } },
  });
  await db.selectionSet.deleteMany({ where: { userId: userAId } });
  await db.generatedDesign.deleteMany({ where: { userId: userAId } });
  await db.reference.deleteMany({ where: { userId: userAId } });
  await db.asset.deleteMany({ where: { userId: userAId } });
  await db.productType.deleteMany({ where: { key: PRODUCT_TYPE_KEY } });
}

beforeAll(async () => {
  const a = await ensureUser("phase8-pack-fallback@etsyhub.local");
  userAId = a.id;
});

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe("recomputePackOnRenderComplete (K10 cover-fail fallback)", () => {
  it("cover render SUCCESS: no fallback (no-op)", async () => {
    const { job, renderIds } = await makeJobWithCover({
      userId: userAId,
      renderStatuses: ["SUCCESS", "PENDING", "PENDING"],
    });

    await recomputePackOnRenderComplete(job.id);

    const after = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(after.coverRenderId).toBe(renderIds[0]);

    const cover = await db.mockupRender.findUniqueOrThrow({
      where: { id: renderIds[0]! },
    });
    expect(cover.packPosition).toBe(0);
  });

  it("cover FAILED + first SUCCESS exists: atomic slot swap", async () => {
    // packPosition: 0=FAILED (cover), 1=SUCCESS, 2=PENDING
    const { job, renderIds } = await makeJobWithCover({
      userId: userAId,
      renderStatuses: ["FAILED", "SUCCESS", "PENDING"],
    });

    await recomputePackOnRenderComplete(job.id);

    const after = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    // Yeni cover = renderIds[1] (eski success).
    expect(after.coverRenderId).toBe(renderIds[1]);

    const oldCover = await db.mockupRender.findUniqueOrThrow({
      where: { id: renderIds[0]! },
    });
    // Eski cover packPosition=1 (yeni cover'ın eski slot'u).
    expect(oldCover.packPosition).toBe(1);

    const newCover = await db.mockupRender.findUniqueOrThrow({
      where: { id: renderIds[1]! },
    });
    // Yeni cover packPosition=0.
    expect(newCover.packPosition).toBe(0);

    // Diğer render etkilenmedi.
    const other = await db.mockupRender.findUniqueOrThrow({
      where: { id: renderIds[2]! },
    });
    expect(other.packPosition).toBe(2);
  });

  it("cover FAILED + no SUCCESS yet: idempotent wait", async () => {
    const { job, renderIds } = await makeJobWithCover({
      userId: userAId,
      renderStatuses: ["FAILED", "PENDING", "PENDING"],
    });

    await recomputePackOnRenderComplete(job.id);

    const after = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    // No-op: coverRenderId değişmez, packPosition'lar değişmez.
    expect(after.coverRenderId).toBe(renderIds[0]);

    const cover = await db.mockupRender.findUniqueOrThrow({
      where: { id: renderIds[0]! },
    });
    expect(cover.packPosition).toBe(0);

    // İkinci call (yeni success henüz yok) → hâlâ no-op.
    await recomputePackOnRenderComplete(job.id);
    const after2 = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(after2.coverRenderId).toBe(renderIds[0]);
  });

  it("all renders FAILED: coverRenderId unchanged", async () => {
    const { job, renderIds } = await makeJobWithCover({
      userId: userAId,
      renderStatuses: ["FAILED", "FAILED", "FAILED"],
    });

    await recomputePackOnRenderComplete(job.id);

    const after = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    // coverRenderId değişmez (Task 6 aggregate FAILED'a çekecek).
    expect(after.coverRenderId).toBe(renderIds[0]);

    const cover = await db.mockupRender.findUniqueOrThrow({
      where: { id: renderIds[0]! },
    });
    expect(cover.packPosition).toBe(0);
  });

  it("idempotent: ikinci call swap sonrası no-op", async () => {
    const { job, renderIds } = await makeJobWithCover({
      userId: userAId,
      renderStatuses: ["FAILED", "SUCCESS", "PENDING"],
    });

    // İlk call: swap olur.
    await recomputePackOnRenderComplete(job.id);
    const after1 = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(after1.coverRenderId).toBe(renderIds[1]);

    // İkinci call: yeni cover (eski success) hâlâ SUCCESS → no-op.
    await recomputePackOnRenderComplete(job.id);
    const after2 = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(after2.coverRenderId).toBe(renderIds[1]);

    const newCover = await db.mockupRender.findUniqueOrThrow({
      where: { id: renderIds[1]! },
    });
    expect(newCover.packPosition).toBe(0);
  });

  it("missing job: silent return (no throw)", async () => {
    await expect(
      recomputePackOnRenderComplete("non-existent-job-id"),
    ).resolves.toBeUndefined();
  });

  it("coverRenderId null: silent return (pack creation aşamasında)", async () => {
    const { job, renderIds } = await makeJobWithCover({
      userId: userAId,
      renderStatuses: ["FAILED", "SUCCESS"],
      setCoverRenderId: false,
    });

    expect(job.coverRenderId).toBeNull();

    await recomputePackOnRenderComplete(job.id);

    const after = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(after.coverRenderId).toBeNull();

    // packPosition'lar değişmedi.
    const r0 = await db.mockupRender.findUniqueOrThrow({
      where: { id: renderIds[0]! },
    });
    expect(r0.packPosition).toBe(0);
  });
});
