// Phase 8 Task 19 — POST /api/mockup/renders/[renderId]/retry integration testleri.
//
// Spec §4.5 sözleşmesi:
//   - Request body: boş
//   - Response 200: { status: "PENDING", retryCount }
//   - Service checks (Task 18):
//       - Render FAILED mi? (RenderNotFailedError 409)
//       - retryCount < 3? (RetryCapExceededError 409)
//       - errorClass RENDER_TIMEOUT/PROVIDER_DOWN mi? (RenderNotRetryableError 409)
//       - Cross-user / yok → RenderNotFoundError (404)
//   - Aksiyon: retryCount++, status → PENDING, BullMQ dispatch
//   - Error mapping (AppError.statusCode auto via withErrorHandling):
//       404 RenderNotFoundError (yok veya cross-user)
//       409 RenderNotFailedError (SUCCESS/PENDING/RENDERING status)
//       409 RetryCapExceededError (retryCount >= 3)
//       409 RenderNotRetryableError (TEMPLATE_INVALID, SAFE_AREA_OVERFLOW, SOURCE_QUALITY)
//       401 UnauthorizedError (auth fail)
//
// Phase 7 emsali: tests/integration/selection/api/...
// Fixture pattern: tests/integration/mockup/api/create-job.test.ts

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

import { POST } from "@/app/api/mockup/renders/[renderId]/retry/route";
import { requireUser } from "@/server/session";

// ────────────────────────────────────────────────────────────
// Fixture sabitleri
// ────────────────────────────────────────────────────────────

const TEST_CATEGORY_ID = "canvas";
const PRODUCT_TYPE_KEY = "phase8-api-retry-pt";

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

async function makeReadySet(args: {
  userId: string;
  productTypeId: string;
}) {
  const reference = await makeReference(args.userId, args.productTypeId);
  const set = await db.selectionSet.create({
    data: {
      userId: args.userId,
      name: "Phase8 API Retry Set",
      status: "ready",
      finalizedAt: new Date(),
    },
  });

  const { design, asset } = await makeDesign({
    userId: args.userId,
    referenceId: reference.id,
    productTypeId: args.productTypeId,
  });

  await db.selectionItem.create({
    data: {
      selectionSetId: set.id,
      generatedDesignId: design.id,
      sourceAssetId: asset.id,
      position: 0,
      status: "selected",
    },
  });

  return set;
}

async function makeJob(args: { userId: string; setId: string }) {
  return db.mockupJob.create({
    data: {
      userId: args.userId,
      setId: args.setId,
      setSnapshotId: `snapshot-${Date.now()}`,
      categoryId: TEST_CATEGORY_ID,
      packSize: 1,
      actualPackSize: 1,
      status: "RUNNING",
      totalRenders: 1,
      successRenders: 0,
      failedRenders: 0,
      startedAt: new Date(),
    },
  });
}

async function makeFailedRender(args: {
  jobId: string;
  errorClass: string;
  retryCount?: number;
}) {
  return db.mockupRender.create({
    data: {
      jobId: args.jobId,
      variantId: "variant-1",
      bindingId: "binding-1",
      templateSnapshot: {
        templateName: "Test Template",
        aspectRatios: ["2:3"],
      },
      packPosition: 0,
      selectionReason: "COVER" as const,
      status: "FAILED" as MockupRenderStatus,
      errorClass: args.errorClass,
      errorDetail: "Test error",
      retryCount: args.retryCount ?? 0,
      startedAt: new Date(Date.now() - 5000),
      completedAt: new Date(),
    },
  });
}

function makeRetryRequest(renderId: string): Request {
  return new Request(
    `http://localhost/api/mockup/renders/${renderId}/retry`,
    {
      method: "POST",
    }
  );
}

async function cleanup() {
  const userIds = [userAId, userBId].filter(Boolean);
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
  await db.generatedDesign.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.reference.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.asset.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.productType.deleteMany({
    where: { key: PRODUCT_TYPE_KEY },
  });
}

