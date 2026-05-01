// Phase 8 Task 17 — GET /api/mockup/jobs/[jobId] integration testleri.
//
// Spec §4.2 sözleşmesi:
//   - Response 200: job + renders[] (templateSnapshot denormalized, ETA)
//   - Response 404: JOB_NOT_FOUND (cross-user veya yok, varlık sızıntısı yok)
//   - renders orderBy packPosition ASC
//   - estimatedCompletionAt V1: null (successRenders=0) | calculated (formula)
//
// Phase 7 emsali: tests/integration/selection/api/set-detail.test.ts.
// Fixture pattern: tests/integration/mockup/api/create-job.test.ts emsali.

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

import { GET } from "@/app/api/mockup/jobs/[jobId]/route";
import { requireUser } from "@/server/session";

// ────────────────────────────────────────────────────────────
// Fixture sabitleri
// ────────────────────────────────────────────────────────────

const TEST_CATEGORY_ID = "canvas";
const TEST_TPL_PREFIX = "phase8-api-get-job-";
const PRODUCT_TYPE_KEY = "phase8-api-get-job-pt";

let userAId: string;
let userBId: string;
let productTypeId: string;
let templateId: string;

// ────────────────────────────────────────────────────────────
// Fixture helpers (create-job.test.ts emsali)
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
      name: "Phase8 API Get Job Set",
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
        position: i,
        status: "selected",
      },
    });
  }

  return set;
}

async function makeTemplate(args: {
  name: string;
  categoryId: string;
  aspectRatios?: string[];
}) {
  return db.mockupTemplate.create({
    data: {
      categoryId: args.categoryId,
      name: args.name,
      thumbKey: `thumb-${args.name}`,
      aspectRatios: args.aspectRatios ?? ["2:3"],
      estimatedRenderMs: 5000,
    },
  });
}

async function makeBinding(templateId: string) {
  return db.mockupTemplateBinding.create({
    data: {
      templateId,
      providerId: "LOCAL_SHARP",
      status: "ACTIVE",
      config: { compositorType: "sharp" },
      estimatedRenderMs: 5000,
    },
  });
}

async function makeJobWithRenders(args: {
  userId: string;
  setId: string;
  templateIds: string[];
  successCount?: number;
  failedCount?: number;
  pendingCount?: number;
}) {
  const totalRenders = (args.successCount ?? 0) + (args.failedCount ?? 0) + (args.pendingCount ?? 0);

  const job = await db.mockupJob.create({
    data: {
      userId: args.userId,
      setId: args.setId,
      setSnapshotId: `snapshot-${Date.now()}`,
      categoryId: TEST_CATEGORY_ID,
      packSize: 10,
      actualPackSize: totalRenders,
      status: totalRenders === 0 ? "QUEUED" : "RUNNING",
      totalRenders,
      successRenders: args.successCount ?? 0,
      failedRenders: args.failedCount ?? 0,
      startedAt: totalRenders > 0 ? new Date() : null,
      completedAt: null,
    },
  });

  const now = new Date();
  const renders = [];

  // SUCCESS renders (packed position 0 ~ successCount-1)
  for (let i = 0; i < (args.successCount ?? 0); i++) {
    const startedAt = new Date(now.getTime() - 10000); // 10 saniye önce
    const completedAt = new Date(startedAt.getTime() + 5000); // 5 saniye boyunca render

    const render = await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId: `variant-${i}`,
        bindingId: `binding-${i}`,
        templateSnapshot: {
          templateName: "Test Template",
          aspectRatios: ["2:3"],
        },
        packPosition: i,
        selectionReason: "COVER" as const,
        status: "SUCCESS" as MockupRenderStatus,
        outputKey: `output-${job.id}-${i}`,
        thumbnailKey: `thumb-${job.id}-${i}`,
        retryCount: 0,
        startedAt,
        completedAt,
      },
    });
    renders.push(render);
  }

  // FAILED renders (packed position successCount ~ successCount+failedCount-1)
  for (let i = 0; i < (args.failedCount ?? 0); i++) {
    const idx = (args.successCount ?? 0) + i;
    const startedAt = new Date(now.getTime() - 5000);
    const completedAt = new Date(startedAt.getTime() + 3000);

    const render = await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId: `variant-${idx}`,
        bindingId: `binding-${idx}`,
        templateSnapshot: {
          templateName: "Test Template",
          aspectRatios: ["2:3"],
        },
        packPosition: idx,
        selectionReason: "TEMPLATE_DIVERSITY" as const,
        status: "FAILED" as MockupRenderStatus,
        errorClass: "RENDER_TIMEOUT",
        errorDetail: "Timeout exceeded",
        retryCount: 0,
        startedAt,
        completedAt,
      },
    });
    renders.push(render);
  }

  // PENDING renders (no packPosition)
  for (let i = 0; i < (args.pendingCount ?? 0); i++) {
    const idx = (args.successCount ?? 0) + (args.failedCount ?? 0) + i;
    const render = await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId: `variant-${idx}`,
        bindingId: `binding-${idx}`,
        templateSnapshot: {
          templateName: "Test Template",
          aspectRatios: ["2:3"],
        },
        packPosition: idx,
        selectionReason: "VARIANT_ROTATION" as const,
        status: "PENDING" as MockupRenderStatus,
        retryCount: 0,
      },
    });
    renders.push(render);
  }

  return { job, renders };
}

