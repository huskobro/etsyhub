// Phase 8 Task 18 — Render service (retry + swap) integration testleri.
//
// Spec §4.4 swap + §4.5 retry + §7.1+§7.2 retry policy + §3.1 packPosition=null
// arşiv. Phase 7+8 emsali fixture pattern (handoff.test.ts + job-lifecycle.test.ts).

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
  type MockupErrorClass,
  type MockupRender,
  type MockupRenderStatus,
  type MockupTemplate,
  type MockupTemplateBinding,
  type PackSelectionReason,
  type SelectionSet,
} from "@prisma/client";
import { db } from "@/server/db";
import {
  retryRender,
  swapRender,
  pickAlternativeRender,
  RenderNotFoundError,
  RenderNotFailedError,
  RetryCapExceededError,
  RenderNotRetryableError,
  NoAlternativePairError,
} from "@/features/mockups/server/render.service";
import type { SelectionSetWithItems } from "@/features/mockups/server/snapshot.service";

// ────────────────────────────────────────────────────────────
// Fixture sabitleri
// ────────────────────────────────────────────────────────────

const TEST_TPL_PREFIX = "phase8-render-svc-";
const PRODUCT_TYPE_KEY = "phase8-render-svc-pt";

let userAId: string;
let userBId: string;

// ────────────────────────────────────────────────────────────
// Fixture helpers (handoff.test.ts paterni)
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