beforeAll(async () => {
  const a = await ensureUser("phase8-api-retry-a@etsyhub.local");
  const b = await ensureUser("phase8-api-retry-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;
});

beforeEach(async () => {
  (requireUser as ReturnType<typeof vi.fn>).mockReset();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

// ────────────────────────────────────────────────────────────
// Tests — Spec §4.5 senaryoları
// ────────────────────────────────────────────────────────────

describe("POST /api/mockup/renders/[renderId]/retry (Spec §4.5)", () => {
  it("200 retries FAILED render with transient error (RENDER_TIMEOUT)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Retry Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
    });

    const job = await makeJob({
      userId: userAId,
      setId: set.id,
    });

    const render = await makeFailedRender({
      jobId: job.id,
      errorClass: "RENDER_TIMEOUT",
      retryCount: 0,
    });

    const res = await POST(makeRetryRequest(render.id), {
      params: { renderId: render.id },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("PENDING");
    expect(body.retryCount).toBe(1);

    // DB: render durumu kontrol et
    const updated = await db.mockupRender.findUnique({
      where: { id: render.id },
    });
    expect(updated!.status).toBe("PENDING");
    expect(updated!.retryCount).toBe(1);
  });

  it("200 retries FAILED render with PROVIDER_DOWN", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Retry Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
    });

    const job = await makeJob({
      userId: userAId,
      setId: set.id,
    });

    const render = await makeFailedRender({
      jobId: job.id,
      errorClass: "PROVIDER_DOWN",
      retryCount: 1,
    });

    const res = await POST(makeRetryRequest(render.id), {
      params: { renderId: render.id },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.retryCount).toBe(2);
  });

  it("409 RenderNotFailedError when retry SUCCESS render", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Retry Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
    });

    const job = await makeJob({
      userId: userAId,
      setId: set.id,
    });

    const render = await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId: "variant-1",
        bindingId: "binding-1",
        templateSnapshot: {
          templateName: "Test Template",
          aspectRatios: ["2:3"],
        },
        packPosition: 0,
        selectionReason: "COVER" as const,
        status: "SUCCESS" as MockupRenderStatus,
        outputKey: "output-1",
        thumbnailKey: "thumb-1",
        retryCount: 0,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    const res = await POST(makeRetryRequest(render.id), {
      params: { renderId: render.id },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("RENDER_NOT_FAILED");
  });

  it("409 RetryCapExceededError when retryCount >= 3", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Retry Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
    });

    const job = await makeJob({
      userId: userAId,
      setId: set.id,
    });

    const render = await makeFailedRender({
      jobId: job.id,
      errorClass: "RENDER_TIMEOUT",
      retryCount: 3,
    });

    const res = await POST(makeRetryRequest(render.id), {
      params: { renderId: render.id },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("RETRY_CAP_EXCEEDED");
  });

  it("409 RenderNotRetryableError when errorClass=TEMPLATE_INVALID", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Retry Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
    });

    const job = await makeJob({
      userId: userAId,
      setId: set.id,
    });

    const render = await makeFailedRender({
      jobId: job.id,
      errorClass: "TEMPLATE_INVALID",
      retryCount: 0,
    });

    const res = await POST(makeRetryRequest(render.id), {
      params: { renderId: render.id },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("RENDER_NOT_RETRYABLE");
  });

  it("404 RenderNotFoundError for cross-user", async () => {
    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Retry Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
    });

    const job = await makeJob({
      userId: userAId,
      setId: set.id,
    });

    const render = await makeFailedRender({
      jobId: job.id,
      errorClass: "RENDER_TIMEOUT",
    });

    // userB olarak retry dene
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userBId,
    });

    const res = await POST(makeRetryRequest(render.id), {
      params: { renderId: render.id },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("RENDER_NOT_FOUND");
  });

  it("404 RenderNotFoundError when render does not exist", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const res = await POST(makeRetryRequest("non-existent-id"), {
      params: { renderId: "non-existent-id" },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("RENDER_NOT_FOUND");
  });

  it("401 UnauthorizedError when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );

    const res = await POST(makeRetryRequest("any-render"), {
      params: { renderId: "any-render" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });
});
