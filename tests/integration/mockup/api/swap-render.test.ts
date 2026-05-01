// Phase 8 Task 19 — POST /api/mockup/renders/[renderId]/swap integration testleri.
//
// Spec §4.4 sözleşmesi:
//   - Request body: boş
//   - Response 200: { status: "PENDING", newRenderId }
//   - Service checks (Task 18):
//       - Render FAILED mi? (RenderNotFailedError 409)
//       - Pack'te alternatif (variantId, bindingId) pair var mı?
//         (NoAlternativePairError 409)
//       - Cross-user / yok → RenderNotFoundError (404)
//   - Aksiyon:
//       - Eski render: packPosition=null (arşivlenir)
//       - Yeni render: PENDING, aynı packPosition, aynı selectionReason
//       - BullMQ dispatch
//   - Error mapping (AppError.statusCode auto via withErrorHandling):
//       404 RenderNotFoundError (yok veya cross-user)
//       409 RenderNotFailedError (SUCCESS/PENDING/RENDERING status)
//       409 NoAlternativePairError (pack'te kalan pair yok)
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

import { POST } from "@/app/api/mockup/renders/[renderId]/swap/route";
import { requireUser } from "@/server/session";

// ────────────────────────────────────────────────────────────
// Fixture sabitleri
// ────────────────────────────────────────────────────────────

const TEST_CATEGORY_ID = "canvas";
const PRODUCT_TYPE_KEY = "phase8-api-swap-pt";

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
  variantCount: number;
}) {
  const reference = await makeReference(args.userId, args.productTypeId);
  const set = await db.selectionSet.create({
    data: {
      userId: args.userId,
      name: "Phase8 API Swap Set",
      status: "ready",
      finalizedAt: new Date(),
    },
  });

  for (let i = 0; i < args.variantCount; i++) {
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
        position: i,
        status: "selected",
      },
    });
  }

  return set;
}

async function makeJob(args: {
  userId: string;
  setId: string;
  totalRenders: number;
}) {
  return db.mockupJob.create({
    data: {
      userId: args.userId,
      setId: args.setId,
      setSnapshotId: `snapshot-${Date.now()}`,
      categoryId: TEST_CATEGORY_ID,
      packSize: args.totalRenders,
      actualPackSize: args.totalRenders,
      status: "RUNNING",
      totalRenders: args.totalRenders,
      successRenders: 0,
      failedRenders: 0,
      startedAt: new Date(),
    },
  });
}

async function makeRender(args: {
  jobId: string;
  variantId: string;
  bindingId: string;
  packPosition: number;
  status: MockupRenderStatus;
  errorClass?: string;
}) {
  return db.mockupRender.create({
    data: {
      jobId: args.jobId,
      variantId: args.variantId,
      bindingId: args.bindingId,
      templateSnapshot: {
        templateName: "Test Template",
        aspectRatios: ["2:3"],
      },
      packPosition: args.packPosition,
      selectionReason: "COVER" as const,
      status: args.status,
      ...(args.status === "SUCCESS" && {
        outputKey: `output-${args.variantId}`,
        thumbnailKey: `thumb-${args.variantId}`,
        startedAt: new Date(Date.now() - 5000),
        completedAt: new Date(),
      }),
      ...(args.status === "FAILED" && {
        errorClass: args.errorClass,
        errorDetail: "Test error",
        startedAt: new Date(Date.now() - 5000),
        completedAt: new Date(),
      }),
      retryCount: 0,
    },
  });
}

