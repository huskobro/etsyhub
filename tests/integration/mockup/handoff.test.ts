// Phase 8 Task 5 — handoff service (createMockupJob) integration testleri.
//
// Spec §1.4 + §3.3 + §3.4 sözleşmelerini DB üzerinde doğrular.
// Phase 7 emsali: tests/integration/selection/sets.service.test.ts paterni.

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import {
  createMockupJob,
  SetNotFoundError,
  InvalidSetError,
  InvalidTemplatesError,
  TemplateInvalidError,
} from "@/features/mockups/server/handoff.service";

// ────────────────────────────────────────────────────────────
// Fixture sabitleri (Phase 7 paterni — predictable IDs)
// ────────────────────────────────────────────────────────────

// V1'de tek categoryId: "canvas". Test template'lerini diğer fixture'lardan
// ayırt etmek için name prefix kullanıyoruz.
const TEST_CATEGORY_ID = "canvas";
const TEST_TPL_PREFIX = "phase8-handoff-";
const PRODUCT_TYPE_KEY = "phase8-handoff-pt";

// Kullanıcılar runtime'da yaratılır.
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

async function makeProductType(aspectRatio: string | null) {
  return db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: { aspectRatio },
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "Phase8 Handoff Wall Art",
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
      hash: `hash-${key}`,
    },
  });
}

async function makeReference(userId: string, productTypeId: string) {
  const asset = await makeAsset(userId, `ref-${userId}-${Date.now()}`);
  return db.reference.create({
    data: {
      userId,
      assetId: asset.id,
      productTypeId,
    },
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
 * Ready durumunda bir SelectionSet + N item yarat.
 * Tüm item'lar `selected` (rejected hariç tüm filter testleri için).
 */
async function makeReadySet(args: {
  userId: string;
  productTypeId: string;
  variantCount: number;
  designAspectRatio?: string | null; // her variant'a aynı aspect (default "2:3")
}) {
  const reference = await makeReference(args.userId, args.productTypeId);
  const set = await db.selectionSet.create({
    data: {
      userId: args.userId,
      name: "Phase8 Handoff Ready Set",
      status: "ready",
      finalizedAt: new Date(),
    },
  });
  for (let i = 0; i < args.variantCount; i++) {
    const { design, asset } = await makeDesign({
      userId: args.userId,
      referenceId: reference.id,
      productTypeId: args.productTypeId,
      aspectRatio:
        args.designAspectRatio === undefined
          ? "2:3"
          : args.designAspectRatio,
    });
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: asset.id,
        status: "selected",
        position: i,
      },
    });
  }
  return set;
}

async function makeTemplate(args: {
  name: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  bindingStatus?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  categoryId?: string;
  aspectRatios?: string[];
}) {
  return db.mockupTemplate.create({
    data: {
      categoryId: args.categoryId ?? TEST_CATEGORY_ID,
      name: `${TEST_TPL_PREFIX}${args.name}`,
      status: args.status ?? "ACTIVE",
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
            coverPriority: 50,
          },
          estimatedRenderMs: 2000,
        },
      },
    },
  });
}

// ────────────────────────────────────────────────────────────
// Cleanup
// ────────────────────────────────────────────────────────────

async function cleanup() {
  // FK order: render -> job -> binding -> template -> selectionItem ->
  // selectionSet -> generatedDesign -> reference -> asset -> productType.
  await db.mockupRender.deleteMany({
    where: { job: { userId: { in: [userAId, userBId].filter(Boolean) } } },
  });
  await db.mockupJob.deleteMany({
    where: { userId: { in: [userAId, userBId].filter(Boolean) } },
  });
  // Sadece bu test'in yarattığı template'leri sil (name prefix marker).
  await db.mockupTemplateBinding.deleteMany({
    where: { template: { name: { startsWith: TEST_TPL_PREFIX } } },
  });
  await db.mockupTemplate.deleteMany({
    where: { name: { startsWith: TEST_TPL_PREFIX } },
  });
  await db.selectionItem.deleteMany({
    where: {
      selectionSet: { userId: { in: [userAId, userBId].filter(Boolean) } },
    },
  });
  await db.selectionSet.deleteMany({
    where: { userId: { in: [userAId, userBId].filter(Boolean) } },
  });
  await db.generatedDesign.deleteMany({
    where: { userId: { in: [userAId, userBId].filter(Boolean) } },
  });
  await db.reference.deleteMany({
    where: { userId: { in: [userAId, userBId].filter(Boolean) } },
  });
  await db.asset.deleteMany({
    where: { userId: { in: [userAId, userBId].filter(Boolean) } },
  });
  await db.productType.deleteMany({
    where: { key: PRODUCT_TYPE_KEY },
  });
}

