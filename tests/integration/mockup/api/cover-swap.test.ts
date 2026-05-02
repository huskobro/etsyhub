// Phase 8 Task 20 — POST /api/mockup/jobs/[jobId]/cover integration testleri.
//
// Spec §4.8 sözleşmesi:
//   - Request body: { renderId: string }
//   - Response 200: { jobId, coverRenderId }
//   - Error mapping (AppError.statusCode auto via withErrorHandling):
//       400 INVALID_RENDER (renderId not in this job)
//       400 RENDER_NOT_SUCCESS (failed/pending render)
//       400 ALREADY_COVER (no-op, explicitly rejected)
//       404 JOB_NOT_FOUND (cross-user or not exists)
//       401 UnauthorizedError (auth fail)
//
// Invariant tested: cover ⇔ packPosition=0 preserved after swap.
//
// Fixture pattern: tests/integration/mockup/api/create-job.test.ts (Task 16)
// Service tested: swapCover (cover.service.ts Task 20)

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus, MockupRenderStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { POST } from "@/app/api/mockup/jobs/[jobId]/cover/route";
import { requireUser } from "@/server/session";

// ────────────────────────────────────────────────────────────
// Fixture sabitleri
// ────────────────────────────────────────────────────────────

const TEST_CATEGORY_ID = "canvas";
const PRODUCT_TYPE_KEY = "phase8-api-cover-swap-pt";

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
      displayName: "Phase8 API Cover Swap Wall Art",
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
      aspectRatio: "2:3",
    },
  });
  return { design, asset };
}