async function ensureProductType(aspectRatio: string | null = "2:3") {
  return db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: { aspectRatio },
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "Phase8 Render Service PT",
      aspectRatio,
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

async function makeReference(userId: string, productTypeId: string) {
  const asset = await makeAsset(userId, `ref-${userId}-${Date.now()}`);
  return db.reference.create({
    data: { userId, assetId: asset.id, productTypeId },
  });
}

async function makeDesign(args: {
  userId: string;
  referenceId: string;
  productTypeId: string;
  aspectRatio: string | null;
}) {
  const asset = await makeAsset(
    args.userId,
    `design-${args.userId}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const design = await db.generatedDesign.create({
    data: {
      userId: args.userId,
      referenceId: args.referenceId,
      assetId: asset.id,
      productTypeId: args.productTypeId,
      aspectRatio: args.aspectRatio,
    },
  });
  return { design, asset };
}

/**
 * Ready set + N item. Tüm item'lar `selected`. designAspectRatio default "2:3".
 */
async function makeReadySet(args: {
  userId: string;
  productTypeId: string;
  variantCount: number;
  designAspectRatio?: string | null;
}) {
  const reference = await makeReference(args.userId, args.productTypeId);
  const set = await db.selectionSet.create({
    data: {
      userId: args.userId,
      name: "Phase8 RenderService Set",
      status: "ready",
      finalizedAt: new Date(),
    },
  });
  const itemIds: string[] = [];
  for (let i = 0; i < args.variantCount; i++) {
    const { design, asset } = await makeDesign({
      userId: args.userId,
      referenceId: reference.id,
      productTypeId: args.productTypeId,
      aspectRatio:
        args.designAspectRatio === undefined ? "2:3" : args.designAspectRatio,
    });
    const item = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: asset.id,
        status: "selected",
        position: i,
      },
    });
    itemIds.push(item.id);
  }
  return { set, itemIds };
}

async function makeTemplate(args: {
  name: string;
  aspectRatios?: string[];
  bindingStatus?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  coverPriority?: number;
}) {
  return db.mockupTemplate.create({
    data: {
      categoryId: "canvas",
      name: `${TEST_TPL_PREFIX}${args.name}`,
      status: "ACTIVE",
      thumbKey: `thumbs/${args.name}.png`,
      aspectRatios: args.aspectRatios ?? ["2:3", "3:4"],
      tags: ["phase8-test"],
      estimatedRenderMs: 2000,
      bindings: {
        create: {
          providerId: "LOCAL_SHARP",
          status: args.bindingStatus ?? "ACTIVE",
          config: {
            providerId: "local-sharp",
            baseAssetKey: `${args.name}/base.png`,
            baseDimensions: { w: 2400, h: 1600 },
            safeArea: { type: "rect", x: 0.3, y: 0.2, w: 0.4, h: 0.5 },
            recipe: { blendMode: "normal" },
            coverPriority: args.coverPriority ?? 50,
          },
          estimatedRenderMs: 2000,
        },
      },
    },
    include: { bindings: true },
  });
}

/**
 * Manuel MockupJob + N MockupRender yarat. Render statuses + variant/binding
 * pair'leri üzerinden full kontrol; handoff path'i bypass eder.
 */
async function makeJob(args: {
  userId: string;
  set: SelectionSet;
  pairs: {
    variantId: string;
    binding: MockupTemplateBinding;
    template: MockupTemplate;
    status: MockupRenderStatus;
    packPosition: number | null;
    errorClass?: MockupErrorClass | null;
    retryCount?: number;
    selectionReason?: PackSelectionReason;
  }[];
}) {
  const job = await db.mockupJob.create({
    data: {
      userId: args.userId,
      setId: args.set.id,
      setSnapshotId: `snap-${Math.random().toString(36).slice(2, 16)}`,
      categoryId: "canvas",
      status: "PARTIAL_COMPLETE", // tipik bir state — testler için irrelevant
      packSize: 10,
      actualPackSize: args.pairs.length,
      totalRenders: args.pairs.length,
      successRenders: args.pairs.filter((p) => p.status === "SUCCESS").length,
      failedRenders: args.pairs.filter((p) => p.status === "FAILED").length,
    },
  });
  const renders: MockupRender[] = [];
  for (const p of args.pairs) {
    const r = await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId: p.variantId,
        bindingId: p.binding.id,
        templateSnapshot: {
          providerId: "LOCAL_SHARP",
          bindingId: p.binding.id,
          bindingVersion: 1,
          templateId: p.template.id,
          templateName: p.template.name,
          aspectRatios: p.template.aspectRatios,
          config: { baseAssetKey: `${p.template.name}/base.png` },
        },
        packPosition: p.packPosition,
        selectionReason: p.selectionReason ?? "VARIANT_ROTATION",
        status: p.status,
        errorClass: p.errorClass ?? null,
        errorDetail: p.errorClass ? `auto fixture ${p.errorClass}` : null,
        retryCount: p.retryCount ?? 0,
      },
    });
    renders.push(r);
  }
  return { job, renders };
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
  const a = await ensureUser("phase8-render-svc-a@etsyhub.local");
  const b = await ensureUser("phase8-render-svc-b@etsyhub.local");
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
// retryRender — Spec §4.5
// ────────────────────────────────────────────────────────────

describe("retryRender (Spec §4.5)", () => {
  it("retries FAILED render with errorClass=RENDER_TIMEOUT", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "rt-timeout" });
    const binding = tpl.bindings[0]!;
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding,
          template: tpl,
          status: "FAILED",
          packPosition: 0,
          errorClass: "RENDER_TIMEOUT",
          retryCount: 0,
        },
      ],
    });

    const result = await retryRender(renders[0]!.id, userAId);
    expect(result.renderId).toBe(renders[0]!.id);

    const after = await db.mockupRender.findUniqueOrThrow({
      where: { id: renders[0]!.id },
    });
    expect(after.status).toBe("PENDING");
    expect(after.errorClass).toBeNull();
    expect(after.errorDetail).toBeNull();
    expect(after.startedAt).toBeNull();
    expect(after.completedAt).toBeNull();
    expect(after.retryCount).toBe(1);
  });

  it("retries FAILED render with errorClass=PROVIDER_DOWN", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "rt-providerdown" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tpl.bindings[0]!,
          template: tpl,
          status: "FAILED",
          packPosition: 0,
          errorClass: "PROVIDER_DOWN",
        },
      ],
    });

    await expect(retryRender(renders[0]!.id, userAId)).resolves.toEqual({
      renderId: renders[0]!.id,
    });

    const after = await db.mockupRender.findUniqueOrThrow({
      where: { id: renders[0]!.id },
    });
    expect(after.status).toBe("PENDING");
    expect(after.retryCount).toBe(1);
  });

  it("rejects retry on TEMPLATE_INVALID errorClass (swap-only)", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "rt-tplinvalid" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tpl.bindings[0]!,
          template: tpl,
          status: "FAILED",
          packPosition: 0,
          errorClass: "TEMPLATE_INVALID",
        },
      ],
    });

    await expect(retryRender(renders[0]!.id, userAId)).rejects.toThrow(
      RenderNotRetryableError,
    );

    const after = await db.mockupRender.findUniqueOrThrow({
      where: { id: renders[0]!.id },
    });
    // No-op: state hâlâ FAILED, retryCount değişmedi.
    expect(after.status).toBe("FAILED");
    expect(after.retryCount).toBe(0);
  });

  it("rejects retry on SAFE_AREA_OVERFLOW errorClass", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "rt-safearea" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tpl.bindings[0]!,
          template: tpl,
          status: "FAILED",
          packPosition: 0,
          errorClass: "SAFE_AREA_OVERFLOW",
        },
      ],
    });
    await expect(retryRender(renders[0]!.id, userAId)).rejects.toThrow(
      RenderNotRetryableError,
    );
  });

  it("rejects retry on SOURCE_QUALITY errorClass", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "rt-srcq" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tpl.bindings[0]!,
          template: tpl,
          status: "FAILED",
          packPosition: 0,
          errorClass: "SOURCE_QUALITY",
        },
      ],
    });
    await expect(retryRender(renders[0]!.id, userAId)).rejects.toThrow(
      RenderNotRetryableError,
    );
  });

  it("rejects retry when errorClass is null (unclassified failure)", async () => {
    // cancelJob FAILED render'larını errorClass=null bırakır (kullanıcı eylemi
    // sinyali). Bu render'lar retry edilemez — kullanıcı job-level cancel
    // sonrası yeni job başlatmalı.
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "rt-nullerr" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tpl.bindings[0]!,
          template: tpl,
          status: "FAILED",
          packPosition: 0,
          errorClass: null,
        },
      ],
    });
    await expect(retryRender(renders[0]!.id, userAId)).rejects.toThrow(
      RenderNotRetryableError,
    );
  });

  it("rejects retry when status === SUCCESS", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "rt-success" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tpl.bindings[0]!,
          template: tpl,
          status: "SUCCESS",
          packPosition: 0,
        },
      ],
    });
    await expect(retryRender(renders[0]!.id, userAId)).rejects.toThrow(
      RenderNotFailedError,
    );
  });

  it("rejects retry when status === PENDING", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "rt-pending" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tpl.bindings[0]!,
          template: tpl,
          status: "PENDING",
          packPosition: 0,
        },
      ],
    });
    await expect(retryRender(renders[0]!.id, userAId)).rejects.toThrow(
      RenderNotFailedError,
    );
  });

  it("rejects retry when retryCount cap=3 exceeded", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "rt-cap" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tpl.bindings[0]!,
          template: tpl,
          status: "FAILED",
          packPosition: 0,
          errorClass: "RENDER_TIMEOUT",
          retryCount: 3,
        },
      ],
    });
    await expect(retryRender(renders[0]!.id, userAId)).rejects.toThrow(
      RetryCapExceededError,
    );
  });

  it("404 cross-user — userB calls userA's render", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "rt-cross" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tpl.bindings[0]!,
          template: tpl,
          status: "FAILED",
          packPosition: 0,
          errorClass: "RENDER_TIMEOUT",
        },
      ],
    });
    await expect(retryRender(renders[0]!.id, userBId)).rejects.toThrow(
      RenderNotFoundError,
    );
  });

  it("404 when renderId does not exist", async () => {
    await expect(
      retryRender("does-not-exist-cuid", userAId),
    ).rejects.toThrow(RenderNotFoundError);
  });

  it("increments retryCount on each successful retry (1 → 2 → 3 → cap)", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "rt-incr" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tpl.bindings[0]!,
          template: tpl,
          status: "FAILED",
          packPosition: 0,
          errorClass: "RENDER_TIMEOUT",
          retryCount: 0,
        },
      ],
    });

    // Helper: render'ı tekrar FAILED durumuna getir (worker'ı simüle et).
    async function simulateFailureAgain(): Promise<void> {
      await db.mockupRender.update({
        where: { id: renders[0]!.id },
        data: {
          status: "FAILED",
          errorClass: "RENDER_TIMEOUT",
          errorDetail: "simulated subsequent failure",
        },
      });
    }

    // 0 → 1
    await retryRender(renders[0]!.id, userAId);
    let after = await db.mockupRender.findUniqueOrThrow({
      where: { id: renders[0]!.id },
    });
    expect(after.retryCount).toBe(1);

    // 1 → 2
    await simulateFailureAgain();
    await retryRender(renders[0]!.id, userAId);
    after = await db.mockupRender.findUniqueOrThrow({
      where: { id: renders[0]!.id },
    });
    expect(after.retryCount).toBe(2);

    // 2 → 3
    await simulateFailureAgain();
    await retryRender(renders[0]!.id, userAId);
    after = await db.mockupRender.findUniqueOrThrow({
      where: { id: renders[0]!.id },
    });
    expect(after.retryCount).toBe(3);

    // 3 → cap (rejected)
    await simulateFailureAgain();
    await expect(retryRender(renders[0]!.id, userAId)).rejects.toThrow(
      RetryCapExceededError,
    );
  });
});

// ────────────────────────────────────────────────────────────
// swapRender — Spec §4.4
// ────────────────────────────────────────────────────────────

describe("swapRender (Spec §4.4)", () => {
  it("swaps FAILED render with deterministic alternative", async () => {
    // 2 variant × 2 binding = 4 valid pair. Job 2 pair kullanıyor (1 SUCCESS,
    // 1 FAILED). Swap → FAILED render arşivlenir, kullanılmamış pair'lerden
    // ilki yeni render olarak yaratılır.
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 2,
    });
    const tplA = await makeTemplate({ name: "swap-a" });
    const tplB = await makeTemplate({ name: "swap-b" });
    const bindingA = tplA.bindings[0]!;
    const bindingB = tplB.bindings[0]!;

    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        // packPosition=0 — variant0 × bindingA (SUCCESS, cover)
        {
          variantId: itemIds[0]!,
          binding: bindingA,
          template: tplA,
          status: "SUCCESS",
          packPosition: 0,
          selectionReason: "COVER",
        },
        // packPosition=1 — variant0 × bindingB (FAILED, hedef)
        {
          variantId: itemIds[0]!,
          binding: bindingB,
          template: tplB,
          status: "FAILED",
          packPosition: 1,
          errorClass: "TEMPLATE_INVALID",
          selectionReason: "TEMPLATE_DIVERSITY",
        },
      ],
    });

    const failedRender = renders[1]!;
    const result = await swapRender(failedRender.id, userAId);
    expect(result.newRenderId).not.toBe(failedRender.id);

    // Eski render arşivlendi (packPosition=null), status hâlâ FAILED.
    const oldAfter = await db.mockupRender.findUniqueOrThrow({
      where: { id: failedRender.id },
    });
    expect(oldAfter.packPosition).toBeNull();
    expect(oldAfter.status).toBe("FAILED");

    // Yeni render PENDING, packPosition=1 (eski'nin değeri korundu).
    const newRender = await db.mockupRender.findUniqueOrThrow({
      where: { id: result.newRenderId },
    });
    expect(newRender.status).toBe("PENDING");
    expect(newRender.packPosition).toBe(1);
    // Kullanılmamış pair: variant1 × bindingA (deterministik lex tie-break).
    expect(newRender.variantId).toBe(itemIds[1]!);
    expect(newRender.bindingId).toBe(bindingA.id);
  });

  it("preserves packPosition on swap (eski'nin değeri yeni'ye)", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 2,
    });
    const tplA = await makeTemplate({ name: "swap-pp-a" });
    const tplB = await makeTemplate({ name: "swap-pp-b" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tplA.bindings[0]!,
          template: tplA,
          status: "SUCCESS",
          packPosition: 0,
        },
        {
          variantId: itemIds[0]!,
          binding: tplB.bindings[0]!,
          template: tplB,
          status: "FAILED",
          packPosition: 5, // garip ama valid
          errorClass: "RENDER_TIMEOUT",
        },
      ],
    });

    const result = await swapRender(renders[1]!.id, userAId);
    const newRender = await db.mockupRender.findUniqueOrThrow({
      where: { id: result.newRenderId },
    });
    expect(newRender.packPosition).toBe(5);
  });

  it("preserves selectionReason on swap", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 2,
    });
    const tplA = await makeTemplate({ name: "swap-sr-a" });
    const tplB = await makeTemplate({ name: "swap-sr-b" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tplA.bindings[0]!,
          template: tplA,
          status: "SUCCESS",
          packPosition: 0,
          selectionReason: "COVER",
        },
        {
          variantId: itemIds[0]!,
          binding: tplB.bindings[0]!,
          template: tplB,
          status: "FAILED",
          packPosition: 1,
          errorClass: "RENDER_TIMEOUT",
          selectionReason: "VARIANT_ROTATION",
        },
      ],
    });

    const result = await swapRender(renders[1]!.id, userAId);
    const newRender = await db.mockupRender.findUniqueOrThrow({
      where: { id: result.newRenderId },
    });
    expect(newRender.selectionReason).toBe("VARIANT_ROTATION");
  });

  it("rejects swap when no alternative pair available", async () => {
    // 1 variant × 1 binding, mevcut zaten kullanılmış (SUCCESS + FAILED arşiv
    // de dahil). Hiç kullanılmamış pair yok.
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "swap-noalt" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tpl.bindings[0]!,
          template: tpl,
          status: "FAILED",
          packPosition: 0,
          errorClass: "RENDER_TIMEOUT",
        },
      ],
    });

    await expect(swapRender(renders[0]!.id, userAId)).rejects.toThrow(
      NoAlternativePairError,
    );
  });

  it("rejects swap when status === SUCCESS (V1: FAILED-only)", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 2,
    });
    const tplA = await makeTemplate({ name: "swap-success-a" });
    const tplB = await makeTemplate({ name: "swap-success-b" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tplA.bindings[0]!,
          template: tplA,
          status: "SUCCESS",
          packPosition: 0,
        },
        {
          variantId: itemIds[0]!,
          binding: tplB.bindings[0]!,
          template: tplB,
          status: "PENDING",
          packPosition: 1,
        },
      ],
    });
    await expect(swapRender(renders[0]!.id, userAId)).rejects.toThrow(
      RenderNotFailedError,
    );
  });

  it("404 cross-user — userB calls userA's render", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 2,
    });
    const tplA = await makeTemplate({ name: "swap-cross-a" });
    const tplB = await makeTemplate({ name: "swap-cross-b" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tplA.bindings[0]!,
          template: tplA,
          status: "SUCCESS",
          packPosition: 0,
        },
        {
          variantId: itemIds[0]!,
          binding: tplB.bindings[0]!,
          template: tplB,
          status: "FAILED",
          packPosition: 1,
          errorClass: "RENDER_TIMEOUT",
        },
      ],
    });
    await expect(swapRender(renders[1]!.id, userBId)).rejects.toThrow(
      RenderNotFoundError,
    );
  });

  it("creates templateSnapshot on new render with new binding", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 2,
    });
    const tplA = await makeTemplate({ name: "swap-snap-a" });
    const tplB = await makeTemplate({ name: "swap-snap-b" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tplA.bindings[0]!,
          template: tplA,
          status: "SUCCESS",
          packPosition: 0,
        },
        {
          variantId: itemIds[0]!,
          binding: tplB.bindings[0]!,
          template: tplB,
          status: "FAILED",
          packPosition: 1,
          errorClass: "RENDER_TIMEOUT",
        },
      ],
    });

    const result = await swapRender(renders[1]!.id, userAId);
    const newRender = await db.mockupRender.findUniqueOrThrow({
      where: { id: result.newRenderId },
    });

    // Snapshot binding'i yeni alternatifle eşleşmeli (bindingA).
    const snap = newRender.templateSnapshot as {
      bindingId: string;
      config: Record<string, unknown>;
    };
    expect(snap.bindingId).toBe(tplA.bindings[0]!.id);
    // Task 5 disiplini: coverPriority snapshot.config dışı.
    expect(snap.config).not.toHaveProperty("coverPriority");
  });

  it("404 when renderId does not exist", async () => {
    await expect(
      swapRender("does-not-exist-cuid", userAId),
    ).rejects.toThrow(RenderNotFoundError);
  });

  it("deterministic alternative selection (lex tie-break by item position then bindingId)", async () => {
    // 3 variant × 2 binding = 6 valid pair. Job 2 pair kullanıyor:
    //   - variant0 × bindingA (SUCCESS, cover)
    //   - variant0 × bindingB (FAILED, hedef)
    // Kullanılmamış pair'ler:
    //   - variant1 × bindingA  ← outer item ASC × inner binding ASC ilk match
    //   - variant1 × bindingB
    //   - variant2 × bindingA
    //   - variant2 × bindingB
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 3,
    });
    const tplA = await makeTemplate({ name: "swap-det-a" });
    const tplB = await makeTemplate({ name: "swap-det-b" });
    // Lex tie-break: bindingA.id vs bindingB.id (cuid'ler farklı). Hangisi ASC?
    const sortedBindingIds = [tplA.bindings[0]!.id, tplB.bindings[0]!.id].sort(
      (a, b) => a.localeCompare(b),
    );
    const firstBindingId = sortedBindingIds[0]!;

    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tplA.bindings[0]!,
          template: tplA,
          status: "SUCCESS",
          packPosition: 0,
        },
        {
          variantId: itemIds[0]!,
          binding: tplB.bindings[0]!,
          template: tplB,
          status: "FAILED",
          packPosition: 1,
          errorClass: "RENDER_TIMEOUT",
        },
      ],
    });

    const result = await swapRender(renders[1]!.id, userAId);
    const newRender = await db.mockupRender.findUniqueOrThrow({
      where: { id: result.newRenderId },
    });

    // Determinizm: variant1 × ilk binding (lex ASC).
    expect(newRender.variantId).toBe(itemIds[1]!);
    expect(newRender.bindingId).toBe(firstBindingId);
  });
});

// ────────────────────────────────────────────────────────────
// pickAlternativeRender — Task 18 helper unit testleri
// ────────────────────────────────────────────────────────────

describe("pickAlternativeRender helper", () => {
  it("filters by aspect compatibility (variant 2:3, binding aspectRatios=[1:1] → invalid)", async () => {
    const productType = await ensureProductType("2:3");
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
      designAspectRatio: "2:3",
    });
    // Aspect mismatch — template yalnız 1:1 destekliyor.
    const tpl = await makeTemplate({
      name: "pick-aspect-mismatch",
      aspectRatios: ["1:1"],
    });
    const fullSet = await db.selectionSet.findUniqueOrThrow({
      where: { id: set.id },
      include: {
        items: {
          include: {
            generatedDesign: { include: { productType: true } },
            sourceAsset: true,
            editedAsset: true,
          },
        },
      },
    });
    const bindings = await db.mockupTemplateBinding.findMany({
      where: { id: { in: [tpl.bindings[0]!.id] } },
      include: { template: true },
    });

    // Henüz kullanılmamış pair varsayalım — ama aspect uyumsuz.
    const result = pickAlternativeRender({
      job: {
        // job alanları yalnız renders için kullanılıyor; minimum stub.
        id: "stub",
        userId: userAId,
        setId: set.id,
        setSnapshotId: "stub",
        categoryId: "canvas",
        status: "RUNNING",
        packSize: 10,
        actualPackSize: 1,
        coverRenderId: null,
        totalRenders: 1,
        successRenders: 0,
        failedRenders: 1,
        errorSummary: null,
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
        renders: [
          {
            id: "stub",
            jobId: "stub",
            variantId: itemIds[0]!,
            bindingId: tpl.bindings[0]!.id,
            templateSnapshot: {},
            packPosition: 0,
            selectionReason: "COVER",
            status: "FAILED",
            outputKey: null,
            thumbnailKey: null,
            errorClass: "TEMPLATE_INVALID",
            errorDetail: "stub",
            retryCount: 0,
            startedAt: null,
            completedAt: null,
          },
        ],
      },
      currentRender: {
        id: "stub",
        jobId: "stub",
        variantId: itemIds[0]!,
        bindingId: tpl.bindings[0]!.id,
        templateSnapshot: {},
        packPosition: 0,
        selectionReason: "COVER",
        status: "FAILED",
        outputKey: null,
        thumbnailKey: null,
        errorClass: "TEMPLATE_INVALID",
        errorDetail: "stub",
        retryCount: 0,
        startedAt: null,
        completedAt: null,
      },
      set: fullSet as SelectionSetWithItems,
      bindingsWithTemplate: bindings,
    });

    // Aspect uyumsuz + tek pair zaten kullanılmış → null.
    expect(result).toBeNull();
  });

  it("excludes archived (packPosition=null) renders' pairs from alternative pool", async () => {
    // 2 variant × 1 binding = 2 valid pair. Önce variant0×binding kullanılmış
    // (FAILED, packPosition=null ARŞİV); sonra variant1×binding (FAILED hedef).
    // Alternatif yalnız variant0×binding olabilir AMA archived olduğu için
    // helper bunu kullanılmış sayar → null.
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 2,
    });
    const tpl = await makeTemplate({ name: "pick-archive" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        // ARŞİV: packPosition=null
        {
          variantId: itemIds[0]!,
          binding: tpl.bindings[0]!,
          template: tpl,
          status: "FAILED",
          packPosition: null, // arşiv
          errorClass: "TEMPLATE_INVALID",
        },
        // hedef
        {
          variantId: itemIds[1]!,
          binding: tpl.bindings[0]!,
          template: tpl,
          status: "FAILED",
          packPosition: 0,
          errorClass: "TEMPLATE_INVALID",
        },
      ],
    });

    // Service-level swapRender çağrısı — alternatif kalmadığı için 409.
    await expect(swapRender(renders[1]!.id, userAId)).rejects.toThrow(
      NoAlternativePairError,
    );
  });

  it("returns null when all valid pairs exhausted (1 variant × 1 binding)", async () => {
    const productType = await ensureProductType();
    const { set, itemIds } = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "pick-exhausted" });
    const { renders } = await makeJob({
      userId: userAId,
      set,
      pairs: [
        {
          variantId: itemIds[0]!,
          binding: tpl.bindings[0]!,
          template: tpl,
          status: "FAILED",
          packPosition: 0,
          errorClass: "RENDER_TIMEOUT",
        },
      ],
    });
    await expect(swapRender(renders[0]!.id, userAId)).rejects.toThrow(
      NoAlternativePairError,
    );
  });
});