function makeGetRequest(jobId: string): Request {
  return new Request(`http://localhost/api/mockup/jobs/${jobId}`, {
    method: "GET",
  });
}

async function cleanup() {
  const userIds = [userAId, userBId];
  await db.mockupRender.deleteMany({
    where: { job: { userId: { in: userIds } } },
  });
  await db.mockupJob.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: userIds } } },
  });
  await db.selectionSet.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.designReview.deleteMany({
    where: { generatedDesign: { userId: { in: userIds } } },
  });
  await db.generatedDesign.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.reference.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.asset.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.mockupTemplateBinding.deleteMany({
    where: { template: { id: templateId } },
  });
  await db.mockupTemplate.deleteMany({
    where: { id: templateId },
  });
}

// ────────────────────────────────────────────────────────────
// beforeAll / afterAll
// ────────────────────────────────────────────────────────────

beforeAll(async () => {
  const a = await ensureUser("phase8-api-get-job-a@etsyhub.local");
  const b = await ensureUser("phase8-api-get-job-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;

  const pt = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "Phase8 API Get Job Wall Art",
      aspectRatio: "2:3",
      isSystem: false,
    },
  });
  productTypeId = pt.id;

  const tpl = await makeTemplate({
    name: `${TEST_TPL_PREFIX}template-1`,
    categoryId: TEST_CATEGORY_ID,
    aspectRatios: ["2:3"],
  });
  templateId = tpl.id;

  await makeBinding(tpl.id);
});

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  await cleanup();
});

// ────────────────────────────────────────────────────────────
// Tests (Spec §4.2 scenarios)
// ────────────────────────────────────────────────────────────

