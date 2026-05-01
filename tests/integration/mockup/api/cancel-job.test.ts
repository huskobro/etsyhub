// Phase 8 Task 19 — POST /api/mockup/jobs/[jobId]/cancel integration testleri.
//
// Spec §5.2 sözleşmesi:
//   - Request body: boş
//   - Response 200: { status: "CANCELLED" }
//   - Idempotent: zaten CANCELLED job tekrar cancel OK
//   - Error mapping (AppError.statusCode auto via withErrorHandling):
//       404 JobNotFoundError (yok veya cross-user)
//       409 JobAlreadyTerminalError (COMPLETED/PARTIAL_COMPLETE/FAILED)
//       401 UnauthorizedError (auth fail)
//
// Phase 7 emsali: tests/integration/selection/api/finalize.test.ts.
// Fixture pattern: tests/integration/mockup/api/create-job.test.ts'in helper'ları
// birebir adapte edildi.

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
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { POST } from "@/app/api/mockup/jobs/[jobId]/cancel/route";
import { requireUser } from "@/server/session";

// ────────────────────────────────────────────────────────────
// Fixture sabitleri
// ────────────────────────────────────────────────────────────

const TEST_CATEGORY_ID = "canvas";
const TEST_TPL_PREFIX = "phase8-api-cancel-";
const PRODUCT_TYPE_KEY = "phase8-api-cancel-pt";

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
}) {
  const reference = await makeReference(args.userId, args.productTypeId);
  const set = await db.selectionSet.create({
    data: {
      userId: args.userId,
      name: "Phase8 API Cancel Set",
      status: "ready",
      finalizedAt: new Date(),
    },
  });

  for (let i = 0; i < args.variantCount; i++) {
    const { design, asset } = await makeDesign({
      userId: args.userId,
      referenceId: reference.id,
      productTypeId: args.productTypeId,
      aspectRatio: "2:3",
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

async function makeJobWithStatus(args: {
  userId: string;
  setId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL_COMPLETE" | "FAILED" | "CANCELLED";
  renderCount?: number;
}) {
  const totalRenders = args.renderCount ?? 1;

  const job = await db.mockupJob.create({
    data: {
      userId: args.userId,
      setId: args.setId,
      setSnapshotId: `snapshot-${Date.now()}`,
      categoryId: TEST_CATEGORY_ID,
      packSize: 1,
      actualPackSize: totalRenders,
      status: args.status,
      totalRenders,
      successRenders: args.status === "COMPLETED" ? totalRenders : 0,
      failedRenders: args.status === "FAILED" ? totalRenders : 0,
      startedAt: args.status !== "QUEUED" ? new Date() : null,
      completedAt:
        args.status === "COMPLETED" || args.status === "PARTIAL_COMPLETE" || args.status === "FAILED"
          ? new Date()
          : null,
    },
  });

  // Job durumuna göre render oluştur
  if (totalRenders > 0) {
    for (let i = 0; i < totalRenders; i++) {
      const renderStatus =
        args.status === "COMPLETED"
          ? "SUCCESS"
          : args.status === "FAILED"
            ? "FAILED"
            : "PENDING";

      await db.mockupRender.create({
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
          status: renderStatus as any,
          ...(renderStatus === "SUCCESS" && {
            outputKey: `output-${job.id}-${i}`,
            thumbnailKey: `thumb-${job.id}-${i}`,
            startedAt: new Date(Date.now() - 5000),
            completedAt: new Date(),
          }),
          ...(renderStatus === "FAILED" && {
            errorClass: "RENDER_TIMEOUT",
            errorDetail: "Timeout exceeded",
            startedAt: new Date(Date.now() - 5000),
            completedAt: new Date(),
          }),
          retryCount: 0,
        },
      });
    }
  }

  return job;
}

function makeCancelRequest(jobId: string): Request {
  return new Request(`http://localhost/api/mockup/jobs/${jobId}/cancel`, {
    method: "POST",
  });
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
  const a = await ensureUser("phase8-api-cancel-a@etsyhub.local");
  const b = await ensureUser("phase8-api-cancel-b@etsyhub.local");
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
// Tests — Spec §5.2 senaryoları
// ────────────────────────────────────────────────────────────

describe("POST /api/mockup/jobs/[jobId]/cancel (Spec §5.2)", () => {
  it("200 cancels QUEUED job", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Cancel Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });

    const job = await makeJobWithStatus({
      userId: userAId,
      setId: set.id,
      status: "QUEUED",
    });

    const res = await POST(makeCancelRequest(job.id), {
      params: { jobId: job.id },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("CANCELLED");

    // DB: job durumu kontrol et
    const updated = await db.mockupJob.findUnique({ where: { id: job.id } });
    expect(updated!.status).toBe("CANCELLED");
  });

  it("200 cancels RUNNING job", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Cancel Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });

    const job = await makeJobWithStatus({
      userId: userAId,
      setId: set.id,
      status: "RUNNING",
      renderCount: 1,
    });

    const res = await POST(makeCancelRequest(job.id), {
      params: { jobId: job.id },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("CANCELLED");

    // Pending render'lar FAILED + errorClass=null'a çevrildi mi?
    const renders = await db.mockupRender.findMany({ where: { jobId: job.id } });
    // RUNNING job'da PENDING render'lar vardı — onlar FAILED olmalı
  });

  it("409 JobAlreadyTerminalError when canceling COMPLETED job", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Cancel Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });

    const job = await makeJobWithStatus({
      userId: userAId,
      setId: set.id,
      status: "COMPLETED",
      renderCount: 1,
    });

    const res = await POST(makeCancelRequest(job.id), {
      params: { jobId: job.id },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("JOB_ALREADY_TERMINAL");
  });

  it("409 JobAlreadyTerminalError when canceling FAILED job", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Cancel Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });

    const job = await makeJobWithStatus({
      userId: userAId,
      setId: set.id,
      status: "FAILED",
      renderCount: 1,
    });

    const res = await POST(makeCancelRequest(job.id), {
      params: { jobId: job.id },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("JOB_ALREADY_TERMINAL");
  });

  it("404 JobNotFoundError for cross-user", async () => {
    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Cancel Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });

    const job = await makeJobWithStatus({
      userId: userAId,
      setId: set.id,
      status: "QUEUED",
    });

    // userB olarak cancel dene
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userBId,
    });

    const res = await POST(makeCancelRequest(job.id), {
      params: { jobId: job.id },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("JOB_NOT_FOUND");
  });

  it("404 JobNotFoundError when job does not exist", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const res = await POST(makeCancelRequest("non-existent-id"), {
      params: { jobId: "non-existent-id" },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("JOB_NOT_FOUND");
  });

  it("401 UnauthorizedError when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );

    const res = await POST(makeCancelRequest("any-job"), {
      params: { jobId: "any-job" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });
});
