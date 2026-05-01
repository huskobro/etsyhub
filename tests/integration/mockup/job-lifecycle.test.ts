// Phase 8 Task 6 — MockupJob state machine + cancelJob entegrasyon testleri.
//
// Spec §2.3:
//   Job: queued → running → (completed | partial_complete | failed | cancelled)
//   Render: pending → rendering → (success | failed)
//
// recomputeJobStatus aggregate roll-up + cancelJob terminal-lock + cross-user 404.
// Phase 7 emsali: tests/integration/mockup/handoff.test.ts (fixture pattern).

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
  type MockupJobStatus,
  type MockupRenderStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import {
  recomputeJobStatus,
  cancelJob,
  isJobTerminal,
  isRenderTerminal,
  JobNotFoundError,
  JobAlreadyTerminalError,
} from "@/features/mockups/server/job.service";

// ────────────────────────────────────────────────────────────
// Fixture sabitleri (handoff.test.ts paterni)
// ────────────────────────────────────────────────────────────

const TEST_TPL_PREFIX = "phase8-job-lifecycle-";
const PRODUCT_TYPE_KEY = "phase8-job-lifecycle-pt";

let userAId: string;
let userBId: string;

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
      displayName: "Phase8 JobLifecycle PT",
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
  const reference = await db.reference.create({
    data: { userId, assetId: asset.id, productTypeId },
  });
  const set = await db.selectionSet.create({
    data: {
      userId,
      name: "Phase8 JobLifecycle Set",
      status: "ready",
      finalizedAt: new Date(),
    },
  });
  // 1 minimal item — handoff path test'inin scope'u dışı; lifecycle testleri
  // sadece job + render row'larını manuel yaratır, handoff geçirmez.
  return { set, reference };
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
 * Manuel MockupJob + N MockupRender yaratır. Handoff'u bypass eder; sadece
 * state machine'i test etmek için minimal kayıt seti.
 */
async function makeJobWithRenders(args: {
  userId: string;
  jobStatus: MockupJobStatus;
  renderStatuses: MockupRenderStatus[];
  startedAt?: Date | null;
}): Promise<MockupJob> {
  const productType = await ensureProductType();
  const { set } = await makeReadySet(args.userId, productType.id);
  const tpl = await makeTemplateAndBinding(
    `tpl-${Math.random().toString(36).slice(2, 8)}`,
  );
  const binding = tpl.bindings[0];
  if (!binding) throw new Error("fixture: binding yok");

  // Variant olarak bir SelectionItem yaratmıyoruz; render.variantId
  // string FK değil — schema'da relation yok (sadece kolon). Bu yüzden
  // herhangi bir cuid kullanabiliriz.
  const total = args.renderStatuses.length;

  const job = await db.mockupJob.create({
    data: {
      userId: args.userId,
      setId: set.id,
      setSnapshotId: `snap-${Math.random().toString(36).slice(2, 16)}`,
      categoryId: "canvas",
      status: args.jobStatus,
      packSize: 10,
      actualPackSize: total,
      totalRenders: total,
      successRenders: args.renderStatuses.filter((s) => s === "SUCCESS").length,
      failedRenders: args.renderStatuses.filter((s) => s === "FAILED").length,
      startedAt: args.startedAt ?? null,
    },
  });

  for (let i = 0; i < args.renderStatuses.length; i++) {
    const status = args.renderStatuses[i]!;
    await db.mockupRender.create({
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
      },
    });
  }

  return job;
}

// ────────────────────────────────────────────────────────────
// Cleanup
// ────────────────────────────────────────────────────────────

async function cleanup() {
  const userIds = [userAId, userBId].filter(Boolean);
  if (userIds.length === 0) return;

  await db.mockupRender.deleteMany({
    where: { job: { userId: { in: userIds } } },
  });
  await db.mockupJob.deleteMany({ where: { userId: { in: userIds } } });
  await db.mockupTemplateBinding.deleteMany({
    where: { template: { name: { startsWith: TEST_TPL_PREFIX } } },
  });
  await db.mockupTemplate.deleteMany({
    where: { name: { startsWith: TEST_TPL_PREFIX } },
  });
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: userIds } } },
  });
  await db.selectionSet.deleteMany({ where: { userId: { in: userIds } } });
  await db.generatedDesign.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.reference.deleteMany({ where: { userId: { in: userIds } } });
  await db.asset.deleteMany({ where: { userId: { in: userIds } } });
  await db.productType.deleteMany({ where: { key: PRODUCT_TYPE_KEY } });
}