beforeAll(async () => {
  const a = await ensureUser("phase8-handoff-a@etsyhub.local");
  const b = await ensureUser("phase8-handoff-b@etsyhub.local");
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
// Tests — 10 senaryo
// ────────────────────────────────────────────────────────────

describe("createMockupJob (handoff service)", () => {
  it("rejects when SelectionSet status ≠ ready", async () => {
    const productType = await makeProductType("2:3");
    // Manual draft set
    const reference = await makeReference(userAId, productType.id);
    const set = await db.selectionSet.create({
      data: {
        userId: userAId,
        name: "Draft Set",
        status: "draft",
      },
    });
    const { design, asset } = await makeDesign({
      userId: userAId,
      referenceId: reference.id,
      productTypeId: productType.id,
      aspectRatio: "2:3",
    });
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: asset.id,
        status: "selected",
        position: 0,
      },
    });
    const tpl = await makeTemplate({ name: "DraftRejectTpl" });

    await expect(
      createMockupJob({
        userId: userAId,
        setId: set.id,
        categoryId: "canvas" as const,
        templateIds: [tpl.id],
      }),
    ).rejects.toThrow(InvalidSetError);
  });

  it("rejects cross-user (404 disiplini)", async () => {
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "CrossUserTpl" });

    await expect(
      createMockupJob({
        userId: userBId, // farklı user!
        setId: set.id,
        categoryId: "canvas" as const,
        templateIds: [tpl.id],
      }),
    ).rejects.toThrow(SetNotFoundError);
  });

  it("rejects empty templateIds", async () => {
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });

    await expect(
      createMockupJob({
        userId: userAId,
        setId: set.id,
        categoryId: "canvas" as const,
        templateIds: [],
      }),
    ).rejects.toThrow(InvalidTemplatesError);
  });

  it("rejects > 8 templateIds", async () => {
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    // Cap (1..8) check'i template'ler create edilmeden de fail-fast olmalı.
    const fakeIds = Array.from({ length: 9 }, (_, i) => `fake-${i}`);

    await expect(
      createMockupJob({
        userId: userAId,
        setId: set.id,
        categoryId: "canvas" as const,
        templateIds: fakeIds,
      }),
    ).rejects.toThrow(InvalidTemplatesError);
  });

  it("rejects when no template found / inactive (InvalidTemplates)", async () => {
    // Set ready + 1 variant; ama template'ler inactive (DRAFT) — hiçbiri eşleşmez.
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const draftTpl = await makeTemplate({
      name: "DraftTpl",
      status: "DRAFT",
    });

    await expect(
      createMockupJob({
        userId: userAId,
        setId: set.id,
        categoryId: "canvas" as const,
        templateIds: [draftTpl.id],
      }),
    ).rejects.toThrow(InvalidTemplatesError);
  });

  it("rejects when template has no active binding (TemplateInvalid)", async () => {
    // Template ACTIVE ama binding'i DRAFT.
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({
      name: "NoActiveBindingTpl",
      bindingStatus: "DRAFT",
    });

    await expect(
      createMockupJob({
        userId: userAId,
        setId: set.id,
        categoryId: "canvas" as const,
        templateIds: [tpl.id],
      }),
    ).rejects.toThrow(TemplateInvalidError);
  });

  it("rejects when all variants have null aspectRatio (set-level)", async () => {
    // Hem generatedDesign.aspectRatio hem productType.aspectRatio null.
    const productType = await makeProductType(null);
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 2,
      designAspectRatio: null,
    });
    const tpl = await makeTemplate({ name: "NullAspectTpl" });

    await expect(
      createMockupJob({
        userId: userAId,
        setId: set.id,
        categoryId: "canvas" as const,
        templateIds: [tpl.id],
      }),
    ).rejects.toThrow(InvalidSetError);
  });

  it("creates job + N MockupRender rows eager (PENDING) — happy path", async () => {
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 3,
    });
    const tpl1 = await makeTemplate({ name: "HappyTpl1" });
    const tpl2 = await makeTemplate({ name: "HappyTpl2" });

    const { jobId } = await createMockupJob({
      userId: userAId,
      setId: set.id,
      categoryId: "canvas" as const,
      templateIds: [tpl1.id, tpl2.id],
    });

    const job = await db.mockupJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { renders: { orderBy: { packPosition: "asc" } } },
    });

    expect(job.status).toBe("QUEUED");
    expect(job.userId).toBe(userAId);
    expect(job.setId).toBe(set.id);
    expect(job.categoryId).toBe("canvas");
    expect(job.packSize).toBe(10);
    expect(job.actualPackSize).toBe(job.renders.length);
    expect(job.totalRenders).toBe(job.renders.length);
    expect(job.coverRenderId).toBeTruthy();

    // Cover invariant: coverRenderId === packPosition=0 render
    const cover = job.renders.find((r) => r.packPosition === 0);
    expect(cover).toBeDefined();
    expect(job.coverRenderId).toBe(cover!.id);

    // Tüm render'lar PENDING
    for (const render of job.renders) {
      expect(render.status).toBe("PENDING");
      expect(render.outputKey).toBeNull();
      expect(render.thumbnailKey).toBeNull();
    }
  });

  it("computes setSnapshotId deterministically (same set → same hash)", async () => {
    // Aynı set ile 2 kez createMockupJob — setSnapshotId aynı olmalı.
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 2,
    });
    const tpl1 = await makeTemplate({ name: "SnapTpl1" });
    const tpl2 = await makeTemplate({ name: "SnapTpl2" });

    const { jobId: jobId1 } = await createMockupJob({
      userId: userAId,
      setId: set.id,
      categoryId: "canvas" as const,
      templateIds: [tpl1.id],
    });
    const { jobId: jobId2 } = await createMockupJob({
      userId: userAId,
      setId: set.id,
      categoryId: "canvas" as const,
      templateIds: [tpl2.id], // farklı template, aynı set
    });

    const job1 = await db.mockupJob.findUniqueOrThrow({
      where: { id: jobId1 },
    });
    const job2 = await db.mockupJob.findUniqueOrThrow({
      where: { id: jobId2 },
    });

    expect(job1.setSnapshotId).toBe(job2.setSnapshotId);
    expect(job1.setSnapshotId).toMatch(/^[a-f0-9]{64}$/);
  });

  it("totalRenders === actualPackSize (compatibility-limited senaryo)", async () => {
    // 1 variant × 1 template → max 1 pack slot (stub algoritma).
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "LimitedTpl" });

    const { jobId } = await createMockupJob({
      userId: userAId,
      setId: set.id,
      categoryId: "canvas" as const,
      templateIds: [tpl.id],
    });

    const job = await db.mockupJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { renders: true },
    });

    expect(job.actualPackSize).toBe(1);
    expect(job.totalRenders).toBe(1);
    expect(job.renders).toHaveLength(1);
  });

  it("stores templateSnapshot in each render (config + template metadata, no coverPriority)", async () => {
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 2,
    });
    const tpl = await makeTemplate({ name: "SnapPayloadTpl" });

    const { jobId } = await createMockupJob({
      userId: userAId,
      setId: set.id,
      categoryId: "canvas" as const,
      templateIds: [tpl.id],
    });

    const renders = await db.mockupRender.findMany({ where: { jobId } });
    expect(renders.length).toBeGreaterThan(0);

    for (const render of renders) {
      const snap = render.templateSnapshot as Record<string, unknown>;
      expect(snap.providerId).toBe("LOCAL_SHARP");
      expect(snap.bindingVersion).toBe(1);
      expect(snap.templateName).toBe(`${TEST_TPL_PREFIX}SnapPayloadTpl`);
      expect(snap.aspectRatios).toEqual(["2:3", "3:4"]);
      // coverPriority snapshot dışı (§3.3)
      const config = snap.config as Record<string, unknown>;
      expect(config.coverPriority).toBeUndefined();
      expect(config.baseAssetKey).toBe("SnapPayloadTpl/base.png");
    }
  });
});
