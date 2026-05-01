// Phase 8 Task 1 — MockupTemplate / MockupTemplateBinding / MockupJob /
// MockupRender Prisma şema integration testleri.
//
// Sözleşme (spec §3.1):
//   - MockupTemplate: status default DRAFT, aspectRatios + tags String[],
//     bindings 1-N ilişki.
//   - MockupTemplateBinding: @@unique([templateId, providerId]),
//     onDelete: Cascade (template silinirse binding'leri de gider).
//   - MockupJob: userId → User (Restrict), setId → SelectionSet (Restrict);
//     coverRenderId nullable; renders 1-N (Cascade).
//   - MockupRender: jobId → MockupJob (Cascade); packPosition nullable
//     (arşivlenmiş swap için); enum'lar geçerli value'ları kabul eder.
//
// Bu testler Task 1 migration (`phase8_mockup`) uygulandıktan sonra PASS
// olmalıdır. Migration uygulanmadan önce Prisma client'da Mockup* tipi
// olmadığı için TypeScript compile aşamasında dahi fail olabilir — bu
// beklenen TDD davranışıdır (red → green).

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";

const USER_ID = "phase8-schema-user";
const SET_ID = "phase8-schema-set";

async function setupBaseFixtures() {
  await db.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: {
      id: USER_ID,
      email: "phase8-schema@test.local",
      passwordHash: "x",
    },
  });

  await db.selectionSet.upsert({
    where: { id: SET_ID },
    update: {},
    create: {
      id: SET_ID,
      userId: USER_ID,
      name: "Phase 8 Schema Test Set",
      status: "ready",
    },
  });
}

async function cleanupMockup() {
  // Render'lar Cascade ile düşer; ama izolasyon için açıkça temizliyoruz.
  await db.mockupRender.deleteMany({ where: { job: { userId: USER_ID } } });
  await db.mockupJob.deleteMany({ where: { userId: USER_ID } });
  await db.mockupTemplateBinding.deleteMany({
    where: { template: { categoryId: "phase8-schema-test" } },
  });
  await db.mockupTemplate.deleteMany({
    where: { categoryId: "phase8-schema-test" },
  });
}

beforeEach(async () => {
  await cleanupMockup();
});

afterAll(async () => {
  await cleanupMockup();
});