async function makeTemplateWithBinding() {
  const template = await db.mockupTemplate.create({
    data: {
      categoryId: TEST_CATEGORY_ID,
      name: `phase8-api-cover-swap-tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      thumbKey: `thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`,
      aspectRatios: ["2:3"],
      estimatedRenderMs: 100,
    },
  });

  const binding = await db.mockupTemplateBinding.create({
    data: {
      templateId: template.id,
      providerId: "LOCAL_SHARP",
      version: 1,
      status: "ACTIVE",
      config: { type: "canvas_mockup", width: 600, height: 900 },
      estimatedRenderMs: 100,
    },
  });

  return { template, binding };
}

async function makeReadySet(args: {
  userId: string;
  productTypeId: string;
  variantCount: number;
}) {
  const reference = await makeReference(args.userId, args.productTypeId);
  const set = await db.selectionSet.create({
    data: {
      userId: args.userId,
      name: "Phase8 API Cover Swap Set",
      status: "ready",
      finalizedAt: new Date(),
    },
  });

  const items: string[] = [];
  for (let i = 0; i < args.variantCount; i++) {
    const { design, asset } = await makeDesign({
      userId: args.userId,
      referenceId: reference.id,
      productTypeId: args.productTypeId,
    });

    const item = await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: design.id,
        sourceAssetId: asset.id,
        position: i,
        status: "selected",
      },
    });
    items.push(item.id);
  }

  return { set, itemIds: items };
}

async function makeJob(args: {
  userId: string;
  setId: string;
  bindings: Array<{ id: string }>;
}) {
  const job = await db.mockupJob.create({
    data: {
      userId: args.userId,
      setId: args.setId,
      setSnapshotId: `snapshot-${Date.now()}`,
      categoryId: TEST_CATEGORY_ID,
      status: "COMPLETED",
      packSize: 10,
      actualPackSize: args.bindings.length,
      totalRenders: args.bindings.length,
      successRenders: args.bindings.length,
      failedRenders: 0,
      coverRenderId: "temp", // Will be set after renders created
    },
  });

  // Create renders (fetch set items)
  const setWithItems = await db.selectionSet.findUnique({
    where: { id: args.setId },
    include: { items: true },
  });
  if (!setWithItems) throw new Error("Set not found");

  const renders = await Promise.all(
    args.bindings.map((binding, idx) => {
      const item = setWithItems.items[idx];
      if (!item) throw new Error(`Item ${idx} not found in set`);

      return db.mockupRender.create({
        data: {
          jobId: job.id,
          variantId: item.id,
          bindingId: binding.id,
          templateSnapshot: { mock: true },
          packPosition: idx,
          selectionReason: idx === 0 ? "COVER" : "TEMPLATE_DIVERSITY",
          status: "SUCCESS",
          outputKey: `output-${job.id}-${idx}.png`,
          thumbnailKey: `thumb-${job.id}-${idx}.png`,
        },
      });
    }),
  );

  // Update job.coverRenderId to first render
  if (renders.length > 0) {
    await db.mockupJob.update({
      where: { id: job.id },
      data: { coverRenderId: renders[0]!.id },
    });
  }

  return { job, renders };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe("POST /api/mockup/jobs/[jobId]/cover (Spec §4.8)", () => {
  beforeAll(async () => {
    userAId = (await ensureUser("cover-swap-user-a@test.com")).id;
    userBId = (await ensureUser("cover-swap-user-b@test.com")).id;
    await makeProductType("2:3");
  });

  afterAll(async () => {
    // Cleanup (optional for MVP — test data is namespaced).
    // Note: Asset->User has onDelete: Restrict, so direct user delete fails.
    // In MVP, leaving test data intact is acceptable.
    try {
      await db.user.deleteMany({ where: { email: { contains: "cover-swap" } } });
    } catch {
      // FK constraint — skip for now.
    }
    try {
      await db.productType.deleteMany({ where: { key: PRODUCT_TYPE_KEY } });
    } catch {
      // May be in use — skip.
    }
  });

  describe("Happy path", () => {
    it("200 atomic swap: yeni cover packPosition=0, eski cover newCover'ın eski position'ı alır", async () => {
      // Setup: 3-render job
      const { set, itemIds } = await makeReadySet({
        userId: userAId,
        productTypeId: (
          await db.productType.findUnique({
            where: { key: PRODUCT_TYPE_KEY },
          })
        )!.id,
        variantCount: 3,
      });

      const bindings = await Promise.all(
        [0, 1, 2].map(() => makeTemplateWithBinding().then((r) => r.binding)),
      );

      const { job, renders } = await makeJob({
        userId: userAId,
        setId: set.id,
        bindings,
      });

      // Before: covers = render[0] (packPos 0), secondary = render[1] (packPos 1)
      const beforeCover = renders[0]!;
      const swapTarget = renders[1]!;
      expect(beforeCover.packPosition).toBe(0);
      expect(swapTarget.packPosition).toBe(1);

      // Mock user session
      vi.mocked(requireUser).mockResolvedValueOnce({
        id: userAId,
      } as any);

      // Call endpoint
      const res = await POST(
        new Request("http://test/api/mockup/jobs/[jobId]/cover", {
          method: "POST",
          body: JSON.stringify({ renderId: swapTarget.id }),
        }),
        { params: { jobId: job.id } },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.coverRenderId).toBe(swapTarget.id);
      expect(body.jobId).toBe(job.id);

      // Verify atomic swap in DB
      const newCover = await db.mockupRender.findUnique({
        where: { id: swapTarget.id },
      });
      const oldCover = await db.mockupRender.findUnique({
        where: { id: beforeCover.id },
      });

      expect(newCover!.packPosition).toBe(0); // New cover → packPos 0
      expect(oldCover!.packPosition).toBe(1); // Old cover → swapTarget's old pos
    });

    it("job.coverRenderId yeni render id ile günceller", async () => {
      // Setup: 2-render job
      const { set } = await makeReadySet({
        userId: userAId,
        productTypeId: (
          await db.productType.findUnique({
            where: { key: PRODUCT_TYPE_KEY },
          })
        )!.id,
        variantCount: 2,
      });

      const bindings = await Promise.all(
        [0, 1].map(() => makeTemplateWithBinding().then((r) => r.binding)),
      );

      const { job, renders } = await makeJob({
        userId: userAId,
        setId: set.id,
        bindings,
      });

      const newCover = renders[1]!;

      vi.mocked(requireUser).mockResolvedValueOnce({
        id: userAId,
      } as any);

      await POST(
        new Request("http://test/api/mockup/jobs/[jobId]/cover", {
          method: "POST",
          body: JSON.stringify({ renderId: newCover.id }),
        }),
        { params: { jobId: job.id } },
      );

      const updatedJob = await db.mockupJob.findUnique({
        where: { id: job.id },
      });

      expect(updatedJob!.coverRenderId).toBe(newCover.id);
    });
  });

  describe("400 error scenarios", () => {
    it("400 INVALID_RENDER: renderId bu job'a ait değil", async () => {
      const { set } = await makeReadySet({
        userId: userAId,
        productTypeId: (
          await db.productType.findUnique({
            where: { key: PRODUCT_TYPE_KEY },
          })
        )!.id,
        variantCount: 1,
      });

      const { binding } = await makeTemplateWithBinding();
      const { job } = await makeJob({
        userId: userAId,
        setId: set.id,
        bindings: [binding],
      });

      // Create unrelated render in different job
      const { set: otherSet } = await makeReadySet({
        userId: userAId,
        productTypeId: (
          await db.productType.findUnique({
            where: { key: PRODUCT_TYPE_KEY },
          })
        )!.id,
        variantCount: 1,
      });

      const { binding: otherBinding } = await makeTemplateWithBinding();
      const { renders: otherRenders } = await makeJob({
        userId: userAId,
        setId: otherSet.id,
        bindings: [otherBinding],
      });

      vi.mocked(requireUser).mockResolvedValueOnce({
        id: userAId,
      } as any);

      const res = await POST(
        new Request("http://test/api/mockup/jobs/[jobId]/cover", {
          method: "POST",
          body: JSON.stringify({ renderId: otherRenders[0]!.id }),
        }),
        { params: { jobId: job.id } },
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("INVALID_RENDER");
    });

    it("400 RENDER_NOT_SUCCESS: status FAILED/PENDING render cover olamaz", async () => {
      const { set, itemIds } = await makeReadySet({
        userId: userAId,
        productTypeId: (
          await db.productType.findUnique({
            where: { key: PRODUCT_TYPE_KEY },
          })
        )!.id,
        variantCount: 2,
      });

      const bindingResults = await Promise.all([0, 1].map(() => makeTemplateWithBinding()));
      const bindings = bindingResults.map((r) => r.binding);

      const job = await db.mockupJob.create({
        data: {
          userId: userAId,
          setId: set.id,
          setSnapshotId: `snapshot-${Date.now()}`,
          categoryId: TEST_CATEGORY_ID,
          status: "COMPLETED",
          packSize: 10,
          actualPackSize: 2,
          totalRenders: 2,
          successRenders: 1,
          failedRenders: 1,
          coverRenderId: "temp",
        },
      });

      // Create success + failed renders
      const successRender = await db.mockupRender.create({
        data: {
          jobId: job.id,
          variantId: itemIds[0]!,
          bindingId: bindings[0]!.id,
          templateSnapshot: { mock: true },
          packPosition: 0,
          selectionReason: "COVER",
          status: "SUCCESS",
          outputKey: `output-${job.id}-0.png`,
        },
      });

      const failedRender = await db.mockupRender.create({
        data: {
          jobId: job.id,
          variantId: itemIds[1]!,
          bindingId: bindings[1]!.id,
          templateSnapshot: { mock: true },
          packPosition: 1,
          selectionReason: "TEMPLATE_DIVERSITY",
          status: "FAILED",
          errorDetail: "Mock error",
        },
      });

      await db.mockupJob.update({
        where: { id: job.id },
        data: { coverRenderId: successRender.id },
      });

      vi.mocked(requireUser).mockResolvedValueOnce({
        id: userAId,
      } as any);

      const res = await POST(
        new Request("http://test/api/mockup/jobs/[jobId]/cover", {
          method: "POST",
          body: JSON.stringify({ renderId: failedRender.id }),
        }),
        { params: { jobId: job.id } },
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("RENDER_NOT_SUCCESS");
    });

    it("400 ALREADY_COVER: aynı render'a swap no-op değil, açık reddet", async () => {
      const { set } = await makeReadySet({
        userId: userAId,
        productTypeId: (
          await db.productType.findUnique({
            where: { key: PRODUCT_TYPE_KEY },
          })
        )!.id,
        variantCount: 1,
      });

      const { binding } = await makeTemplateWithBinding();
      const { job, renders } = await makeJob({
        userId: userAId,
        setId: set.id,
        bindings: [binding],
      });

      const cover = renders[0]!;

      vi.mocked(requireUser).mockResolvedValueOnce({
        id: userAId,
      } as any);

      const res = await POST(
        new Request("http://test/api/mockup/jobs/[jobId]/cover", {
          method: "POST",
          body: JSON.stringify({ renderId: cover.id }),
        }),
        { params: { jobId: job.id } },
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("ALREADY_COVER");
    });
  });

  describe("404 cross-user", () => {
    it("404 cross-user: başka kullanıcının job'una swap fail", async () => {
      const { set } = await makeReadySet({
        userId: userAId,
        productTypeId: (
          await db.productType.findUnique({
            where: { key: PRODUCT_TYPE_KEY },
          })
        )!.id,
        variantCount: 2,
      });

      const bindings = await Promise.all(
        [0, 1].map(() => makeTemplateWithBinding().then((r) => r.binding)),
      );
      const { job, renders } = await makeJob({
        userId: userAId,
        setId: set.id,
        bindings,
      });

      // Try to swap as different user
      vi.mocked(requireUser).mockResolvedValueOnce({
        id: userBId,
      } as any);

      const res = await POST(
        new Request("http://test/api/mockup/jobs/[jobId]/cover", {
          method: "POST",
          body: JSON.stringify({ renderId: renders[1]!.id }),
        }),
        { params: { jobId: job.id } },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("Invariant preservation", () => {
    it("invariant: swap sonrası packPosition=0 olan render === coverRenderId", async () => {
      const { set } = await makeReadySet({
        userId: userAId,
        productTypeId: (
          await db.productType.findUnique({
            where: { key: PRODUCT_TYPE_KEY },
          })
        )!.id,
        variantCount: 4,
      });

      const bindings = await Promise.all(
        [0, 1, 2, 3].map(() => makeTemplateWithBinding().then((r) => r.binding)),
      );
      const { job, renders } = await makeJob({
        userId: userAId,
        setId: set.id,
        bindings,
      });

      // Swap to position 2
      const newCover = renders[2]!;

      vi.mocked(requireUser).mockResolvedValueOnce({
        id: userAId,
      } as any);

      await POST(
        new Request("http://test/api/mockup/jobs/[jobId]/cover", {
          method: "POST",
          body: JSON.stringify({ renderId: newCover.id }),
        }),
        { params: { jobId: job.id } },
      );

      // Verify invariant
      const updatedJob = await db.mockupJob.findUnique({
        where: { id: job.id },
        include: { renders: true },
      });

      const coverRenderInDb = updatedJob!.renders.find(
        (r) => r.id === updatedJob!.coverRenderId,
      );
      expect(coverRenderInDb!.packPosition).toBe(0);

      const renderAtPackPos0 = updatedJob!.renders.find(
        (r) => r.packPosition === 0,
      );
      expect(renderAtPackPos0!.id).toBe(updatedJob!.coverRenderId);
    });
  });
});
