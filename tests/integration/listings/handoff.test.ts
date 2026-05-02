// Phase 9 V1 Task 3 — handoff service (createListingDraftFromMockupJob) integration testleri.
//
// Spec §2.1 + §6.2 sözleşmelerini DB üzerinde doğrular.
// Phase 8 emsali: tests/integration/mockup/handoff.test.ts paterni.

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
  createListingDraftFromMockupJob,
  ListingHandoffJobNotFoundError,
  ListingHandoffJobNotTerminalError,
  ListingHandoffJobAllFailedError,
} from "@/features/listings/server/handoff.service";

// ────────────────────────────────────────────────────────────
// Fixture sabitleri (Phase 7 paterni — predictable IDs)
// ────────────────────────────────────────────────────────────

const TEST_CATEGORY_ID = "canvas";
const TEST_TPL_PREFIX = "phase9-handoff-";
const PRODUCT_TYPE_KEY = "phase9-handoff-pt";

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
      displayName: "Phase9 Handoff Wall Art",
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
  itemCount: number;
  productTypeId: string;
}) {
  const set = await db.selectionSet.create({
    data: {
      userId: args.userId,
      name: `Phase9 Ready Set ${Date.now()}`,
      status: "ready",
    },
  });

  // N design yaratarak set'e ekle
  for (let i = 0; i < args.itemCount; i++) {
    const ref = await makeReference(args.userId, args.productTypeId);
    const { design, asset } = await makeDesign({
      userId: args.userId,
      referenceId: ref.id,
      productTypeId: args.productTypeId,
      aspectRatio: "2:3",
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

/**
 * MockupTemplate + binding oluştur.
 */
async function makeTemplate() {
  const template = await db.mockupTemplate.create({
    data: {
      categoryId: TEST_CATEGORY_ID,
      name: `${TEST_TPL_PREFIX}${Date.now()}`,
      thumbKey: "test-thumb",
      aspectRatios: ["2:3"],
      tags: ["test"],
      estimatedRenderMs: 100,
    },
  });

  const binding = await db.mockupTemplateBinding.create({
    data: {
      templateId: template.id,
      providerId: "DYNAMIC_MOCKUPS", // test provider
      config: {},
      estimatedRenderMs: 100,
    },
  });

  return { template, binding };
}

/**
 * MockupJob terminal state'de oluştur (COMPLETED veya PARTIAL_COMPLETE).
 * Renders: N adet SUCCESS, M adet başka status (failed/pending) olabilir.
 */
async function makeTerminalMockupJob(args: {
  userId: string;
  setId: string;
  status: "COMPLETED" | "PARTIAL_COMPLETE";
  successRenderCount: number;
  failedRenderCount: number;
}) {
  // Sabit set snapshot
  const job = await db.mockupJob.create({
    data: {
      userId: args.userId,
      setId: args.setId,
      setSnapshotId: `snapshot-${Date.now()}`,
      categoryId: TEST_CATEGORY_ID,
      status: args.status,
      packSize: args.successRenderCount + args.failedRenderCount,
      actualPackSize: args.successRenderCount + args.failedRenderCount,
      totalRenders: args.successRenderCount + args.failedRenderCount,
      successRenders: args.successRenderCount,
      failedRenders: args.failedRenderCount,
    },
  });

  // SUCCESS render'ları packPosition 0'dan başlayarak ekle
  let packPosition = 0;
  for (let i = 0; i < args.successRenderCount; i++) {
    const render = await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId: `variant-${i}`,
        bindingId: "dummy-binding",
        packPosition,
        status: "SUCCESS",
        outputKey: `output-${job.id}-${i}`,
        templateSnapshot: { templateName: "TestTemplate" },
        selectionReason: "COVER",
      },
    });
    // Birinci render'ı cover olarak set et
    if (i === 0) {
      await db.mockupJob.update({
        where: { id: job.id },
        data: { coverRenderId: render.id },
      });
    }
    packPosition++;
  }

  // FAILED render'ları ekle (SUCCESS'ten sonra)
  for (let i = 0; i < args.failedRenderCount; i++) {
    await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId: `variant-failed-${i}`,
        bindingId: "dummy-binding",
        packPosition,
        status: "FAILED",
        selectionReason: "TEMPLATE_DIVERSITY",
        templateSnapshot: { templateName: "TestTemplate" },
        errorDetail: "Test error",
      },
    });
    packPosition++;
  }

  // Fetch updated job (coverRenderId set)
  const refreshedJob = await db.mockupJob.findUniqueOrThrow({
    where: { id: job.id },
  });

  return refreshedJob;
}