describe("Phase 8 schema — MockupTemplate / Binding / Job / Render", () => {
  it("creates MockupTemplate with active LOCAL_SHARP binding (relation + cascade)", async () => {
    const tpl = await db.mockupTemplate.create({
      data: {
        categoryId: "phase8-schema-test",
        name: "Test Canvas Template",
        status: "ACTIVE",
        thumbKey: "thumbs/phase8-test.png",
        aspectRatios: ["2:3", "3:4"],
        tags: ["modern", "test"],
        estimatedRenderMs: 2000,
        bindings: {
          create: {
            providerId: "LOCAL_SHARP",
            status: "ACTIVE",
            config: {
              providerId: "local-sharp",
              baseAssetKey: "x.png",
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

    expect(tpl.id).toBeTruthy();
    expect(tpl.status).toBe("ACTIVE");
    expect(tpl.aspectRatios).toEqual(["2:3", "3:4"]);
    expect(tpl.tags).toEqual(["modern", "test"]);
    expect(tpl.estimatedRenderMs).toBe(2000);
    expect(tpl.bindings).toHaveLength(1);
    expect(tpl.bindings[0]?.providerId).toBe("LOCAL_SHARP");
    expect(tpl.bindings[0]?.version).toBe(1);
    expect(tpl.bindings[0]?.status).toBe("ACTIVE");
  });

  it("MockupTemplate default status DRAFT + archivedAt nullable", async () => {
    const tpl = await db.mockupTemplate.create({
      data: {
        categoryId: "phase8-schema-test",
        name: "Default Status Template",
        thumbKey: "thumbs/default.png",
        aspectRatios: ["2:3"],
        tags: [],
        estimatedRenderMs: 1500,
      },
    });

    expect(tpl.status).toBe("DRAFT");
    expect(tpl.archivedAt).toBeNull();
    expect(tpl.createdAt).toBeInstanceOf(Date);
    expect(tpl.updatedAt).toBeInstanceOf(Date);
  });

  it("enforces @@unique([templateId, providerId]) — duplicate binding reject", async () => {
    const tpl = await db.mockupTemplate.create({
      data: {
        categoryId: "phase8-schema-test",
        name: "Unique Binding Template",
        thumbKey: "thumbs/unique.png",
        aspectRatios: ["2:3"],
        tags: [],
        estimatedRenderMs: 1500,
      },
    });

    await db.mockupTemplateBinding.create({
      data: {
        templateId: tpl.id,
        providerId: "LOCAL_SHARP",
        config: { providerId: "local-sharp" },
        estimatedRenderMs: 1500,
      },
    });

    await expect(
      db.mockupTemplateBinding.create({
        data: {
          templateId: tpl.id,
          providerId: "LOCAL_SHARP",
          config: { providerId: "local-sharp" },
          estimatedRenderMs: 1500,
        },
      }),
    ).rejects.toThrow();
  });

  it("MockupTemplateBinding cascade delete — template silinince binding'leri de düşer", async () => {
    const tpl = await db.mockupTemplate.create({
      data: {
        categoryId: "phase8-schema-test",
        name: "Cascade Template",
        thumbKey: "thumbs/cascade.png",
        aspectRatios: ["2:3"],
        tags: [],
        estimatedRenderMs: 1500,
        bindings: {
          create: {
            providerId: "LOCAL_SHARP",
            config: { providerId: "local-sharp" },
            estimatedRenderMs: 1500,
          },
        },
      },
      include: { bindings: true },
    });

    const bindingId = tpl.bindings[0]!.id;

    await db.mockupTemplate.delete({ where: { id: tpl.id } });

    const binding = await db.mockupTemplateBinding.findUnique({
      where: { id: bindingId },
    });
    expect(binding).toBeNull();
  });

  it("creates MockupJob with N MockupRender via cascade", async () => {
    await setupBaseFixtures();

    const tpl = await db.mockupTemplate.create({
      data: {
        categoryId: "phase8-schema-test",
        name: "Job Test Template",
        thumbKey: "thumbs/job.png",
        aspectRatios: ["2:3"],
        tags: [],
        estimatedRenderMs: 2000,
        bindings: {
          create: {
            providerId: "LOCAL_SHARP",
            status: "ACTIVE",
            config: { providerId: "local-sharp" },
            estimatedRenderMs: 2000,
          },
        },
      },
      include: { bindings: true },
    });
    const bindingId = tpl.bindings[0]!.id;

    const job = await db.mockupJob.create({
      data: {
        userId: USER_ID,
        setId: SET_ID,
        setSnapshotId: "sha256:phase8-schema-snap",
        categoryId: "canvas",
        status: "QUEUED",
        packSize: 10,
        actualPackSize: 2,
        totalRenders: 2,
        renders: {
          create: [
            {
              variantId: "phase8-variant-a",
              bindingId,
              templateSnapshot: { templateId: tpl.id, version: 1 },
              packPosition: 0,
              selectionReason: "COVER",
              status: "PENDING",
            },
            {
              variantId: "phase8-variant-b",
              bindingId,
              templateSnapshot: { templateId: tpl.id, version: 1 },
              packPosition: 1,
              selectionReason: "TEMPLATE_DIVERSITY",
              status: "PENDING",
            },
          ],
        },
      },
      include: { renders: true },
    });

    expect(job.id).toBeTruthy();
    expect(job.status).toBe("QUEUED");
    expect(job.coverRenderId).toBeNull();
    expect(job.successRenders).toBe(0);
    expect(job.failedRenders).toBe(0);
    expect(job.errorSummary).toBeNull();
    expect(job.startedAt).toBeNull();
    expect(job.completedAt).toBeNull();
    expect(job.renders).toHaveLength(2);

    const renderIds = job.renders.map((r) => r.id);

    await db.mockupJob.delete({ where: { id: job.id } });

    const remaining = await db.mockupRender.findMany({
      where: { id: { in: renderIds } },
    });
    expect(remaining).toHaveLength(0);
  });

  it("MockupRender.packPosition nullable — arşivlenmiş swap için", async () => {
    await setupBaseFixtures();

    const tpl = await db.mockupTemplate.create({
      data: {
        categoryId: "phase8-schema-test",
        name: "Archive Swap Template",
        thumbKey: "thumbs/archive.png",
        aspectRatios: ["2:3"],
        tags: [],
        estimatedRenderMs: 1500,
        bindings: {
          create: {
            providerId: "LOCAL_SHARP",
            config: { providerId: "local-sharp" },
            estimatedRenderMs: 1500,
          },
        },
      },
      include: { bindings: true },
    });
    const bindingId = tpl.bindings[0]!.id;

    const job = await db.mockupJob.create({
      data: {
        userId: USER_ID,
        setId: SET_ID,
        setSnapshotId: "sha256:phase8-archive-snap",
        categoryId: "canvas",
        status: "RUNNING",
        packSize: 10,
        actualPackSize: 1,
        totalRenders: 1,
      },
    });

    const archived = await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId: "phase8-variant-archived",
        bindingId,
        templateSnapshot: { templateId: tpl.id, version: 1 },
        packPosition: null,
        selectionReason: "VARIANT_ROTATION",
        status: "SUCCESS",
      },
    });

    expect(archived.packPosition).toBeNull();
    expect(archived.selectionReason).toBe("VARIANT_ROTATION");
    expect(archived.retryCount).toBe(0);
    expect(archived.outputKey).toBeNull();
    expect(archived.thumbnailKey).toBeNull();
    expect(archived.errorClass).toBeNull();
    expect(archived.errorDetail).toBeNull();
  });

  it("MockupJob enum values — QUEUED/RUNNING/COMPLETED/PARTIAL_COMPLETE/FAILED/CANCELLED kabul edilir", async () => {
    await setupBaseFixtures();

    const states = [
      "QUEUED",
      "RUNNING",
      "COMPLETED",
      "PARTIAL_COMPLETE",
      "FAILED",
      "CANCELLED",
    ] as const;

    for (const status of states) {
      const job = await db.mockupJob.create({
        data: {
          userId: USER_ID,
          setId: SET_ID,
          setSnapshotId: `sha256:phase8-state-${status}`,
          categoryId: "canvas",
          status,
          packSize: 10,
          actualPackSize: 0,
          totalRenders: 0,
        },
      });
      expect(job.status).toBe(status);
    }
  });

  it("MockupErrorClass + MockupRenderStatus enum — geçerli value'ları kabul eder", async () => {
    await setupBaseFixtures();

    const tpl = await db.mockupTemplate.create({
      data: {
        categoryId: "phase8-schema-test",
        name: "Enum Render Template",
        thumbKey: "thumbs/enum.png",
        aspectRatios: ["2:3"],
        tags: [],
        estimatedRenderMs: 1500,
        bindings: {
          create: {
            providerId: "LOCAL_SHARP",
            config: { providerId: "local-sharp" },
            estimatedRenderMs: 1500,
          },
        },
      },
      include: { bindings: true },
    });
    const bindingId = tpl.bindings[0]!.id;

    const job = await db.mockupJob.create({
      data: {
        userId: USER_ID,
        setId: SET_ID,
        setSnapshotId: "sha256:phase8-enum-snap",
        categoryId: "canvas",
        status: "RUNNING",
        packSize: 10,
        actualPackSize: 1,
        totalRenders: 1,
      },
    });

    const failed = await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId: "phase8-variant-failed",
        bindingId,
        templateSnapshot: { templateId: tpl.id, version: 1 },
        packPosition: 5,
        selectionReason: "TEMPLATE_DIVERSITY",
        status: "FAILED",
        errorClass: "RENDER_TIMEOUT",
        errorDetail: "exceeded 30s budget",
        retryCount: 2,
      },
    });

    expect(failed.status).toBe("FAILED");
    expect(failed.errorClass).toBe("RENDER_TIMEOUT");
    expect(failed.retryCount).toBe(2);
  });

  it("MockupJob FK — orphan setId reject edilir (Restrict)", async () => {
    await db.user.upsert({
      where: { id: USER_ID },
      update: {},
      create: {
        id: USER_ID,
        email: "phase8-schema@test.local",
        passwordHash: "x",
      },
    });

    await expect(
      db.mockupJob.create({
        data: {
          userId: USER_ID,
          setId: "phase8-nonexistent-set-id",
          setSnapshotId: "sha256:orphan",
          categoryId: "canvas",
          status: "QUEUED",
          packSize: 10,
          actualPackSize: 0,
          totalRenders: 0,
        },
      }),
    ).rejects.toThrow();
  });
});
