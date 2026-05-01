// Phase 8 Task 7 — MOCKUP_RENDER worker integration tests.
//
// Senaryolar (Plan Task 7 step 1):
//   1. PENDING → RENDERING → FAILED (NOT_IMPLEMENTED → PROVIDER_DOWN)
//      Sharp localSharpProvider Task 9-10 öncesi NOT_IMPLEMENTED throw eder;
//      worker bunu yakalayıp PROVIDER_DOWN classify eder.
//   2. Job CANCELLED ise render dokunulmaz (no-op return; Task 6 race koruması).
//   3. QUEUED → RUNNING transition (ilk render PENDING dışına çıkınca).
//   4. Tüm render NOT_IMPLEMENTED throw → job FAILED aggregate.
//   5. SUCCESS render preserve + iki PENDING fail → PARTIAL_COMPLETE.
//   6. Payload Zod validation (boş renderId → throw).
//   7. classifyRenderError 5+ senaryo (timeout, NOT_IMPLEMENTED, ZodError,
//      PROVIDER_NOT_CONFIGURED, default + non-Error).
//
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
  type MockupRenderStatus,
  type MockupTemplateBinding,
  type SelectionItem,
  type GeneratedDesign,
  type Asset,
} from "@prisma/client";
import type { Job } from "bullmq";
import { db } from "@/server/db";
import {
  handleMockupRender,
  classifyRenderError,
} from "@/server/workers/mockup-render.worker";
import type { MockupRenderJobPayload } from "@/jobs/mockup-render.config";

// ────────────────────────────────────────────────────────────
// Fixture sabitleri
// ────────────────────────────────────────────────────────────

const TEST_TPL_PREFIX = "phase8-worker-";
const PRODUCT_TYPE_KEY = "phase8-worker-pt";

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
      displayName: "Phase8 Worker PT",
      aspectRatio: "2:3",
      isSystem: false,
    },
  });
}

async function makeAsset(userId: string, key: string): Promise<Asset> {
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

async function makeDesignAndItem(
  userId: string,
  productTypeId: string,
): Promise<{
  design: GeneratedDesign;
  variant: SelectionItem;
  sourceAsset: Asset;
}> {
  // Reference + design
  const refAsset = await makeAsset(userId, `ref-${Date.now()}`);
  const reference = await db.reference.create({
    data: { userId, assetId: refAsset.id, productTypeId },
  });
  const designAsset = await makeAsset(
    userId,
    `design-${Math.random().toString(36).slice(2, 8)}`,
  );
  const design = await db.generatedDesign.create({
    data: {
      userId,
      referenceId: reference.id,
      assetId: designAsset.id,
      productTypeId,
      aspectRatio: "2:3",
    },
  });

  // SelectionSet (ready) + item
  const set = await db.selectionSet.create({
    data: {
      userId,
      name: "Phase8 Worker Set",
      status: "ready",
      finalizedAt: new Date(),
    },
  });
  const variant = await db.selectionItem.create({
    data: {
      selectionSetId: set.id,
      generatedDesignId: design.id,
      sourceAssetId: designAsset.id,
      status: "selected",
      position: 0,
    },
  });

  return { design, variant, sourceAsset: designAsset };
}

async function makeTemplateAndBinding(
  name: string,
): Promise<{ binding: MockupTemplateBinding; templateName: string }> {
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
  const binding = tpl.bindings[0];
  if (!binding) throw new Error("fixture: binding yok");
  return { binding, templateName: tpl.name };
}

/**
 * Manuel MockupJob + N MockupRender (templateSnapshot dolu) yarat.
 * Worker testleri için minimum kayıt seti.
 */
async function makeJobWithRenders(args: {
  userId: string;
  jobStatus: "QUEUED" | "RUNNING" | "CANCELLED" | "COMPLETED";
  renderStatuses: MockupRenderStatus[];
  variantId: string; // SelectionItem.id
  binding: MockupTemplateBinding;
  templateName: string;
  startedAt?: Date | null;
}): Promise<MockupJob & { renders: { id: string }[] }> {
  const productType = await ensureProductType();
  // Set zaten variant fixture'ında yaratıldı; burada sadece job için referans.
  // Job FK için yeni bir dummy set lazım (mevcut variant'ın set'ini kullanmamak
  // isolation için tercih edilir; ama variant.selectionSetId zaten bir set
  // gösteriyor — onu reuse edelim).
  const variant = await db.selectionItem.findUniqueOrThrow({
    where: { id: args.variantId },
  });

  // ProductType kullanımı: variant fixture'ında zaten kullanıldı; bu sadece
  // ensure idempotent. (linter no-unused-var koruması).
  void productType;

  const total = args.renderStatuses.length;

  const job = await db.mockupJob.create({
    data: {
      userId: args.userId,
      setId: variant.selectionSetId,
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

  const renderRows: { id: string }[] = [];
  for (let i = 0; i < args.renderStatuses.length; i++) {
    const status = args.renderStatuses[i]!;
    const render = await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId: args.variantId,
        bindingId: args.binding.id,
        templateSnapshot: {
          templateId: "tpl-id",
          bindingId: args.binding.id,
          bindingVersion: args.binding.version,
          providerId: "LOCAL_SHARP",
          templateName: args.templateName,
          aspectRatios: ["2:3"],
          config: {
            providerId: "local-sharp",
            baseAssetKey: "x/base.png",
            baseDimensions: { w: 2400, h: 1600 },
            safeArea: { type: "rect", x: 0.3, y: 0.2, w: 0.4, h: 0.5 },
            recipe: { blendMode: "normal" },
          },
        },
        packPosition: i,
        selectionReason: i === 0 ? "COVER" : "TEMPLATE_DIVERSITY",
        status,
      },
    });
    renderRows.push({ id: render.id });
  }

  return { ...job, renders: renderRows };
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
  const a = await ensureUser("phase8-worker-a@etsyhub.local");
  userAId = a.id;
});

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