beforeAll(async () => {
  const a = await ensureUser("phase8-joblifecycle-a@etsyhub.local");
  const b = await ensureUser("phase8-joblifecycle-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;
});

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

// ────────────────────────────────────────────────────────────
// Tests — recomputeJobStatus
// ────────────────────────────────────────────────────────────

describe("MockupJob state machine — recomputeJobStatus", () => {
  it("all SUCCESS → COMPLETED + completedAt set + counters", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "QUEUED",
      renderStatuses: ["SUCCESS", "SUCCESS", "SUCCESS"],
    });

    const next = await recomputeJobStatus(job.id);
    expect(next).toBe("COMPLETED");

    const after = await db.mockupJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.status).toBe("COMPLETED");
    expect(after.successRenders).toBe(3);
    expect(after.failedRenders).toBe(0);
    expect(after.completedAt).toBeInstanceOf(Date);
  });

  it("mix SUCCESS + FAILED → PARTIAL_COMPLETE", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "RUNNING",
      renderStatuses: ["SUCCESS", "SUCCESS", "FAILED"],
      startedAt: new Date(),
    });

    const next = await recomputeJobStatus(job.id);
    expect(next).toBe("PARTIAL_COMPLETE");

    const after = await db.mockupJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.successRenders).toBe(2);
    expect(after.failedRenders).toBe(1);
    expect(after.completedAt).toBeInstanceOf(Date);
  });

  it("all FAILED → FAILED", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "RUNNING",
      renderStatuses: ["FAILED", "FAILED", "FAILED"],
      startedAt: new Date(),
    });

    const next = await recomputeJobStatus(job.id);
    expect(next).toBe("FAILED");

    const after = await db.mockupJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.successRenders).toBe(0);
    expect(after.failedRenders).toBe(3);
    expect(after.completedAt).toBeInstanceOf(Date);
  });

  it("QUEUED → RUNNING when first render leaves PENDING", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "QUEUED",
      renderStatuses: ["RENDERING", "PENDING", "PENDING"],
    });

    const next = await recomputeJobStatus(job.id);
    expect(next).toBe("RUNNING");

    const after = await db.mockupJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.status).toBe("RUNNING");
    expect(after.startedAt).toBeInstanceOf(Date);
    expect(after.completedAt).toBeNull();
  });

  it("RUNNING → terminal when all renders terminal (PARTIAL_COMPLETE example)", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "RUNNING",
      renderStatuses: ["SUCCESS", "FAILED", "SUCCESS"],
      startedAt: new Date(),
    });

    const next = await recomputeJobStatus(job.id);
    expect(next).toBe("PARTIAL_COMPLETE");

    const after = await db.mockupJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.successRenders).toBe(2);
    expect(after.failedRenders).toBe(1);
  });

  it("CANCELLED job remains CANCELLED (terminal lock — recompute no-op)", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "CANCELLED",
      renderStatuses: ["SUCCESS", "FAILED"],
      startedAt: new Date(),
    });
    const before = await db.mockupJob.findUniqueOrThrow({ where: { id: job.id } });

    const next = await recomputeJobStatus(job.id);
    expect(next).toBe("CANCELLED");

    const after = await db.mockupJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.status).toBe("CANCELLED");
    // Counter'lar dokunulmamalı (recompute no-op)
    expect(after.successRenders).toBe(before.successRenders);
    expect(after.failedRenders).toBe(before.failedRenders);
  });

  it("idempotent: aynı state'te ikinci recompute updatedAt değiştirmez", async () => {
    // Tüm render'lar SUCCESS — ilk çağrı COMPLETED'a yazar; ikinci çağrı no-op.
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "QUEUED",
      renderStatuses: ["SUCCESS", "SUCCESS"],
    });

    await recomputeJobStatus(job.id);
    const afterFirst = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });

    // 2. çağrı: aynı state, no-op olmalı — completedAt değişmez.
    await recomputeJobStatus(job.id);
    const afterSecond = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });

    expect(afterSecond.status).toBe("COMPLETED");
    expect(afterSecond.completedAt?.getTime()).toBe(
      afterFirst.completedAt?.getTime(),
    );
  });

  it("QUEUED + tüm render PENDING → status korunur (transition yok)", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "QUEUED",
      renderStatuses: ["PENDING", "PENDING"],
    });

    const next = await recomputeJobStatus(job.id);
    expect(next).toBe("QUEUED");

    const after = await db.mockupJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.status).toBe("QUEUED");
    expect(after.startedAt).toBeNull();
  });

  it("404 — job yoksa JobNotFoundError", async () => {
    await expect(recomputeJobStatus("does-not-exist-cuid")).rejects.toThrow(
      JobNotFoundError,
    );
  });
});

// ────────────────────────────────────────────────────────────
// Tests — cancelJob
// ────────────────────────────────────────────────────────────

