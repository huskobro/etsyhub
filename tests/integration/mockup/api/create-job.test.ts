// Phase 8 Task 16 — POST /api/mockup/jobs integration testleri.
//
// Spec §4.1 sözleşmesi:
//   - Request body: CreateJobBodySchema (Task 3 — setId, categoryId="canvas",
//     templateIds 1..8)
//   - Response 202 Accepted: { jobId } (async BullMQ dispatch tamamlandı,
//     render lifecycle Task 7 worker'da)
//   - Error mapping (AppError.statusCode auto via withErrorHandling):
//       400 ValidationError (Zod safeParse fail — boş, > 8, kategori≠canvas)
//       400 InvalidTemplatesError (Task 5 — template not found / inactive)
//       404 SetNotFoundError (cross-user veya set yok)
//       409 InvalidSetError (status≠ready, set-level aspect fail)
//       409 TemplateInvalidError (resolveBinding null, no compatible pair)
//       401 UnauthorizedError (auth fail)
//
// Phase 7 emsali: tests/integration/selection/api/finalize.test.ts.
// Fixture pattern: tests/integration/mockup/handoff.test.ts'in helper'ları
// birebir adapte edildi (Task 5 emsali).

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

import { POST } from "@/app/api/mockup/jobs/route";
import { requireUser } from "@/server/session";

// ────────────────────────────────────────────────────────────
// Fixture sabitleri (handoff.test.ts paternini takip ediyor)
// ────────────────────────────────────────────────────────────

const TEST_CATEGORY_ID = "canvas";
const TEST_TPL_PREFIX = "phase8-api-create-";
const PRODUCT_TYPE_KEY = "phase8-api-create-pt";

let userAId: string;
let userBId: string;

// ────────────────────────────────────────────────────────────
// Fixture helpers (handoff.test.ts'ten adapte)
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
      displayName: "Phase8 API Create Wall Art",
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

async function makeReadySet(args: {
  userId: string;
  productTypeId: string;
  variantCount: number;
  designAspectRatio?: string | null;
  status?: "draft" | "ready" | "archived";
}) {
  const reference = await makeReference(args.userId, args.productTypeId);
  const set = await db.selectionSet.create({
    data: {
      userId: args.userId,
      name: "Phase8 API Create Set",
      status: args.status ?? "ready",
      finalizedAt: args.status === "draft" ? null : new Date(),
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
      tags: ["phase8-api-test"],
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

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/mockup/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ────────────────────────────────────────────────────────────
// Cleanup
// ────────────────────────────────────────────────────────────

async function cleanup() {
  const userIds = [userAId, userBId].filter(Boolean);
  await db.mockupRender.deleteMany({
    where: { job: { userId: { in: userIds } } },
  });
  await db.mockupJob.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.mockupTemplateBinding.deleteMany({
    where: { template: { name: { startsWith: TEST_TPL_PREFIX } } },
  });
  await db.mockupTemplate.deleteMany({
    where: { name: { startsWith: TEST_TPL_PREFIX } },
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
  const a = await ensureUser("phase8-api-create-a@etsyhub.local");
  const b = await ensureUser("phase8-api-create-b@etsyhub.local");
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
// Tests — Spec §4.1 senaryoları
// ────────────────────────────────────────────────────────────

describe("POST /api/mockup/jobs (Spec §4.1)", () => {
  it("202 with jobId on valid input (happy path)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 2,
    });
    const tpl = await makeTemplate({ name: "HappyTpl" });

    const res = await POST(
      makeRequest({
        setId: set.id,
        categoryId: "canvas",
        templateIds: [tpl.id],
      }),
    );

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();
    expect(typeof body.jobId).toBe("string");

    // DB doğrulaması — job gerçekten yaratıldı
    const job = await db.mockupJob.findUnique({ where: { id: body.jobId } });
    expect(job).not.toBeNull();
    expect(job!.userId).toBe(userAId);
    expect(job!.status).toBe("QUEUED");
  });

  it("400 ValidationError when templateIds empty (Zod min(1))", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });

    const res = await POST(
      makeRequest({
        setId: set.id,
        categoryId: "canvas",
        templateIds: [],
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION");
  });

  it("400 ValidationError when templateIds.length > 8 (Zod max(8))", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const fakeIds = Array.from({ length: 9 }, (_, i) => `tpl-${i}`);

    const res = await POST(
      makeRequest({
        setId: set.id,
        categoryId: "canvas",
        templateIds: fakeIds,
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION");
  });

  it("400 ValidationError when categoryId ≠ canvas (V1 sınırı)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "WrongCatTpl" });

    const res = await POST(
      makeRequest({
        setId: set.id,
        categoryId: "mug", // V1: sadece "canvas" kabul ediliyor
        templateIds: [tpl.id],
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION");
  });

  it("409 InvalidSetError when set status ≠ ready", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
      status: "draft",
    });
    const tpl = await makeTemplate({ name: "DraftRejTpl" });

    const res = await POST(
      makeRequest({
        setId: set.id,
        categoryId: "canvas",
        templateIds: [tpl.id],
      }),
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("INVALID_SET");
  });

  it("404 SetNotFoundError for cross-user", async () => {
    // Set userA'nın; auth userB.
    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    const tpl = await makeTemplate({ name: "CrossUserTpl" });

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userBId,
    });

    const res = await POST(
      makeRequest({
        setId: set.id,
        categoryId: "canvas",
        templateIds: [tpl.id],
      }),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("SET_NOT_FOUND");
  });

  it("409 TemplateInvalidError when template has no active binding", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userAId,
    });

    const productType = await makeProductType("2:3");
    const set = await makeReadySet({
      userId: userAId,
      productTypeId: productType.id,
      variantCount: 1,
    });
    // Template ACTIVE; binding DRAFT → resolveBinding null → TemplateInvalid
    const tpl = await makeTemplate({
      name: "NoBindingTpl",
      bindingStatus: "DRAFT",
    });

    const res = await POST(
      makeRequest({
        setId: set.id,
        categoryId: "canvas",
        templateIds: [tpl.id],
      }),
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("TEMPLATE_INVALID");
  });

  it("401 UnauthorizedError when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );

    const res = await POST(
      makeRequest({
        setId: "any-set",
        categoryId: "canvas",
        templateIds: ["any-tpl"],
      }),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });
});