// ────────────────────────────────────────────────────────────
// Helper: mock BullMQ Job — sadece data field'ı kullanılıyor.
// ────────────────────────────────────────────────────────────

function mockJob(payload: MockupRenderJobPayload): Job<MockupRenderJobPayload> {
  return { id: payload.renderId, data: payload } as Job<MockupRenderJobPayload>;
}

// ────────────────────────────────────────────────────────────
// Tests — handleMockupRender
// ────────────────────────────────────────────────────────────

describe("MOCKUP_RENDER worker — handleMockupRender", () => {
  it("processes PENDING → FAILED (localSharpProvider NOT_IMPLEMENTED → PROVIDER_DOWN)", async () => {
    const productType = await ensureProductType();
    const { variant } = await makeDesignAndItem(userAId, productType.id);
    const { binding, templateName } = await makeTemplateAndBinding("p1");

    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "QUEUED",
      renderStatuses: ["PENDING"],
      variantId: variant.id,
      binding,
      templateName,
    });

    const renderId = job.renders[0]!.id;
    await handleMockupRender(mockJob({ renderId }));

    const after = await db.mockupRender.findUniqueOrThrow({
      where: { id: renderId },
    });
    expect(after.status).toBe("FAILED");
    expect(after.errorClass).toBe("PROVIDER_DOWN");
    expect(after.errorDetail).toContain("NOT_IMPLEMENTED");
    expect(after.completedAt).toBeInstanceOf(Date);
    expect(after.startedAt).toBeInstanceOf(Date);

    // Job aggregate FAILED (tüm render'lar terminal + 0 success)
    const jobAfter = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(jobAfter.status).toBe("FAILED");
    expect(jobAfter.failedRenders).toBe(1);
    expect(jobAfter.successRenders).toBe(0);
  });

  it("skips render when job is CANCELLED (no-op return)", async () => {
    const productType = await ensureProductType();
    const { variant } = await makeDesignAndItem(userAId, productType.id);
    const { binding, templateName } = await makeTemplateAndBinding("p2");

    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "CANCELLED",
      // Race senaryosu: render hâlâ PENDING (cancelJob normalde FAILED'a çeker
      // ama bu test no-op guard'ı izole eder).
      renderStatuses: ["PENDING"],
      variantId: variant.id,
      binding,
      templateName,
    });

    const renderId = job.renders[0]!.id;
    const before = await db.mockupRender.findUniqueOrThrow({
      where: { id: renderId },
    });

    await handleMockupRender(mockJob({ renderId }));

    // Render hiç dokunulmamalı.
    const after = await db.mockupRender.findUniqueOrThrow({
      where: { id: renderId },
    });
    expect(after.status).toBe(before.status);
    expect(after.startedAt).toBe(before.startedAt);
    expect(after.completedAt).toBe(before.completedAt);
    expect(after.errorClass).toBe(before.errorClass);

    // Job da CANCELLED kalmalı.
    const jobAfter = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(jobAfter.status).toBe("CANCELLED");
  });

  it("triggers QUEUED → RUNNING transition on first render start", async () => {
    const productType = await ensureProductType();
    const { variant } = await makeDesignAndItem(userAId, productType.id);
    const { binding, templateName } = await makeTemplateAndBinding("p3");

    // 3 render PENDING; ilkini handle edeceğiz. Sharp NOT_IMPLEMENTED ile FAIL
    // olacak ama recomputeJobStatus ilk önce QUEUED → RUNNING transition yapar
    // (PENDING → RENDERING geçtiği anda); sonra FAIL olunca terminal değil
    // (2 render hâlâ PENDING) → RUNNING kalır.
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "QUEUED",
      renderStatuses: ["PENDING", "PENDING", "PENDING"],
      variantId: variant.id,
      binding,
      templateName,
    });

    const renderId = job.renders[0]!.id;
    await handleMockupRender(mockJob({ renderId }));

    const jobAfter = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(jobAfter.status).toBe("RUNNING");
    expect(jobAfter.startedAt).toBeInstanceOf(Date);
    expect(jobAfter.completedAt).toBeNull();
    expect(jobAfter.failedRenders).toBe(1);
  });

  it("recomputes job to FAILED when all renders fail (all NOT_IMPLEMENTED)", async () => {
    const productType = await ensureProductType();
    const { variant } = await makeDesignAndItem(userAId, productType.id);
    const { binding, templateName } = await makeTemplateAndBinding("p4");

    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "QUEUED",
      renderStatuses: ["PENDING", "PENDING", "PENDING"],
      variantId: variant.id,
      binding,
      templateName,
    });

    // 3 render ardı ardına işle → her biri NOT_IMPLEMENTED throw → FAIL.
    for (const r of job.renders) {
      await handleMockupRender(mockJob({ renderId: r.id }));
    }

    const jobAfter = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(jobAfter.status).toBe("FAILED");
    expect(jobAfter.failedRenders).toBe(3);
    expect(jobAfter.successRenders).toBe(0);
    expect(jobAfter.completedAt).toBeInstanceOf(Date);
  });

  it("preserves SUCCESS renders during partial run (PARTIAL_COMPLETE)", async () => {
    const productType = await ensureProductType();
    const { variant } = await makeDesignAndItem(userAId, productType.id);
    const { binding, templateName } = await makeTemplateAndBinding("p5");

    // 1 SUCCESS (önceden işaretli; Task 9-10 path simülasyonu) + 2 PENDING.
    const job = await makeJobWithRenders({
      userId: userAId,
      jobStatus: "RUNNING",
      renderStatuses: ["SUCCESS", "PENDING", "PENDING"],
      variantId: variant.id,
      binding,
      templateName,
      startedAt: new Date(),
    });

    // SUCCESS render'a outputKey set edelim (preserve testi).
    await db.mockupRender.update({
      where: { id: job.renders[0]!.id },
      data: {
        outputKey: "mockups/preserved/output.png",
        thumbnailKey: "mockups/preserved/thumb.png",
        completedAt: new Date(),
      },
    });

    // PENDING'leri işle.
    await handleMockupRender(mockJob({ renderId: job.renders[1]!.id }));
    await handleMockupRender(mockJob({ renderId: job.renders[2]!.id }));

    const jobAfter = await db.mockupJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(jobAfter.status).toBe("PARTIAL_COMPLETE");
    expect(jobAfter.successRenders).toBe(1);
    expect(jobAfter.failedRenders).toBe(2);

    // SUCCESS render output'u korunmalı.
    const successRender = await db.mockupRender.findUniqueOrThrow({
      where: { id: job.renders[0]!.id },
    });
    expect(successRender.status).toBe("SUCCESS");
    expect(successRender.outputKey).toBe("mockups/preserved/output.png");
  });

  it("payload validation: invalid renderId rejected by Zod", async () => {
    await expect(
      handleMockupRender(mockJob({ renderId: "" })),
    ).rejects.toThrow();
  });
});