async function cleanup() {
  // FK order: listing -> mockupRender -> mockupJob -> binding -> template -> selectionItem ->
  // selectionSet -> generatedDesign -> reference -> asset -> productType.
  await db.listing.deleteMany({
    where: { userId: { in: [userAId, userBId].filter(Boolean) } },
  });
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
  const a = await ensureUser("phase9-handoff-a@etsyhub.local");
  const b = await ensureUser("phase9-handoff-b@etsyhub.local");
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
// Tests — 6 senaryo
// ────────────────────────────────────────────────────────────

describe("createListingDraftFromMockupJob", () => {
  it("happy path — COMPLETED job (10/10) → Listing draft + cover + imageOrderJson snapshot", async () => {
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      itemCount: 10,
      productTypeId: productType.id,
    });

    const job = await makeTerminalMockupJob({
      userId: userAId,
      setId: set.id,
      status: "COMPLETED",
      successRenderCount: 10,
      failedRenderCount: 0,
    });

    const { listingId } = await createListingDraftFromMockupJob(job.id, userAId);

    const listing = await db.listing.findUnique({
      where: { id: listingId },
      include: { mockupJob: true },
    });

    expect(listing).toBeDefined();
    expect(listing?.status).toBe("DRAFT");
    expect(listing?.mockupJobId).toBe(job.id);
    expect(listing?.coverRenderId).toBeDefined();
    expect(listing?.coverRenderId).toBe(job.coverRenderId);
    expect(Array.isArray(listing?.imageOrderJson)).toBe(true);

    const imageOrder = listing?.imageOrderJson as unknown as Array<{ packPosition: number; renderId: string; isCover: boolean }>;
    expect(imageOrder.length).toBe(10);
    expect(imageOrder[0]?.packPosition).toBe(0);
    expect(imageOrder[0]?.isCover).toBe(true);
  });

  it("happy path — PARTIAL_COMPLETE job (8/10) → 8 image entry, failed atlanır", async () => {
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      itemCount: 10,
      productTypeId: productType.id,
    });

    const job = await makeTerminalMockupJob({
      userId: userAId,
      setId: set.id,
      status: "PARTIAL_COMPLETE",
      successRenderCount: 8,
      failedRenderCount: 2,
    });

    const { listingId } = await createListingDraftFromMockupJob(job.id, userAId);

    const listing = await db.listing.findUnique({
      where: { id: listingId },
    });

    const imageOrder = listing?.imageOrderJson as unknown as Array<{ packPosition: number }>;
    expect(imageOrder.length).toBe(8);
  });

  it("404 — cross-user job (başka user'ın jobId)", async () => {
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      itemCount: 5,
      productTypeId: productType.id,
    });

    const job = await makeTerminalMockupJob({
      userId: userAId,
      setId: set.id,
      status: "COMPLETED",
      successRenderCount: 5,
      failedRenderCount: 0,
    });

    await expect(
      createListingDraftFromMockupJob(job.id, userBId),
    ).rejects.toThrow(ListingHandoffJobNotFoundError);
  });

  it("404 — non-existent jobId", async () => {
    await expect(
      createListingDraftFromMockupJob("clg0000000000000000000000", userAId),
    ).rejects.toThrow(ListingHandoffJobNotFoundError);
  });

  it("409 — RUNNING job (terminal değil)", async () => {
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      itemCount: 5,
      productTypeId: productType.id,
    });

    const job = await db.mockupJob.create({
      data: {
        userId: userAId,
        setId: set.id,
        setSnapshotId: `snapshot-${Date.now()}`,
        categoryId: TEST_CATEGORY_ID,
        status: "RUNNING",
        packSize: 5,
        actualPackSize: 5,
        totalRenders: 5,
        successRenders: 0,
        failedRenders: 0,
      },
    });

    await expect(
      createListingDraftFromMockupJob(job.id, userAId),
    ).rejects.toThrow(ListingHandoffJobNotTerminalError);
  });

  it("409 — all failed job (successRenders === 0)", async () => {
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      itemCount: 3,
      productTypeId: productType.id,
    });

    const job = await makeTerminalMockupJob({
      userId: userAId,
      setId: set.id,
      status: "PARTIAL_COMPLETE",
      successRenderCount: 0,
      failedRenderCount: 3,
    });

    await expect(
      createListingDraftFromMockupJob(job.id, userAId),
    ).rejects.toThrow(ListingHandoffJobAllFailedError);
  });
});