describe("GET /api/mockup/jobs/[jobId] (Phase 8 Task 17)", () => {
  it("200 with full job + renders payload", async () => {
    const set = await makeReadySet({
      userId: userAId,
      productTypeId,
      variantCount: 3,
    });
    const { job } = await makeJobWithRenders({
      userId: userAId,
      setId: set.id,
      templateIds: [templateId],
      successCount: 2,
      failedCount: 1,
    });

    vi.mocked(requireUser).mockResolvedValue({ id: userAId } as any);

    const res = await GET(makeGetRequest(job.id), {
      params: { jobId: job.id },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.id).toBe(job.id);
    expect(body.status).toBe("RUNNING");
    expect(body.packSize).toBe(10);
    expect(body.actualPackSize).toBe(3);
    expect(body.totalRenders).toBe(3);
    expect(body.successRenders).toBe(2);
    expect(body.failedRenders).toBe(1);
    expect(body.renders).toHaveLength(3);
  });

  it("includes templateSnapshot with denormalized name + aspectRatios", async () => {
    const set = await makeReadySet({
      userId: userAId,
      productTypeId,
      variantCount: 1,
    });
    const { job } = await makeJobWithRenders({
      userId: userAId,
      setId: set.id,
      templateIds: [templateId],
      successCount: 1,
    });

    vi.mocked(requireUser).mockResolvedValue({ id: userAId } as any);

    const res = await GET(makeGetRequest(job.id), {
      params: { jobId: job.id },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    const render = body.renders[0];
    expect(render.templateSnapshot).toBeDefined();
    expect(render.templateSnapshot.templateName).toBe("Test Template");
    expect(render.templateSnapshot.aspectRatios).toEqual(["2:3"]);
    // bindingId separate field olarak response'a eklenmemiş (scope discipline)
    expect(body.bindingId).toBeUndefined();
  });

  it("includes ETA estimate when successRenders > 0", async () => {
    const set = await makeReadySet({
      userId: userAId,
      productTypeId,
      variantCount: 3,
    });
    const { job } = await makeJobWithRenders({
      userId: userAId,
      setId: set.id,
      templateIds: [templateId],
      successCount: 2,
      pendingCount: 1,
    });

    vi.mocked(requireUser).mockResolvedValue({ id: userAId } as any);

    const res = await GET(makeGetRequest(job.id), {
      params: { jobId: job.id },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estimatedCompletionAt).toBeDefined();
    expect(body.estimatedCompletionAt).not.toBeNull();
    // ISO string parsable
    const eta = new Date(body.estimatedCompletionAt);
    expect(eta.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns null estimatedCompletionAt when no success yet", async () => {
    const set = await makeReadySet({
      userId: userAId,
      productTypeId,
      variantCount: 3,
    });
    const { job } = await makeJobWithRenders({
      userId: userAId,
      setId: set.id,
      templateIds: [templateId],
      pendingCount: 3,
    });

    vi.mocked(requireUser).mockResolvedValue({ id: userAId } as any);

    const res = await GET(makeGetRequest(job.id), {
      params: { jobId: job.id },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estimatedCompletionAt).toBeNull();
  });

  it("returns null estimatedCompletionAt when all renders complete", async () => {
    const set = await makeReadySet({
      userId: userAId,
      productTypeId,
      variantCount: 3,
    });
    const { job } = await makeJobWithRenders({
      userId: userAId,
      setId: set.id,
      templateIds: [templateId],
      successCount: 3,
    });

    vi.mocked(requireUser).mockResolvedValue({ id: userAId } as any);

    const res = await GET(makeGetRequest(job.id), {
      params: { jobId: job.id },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estimatedCompletionAt).toBeNull();
  });

  it("404 cross-user (different userId)", async () => {
    const set = await makeReadySet({
      userId: userAId,
      productTypeId,
      variantCount: 1,
    });
    const { job } = await makeJobWithRenders({
      userId: userAId,
      setId: set.id,
      templateIds: [templateId],
      pendingCount: 1,
    });

    // userB olarak eriş
    vi.mocked(requireUser).mockResolvedValue({ id: userBId } as any);

    const res = await GET(makeGetRequest(job.id), {
      params: { jobId: job.id },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("JOB_NOT_FOUND");
  });

  it("404 when jobId does not exist", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: userAId } as any);

    const res = await GET(makeGetRequest("non-existent-id"), {
      params: { jobId: "non-existent-id" },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("JOB_NOT_FOUND");
  });

  it("renders ordered by packPosition ASC", async () => {
    const set = await makeReadySet({
      userId: userAId,
      productTypeId,
      variantCount: 3,
    });
    const { job } = await makeJobWithRenders({
      userId: userAId,
      setId: set.id,
      templateIds: [templateId],
      successCount: 3,
    });

    vi.mocked(requireUser).mockResolvedValue({ id: userAId } as any);

    const res = await GET(makeGetRequest(job.id), {
      params: { jobId: job.id },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const positions = body.renders.map((r: any) => r.packPosition);
    // packPosition sıralı: 0, 1, 2, ...
    expect(positions).toEqual([0, 1, 2]);
  });

  it("401 when unauthenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());

    const res = await GET(makeGetRequest("some-id"), {
      params: { jobId: "some-id"},
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });
});