// ────────────────────────────────────────────────────────────
// Tests — classifyRenderError (saf unit testleri)
// ────────────────────────────────────────────────────────────

describe("classifyRenderError", () => {
  it("AbortError → RENDER_TIMEOUT", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(classifyRenderError(err)).toBe("RENDER_TIMEOUT");
  });

  it("'timeout' message → RENDER_TIMEOUT", () => {
    expect(classifyRenderError(new Error("Request timeout"))).toBe(
      "RENDER_TIMEOUT",
    );
  });

  it("NOT_IMPLEMENTED → PROVIDER_DOWN", () => {
    expect(
      classifyRenderError(
        new Error(
          "NOT_IMPLEMENTED: Sharp render Task 9-10'da implement edilecek",
        ),
      ),
    ).toBe("PROVIDER_DOWN");
  });

  it("PROVIDER_NOT_CONFIGURED → PROVIDER_DOWN", () => {
    expect(
      classifyRenderError(new Error("PROVIDER_NOT_CONFIGURED: Dynamic Mockups V2")),
    ).toBe("PROVIDER_DOWN");
  });

  it("ZodError → TEMPLATE_INVALID", () => {
    const z = new Error("validation failed");
    z.name = "ZodError";
    expect(classifyRenderError(z)).toBe("TEMPLATE_INVALID");
  });

  it("unknown error → PROVIDER_DOWN (default)", () => {
    expect(classifyRenderError(new Error("something weird"))).toBe(
      "PROVIDER_DOWN",
    );
  });

  it("non-Error value → PROVIDER_DOWN", () => {
    expect(classifyRenderError("string error")).toBe("PROVIDER_DOWN");
    expect(classifyRenderError(null)).toBe("PROVIDER_DOWN");
    expect(classifyRenderError(undefined)).toBe("PROVIDER_DOWN");
  });
});