function makeSwapRequest(renderId: string): Request {
  return new Request(
    `http://localhost/api/mockup/renders/${renderId}/swap`,
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
  const a = await ensureUser("phase8-api-swap-a@etsyhub.local");
  const b = await ensureUser("phase8-api-swap-b@etsyhub.local");
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
// Tests — Spec §4.4 senaryoları
// ────────────────────────────────────────────────────────────

describe("POST /api/mockup/renders/[renderId]/swap (Spec §4.4)", () => {
  it("200 swaps FAILED render with alternative pair available", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Swap Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    // 3 variant, 2 binding → 6 pair olası
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 3,
    });

    const job = await makeJob({
      userId: userAId,
      setId: set.id,
      totalRenders: 3, // pack 3 render alabilir
    });

    // packPosition 0, 1, 2 — bundan variant-0/binding-0, variant-1/binding-0, variant-2/binding-0 seçilmiş
    const render0 = await makeRender({
      jobId: job.id,
      variantId: "variant-0",
      bindingId: "binding-0",
      packPosition: 0,
      status: "FAILED",
      errorClass: "TEMPLATE_INVALID",
    });

    const render1 = await makeRender({
      jobId: job.id,
      variantId: "variant-1",
      bindingId: "binding-0",
      packPosition: 1,
      status: "SUCCESS",
    });

    const render2 = await makeRender({
      jobId: job.id,
      variantId: "variant-2",
      bindingId: "binding-0",
      packPosition: 2,
      status: "SUCCESS",
    });

    const res = await POST(makeSwapRequest(render0.id), {
      params: { renderId: render0.id },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("PENDING");
    expect(body.newRenderId).toBeTruthy();

    // DB: eski render packPosition=null olmalı
    const oldRender = await db.mockupRender.findUnique({
      where: { id: render0.id },
    });
    expect(oldRender!.packPosition).toBeNull();

    // Yeni render var mı, status PENDING?
    const newRender = await db.mockupRender.findUnique({
      where: { id: body.newRenderId },
    });
    expect(newRender!.status).toBe("PENDING");
    expect(newRender!.packPosition).toBe(0); // eski packPosition kopyası
  });

  it("409 RenderNotFailedError when swap SUCCESS render", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Swap Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });

    const job = await makeJob({
      userId: userAId,
      setId: set.id,
      totalRenders: 1,
    });

    const render = await makeRender({
      jobId: job.id,
      variantId: "variant-1",
      bindingId: "binding-1",
      packPosition: 0,
      status: "SUCCESS",
    });

    const res = await POST(makeSwapRequest(render.id), {
      params: { renderId: render.id },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("RENDER_NOT_FAILED");
  });

  it("409 NoAlternativePairError when no alternative pair left", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Swap Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1, // 1 variant sadece
    });

    const job = await makeJob({
      userId: userAId,
      setId: set.id,
      totalRenders: 1,
    });

    // 1 variant, 1 binding → sadece 1 pair olası, kullanıldı
    const render = await makeRender({
      jobId: job.id,
      variantId: "variant-0",
      bindingId: "binding-0",
      packPosition: 0,
      status: "FAILED",
      errorClass: "TEMPLATE_INVALID",
    });

    const res = await POST(makeSwapRequest(render.id), {
      params: { renderId: render.id },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NO_ALTERNATIVE_PAIR");
  });

  it("404 RenderNotFoundError for cross-user", async () => {
    const productType = await db.productType.upsert({
      where: { key: PRODUCT_TYPE_KEY },
      update: {},
      create: {
        key: PRODUCT_TYPE_KEY,
        displayName: "Phase8 API Swap Wall Art",
        aspectRatio: "2:3",
        isSystem: false,
      },
    });

    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 2,
    });

    const job = await makeJob({
      userId: userAId,
      setId: set.id,
      totalRenders: 2,
    });

    const render = await makeRender({
      jobId: job.id,
      variantId: "variant-0",
      bindingId: "binding-0",
      packPosition: 0,
      status: "FAILED",
      errorClass: "TEMPLATE_INVALID",
    });

    // userB olarak swap dene
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userBId,
    });

    const res = await POST(makeSwapRequest(render.id), {
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

    const res = await POST(makeSwapRequest("non-existent-id"), {
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

    const res = await POST(makeSwapRequest("any-render"), {
      params: { renderId: "any-render" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });
});