describe("MockupJob state machine — cancelJob", () => {
  it("cancels QUEUED job: pending render'lar FAILED, status CANCELLED", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "QUEUED",
      renderStatuses: ["PENDING", "PENDING", "PENDING"],
    });

    await cancelJob(job.id, userAId);

    const after = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
      include: { renders: true },
    });
    expect(after.status).toBe("CANCELLED");
    expect(after.completedAt).toBeInstanceOf(Date);

    for (const render of after.renders) {
      expect(render.status).toBe("FAILED");
      expect(render.errorClass).toBeNull();
      expect(render.errorDetail).toContain("iptal");
    }
  });

  it("cancels RUNNING job: rendering + pending render'lar FAILED", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "RUNNING",
      renderStatuses: ["RENDERING", "PENDING", "PENDING"],
      startedAt: new Date(),
    });

    await cancelJob(job.id, userAId);

    const after = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
      include: { renders: true },
    });
    expect(after.status).toBe("CANCELLED");
    for (const render of after.renders) {
      expect(render.status).toBe("FAILED");
      expect(render.errorClass).toBeNull();
    }
  });

  it("preserves SUCCESS renders during cancel (output korunur)", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "RUNNING",
      renderStatuses: ["SUCCESS", "PENDING", "PENDING"],
      startedAt: new Date(),
    });

    await cancelJob(job.id, userAId);

    const after = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
      include: { renders: { orderBy: { packPosition: "asc" } } },
    });
    expect(after.status).toBe("CANCELLED");

    const successRender = after.renders.find((r) => r.packPosition === 0);
    const pendingRenders = after.renders.filter(
      (r) => r.packPosition !== null && r.packPosition > 0,
    );

    expect(successRender?.status).toBe("SUCCESS"); // dokunulmadı
    expect(pendingRenders).toHaveLength(2);
    for (const r of pendingRenders) {
      expect(r.status).toBe("FAILED");
      expect(r.errorClass).toBeNull();
    }
  });

  it("rejects cancel on COMPLETED job (409 conflict)", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "COMPLETED",
      renderStatuses: ["SUCCESS", "SUCCESS"],
      startedAt: new Date(),
    });

    await expect(cancelJob(job.id, userAId)).rejects.toThrow(
      JobAlreadyTerminalError,
    );
  });

  it("rejects cancel on FAILED job", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "FAILED",
      renderStatuses: ["FAILED", "FAILED"],
      startedAt: new Date(),
    });

    await expect(cancelJob(job.id, userAId)).rejects.toThrow(
      JobAlreadyTerminalError,
    );
  });

  it("rejects cancel on PARTIAL_COMPLETE job", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "PARTIAL_COMPLETE",
      renderStatuses: ["SUCCESS", "FAILED"],
      startedAt: new Date(),
    });

    await expect(cancelJob(job.id, userAId)).rejects.toThrow(
      JobAlreadyTerminalError,
    );
  });

  it("rejects cancel on already CANCELLED job (idempotent değil)", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "CANCELLED",
      renderStatuses: ["FAILED", "FAILED"],
    });

    await expect(cancelJob(job.id, userAId)).rejects.toThrow(
      JobAlreadyTerminalError,
    );
  });

  it("404 cross-user — userB cancel call userA job", async () => {
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "QUEUED",
      renderStatuses: ["PENDING"],
    });

    await expect(cancelJob(job.id, userBId)).rejects.toThrow(JobNotFoundError);

    // Job dokunulmamış olmalı
    const after = await db.mockupJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.status).toBe("QUEUED");
  });

  it("404 — job yoksa JobNotFoundError", async () => {
    await expect(cancelJob("does-not-exist-cuid", userAId)).rejects.toThrow(
      JobNotFoundError,
    );
  });
});

// ────────────────────────────────────────────────────────────
// Tests — terminal helpers (saf unit)
// ────────────────────────────────────────────────────────────

describe("isJobTerminal / isRenderTerminal helpers", () => {
  it("isJobTerminal: COMPLETED, PARTIAL_COMPLETE, FAILED, CANCELLED → true", () => {
    expect(isJobTerminal("COMPLETED")).toBe(true);
    expect(isJobTerminal("PARTIAL_COMPLETE")).toBe(true);
    expect(isJobTerminal("FAILED")).toBe(true);
    expect(isJobTerminal("CANCELLED")).toBe(true);
  });

  it("isJobTerminal: QUEUED, RUNNING → false", () => {
    expect(isJobTerminal("QUEUED")).toBe(false);
    expect(isJobTerminal("RUNNING")).toBe(false);
  });

  it("isRenderTerminal: SUCCESS, FAILED → true", () => {
    expect(isRenderTerminal("SUCCESS")).toBe(true);
    expect(isRenderTerminal("FAILED")).toBe(true);
  });

  it("isRenderTerminal: PENDING, RENDERING → false", () => {
    expect(isRenderTerminal("PENDING")).toBe(false);
    expect(isRenderTerminal("RENDERING")).toBe(false);
  });
});
