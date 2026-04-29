// Phase 6 Task 14 — GET /api/review/queue integration testleri.
//
// Sözleşme:
//   - Auth: requireUser mock'lanır, eksikse 401.
//   - scope ZORUNLU; geçersiz değer / scope yokluğu => 400.
//   - status filter sadece geldiğinde kullanılır.
//   - Multi-tenant: başka user'ın kayıtları sızmaz.
//   - Soft-delete:
//       design: deletedAt IS NULL
//       local:  deletedAt IS NULL AND isUserDeleted = false
//   - Pagination: 24 item/page; total + page + pageSize döner.
//   - Storage signedUrl mock'lanır (gerçek MinIO bağımlılığı yok); fail durumunda
//     thumbnailUrl null.
//
// Test fixture stratejisi: her testte tekrar kullanılan minimal user/asset/
// design üreticileri. Cleanup beforeEach'de — testler bağımsız.

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import {
  Prisma,
  ReviewStatus,
  UserRole,
  UserStatus,
  VariationCapability,
  VariationState,
} from "@prisma/client";
import { db } from "@/server/db";

// Storage mock — design scope için gerçek MinIO çağırmasın
const signedUrlMock = vi.fn().mockResolvedValue("https://mock.test/signed.png");
vi.mock("@/providers/storage", () => ({
  getStorage: () => ({
    signedUrl: signedUrlMock,
    upload: vi.fn(),
    download: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Session mock — currentUser.id null ise 401
const currentUser: { id: string | null; role: UserRole } = {
  id: null,
  role: UserRole.USER,
};

vi.mock("@/server/session", () => ({
  requireUser: vi.fn().mockImplementation(async () => {
    if (!currentUser.id) {
      const { UnauthorizedError } = await import("@/lib/errors");
      throw new UnauthorizedError();
    }
    return {
      id: currentUser.id,
      email: `${currentUser.id}@test.local`,
      role: currentUser.role,
    };
  }),
  requireAdmin: vi.fn(),
}));

const { GET } = await import("@/app/api/review/queue/route");

// ------------------------------------------------------------------
// Test fixture helpers
// ------------------------------------------------------------------

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

async function ensureProductType(key: string) {
  return db.productType.upsert({
    where: { key },
    update: {},
    create: { key, displayName: `PT-${key}`, isSystem: false },
  });
}

let createCounter = 0;
function nextSuffix(): string {
  createCounter += 1;
  return `${Date.now()}-${createCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createDesign(
  userId: string,
  productTypeId: string,
  opts: {
    reviewStatus?: ReviewStatus;
    deletedAt?: Date | null;
    riskFlags?: unknown[];
    score?: number | null;
  } = {},
): Promise<string> {
  const sfx = nextSuffix();
  const refAsset = await db.asset.create({
    data: {
      userId,
      storageProvider: "local",
      storageKey: `rq/ref-${sfx}`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `rq-ref-${sfx}`,
    },
  });
  const designAsset = await db.asset.create({
    data: {
      userId,
      storageProvider: "local",
      storageKey: `rq/design-${sfx}`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `rq-design-${sfx}`,
    },
  });
  const reference = await db.reference.create({
    data: { userId, assetId: refAsset.id, productTypeId },
  });
  const design = await db.generatedDesign.create({
    data: {
      userId,
      referenceId: reference.id,
      assetId: designAsset.id,
      productTypeId,
      providerId: "kie-gpt-image-1.5",
      capabilityUsed: VariationCapability.IMAGE_TO_IMAGE,
      promptSnapshot: "wall art",
      briefSnapshot: null,
      state: VariationState.SUCCESS,
      reviewStatus: opts.reviewStatus ?? ReviewStatus.PENDING,
      reviewScore: opts.score ?? null,
      reviewRiskFlags: opts.riskFlags
        ? (opts.riskFlags as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      deletedAt: opts.deletedAt ?? null,
    },
  });
  return design.id;
}

async function createLocalAsset(
  userId: string,
  opts: {
    reviewStatus?: ReviewStatus;
    deletedAt?: Date | null;
    isUserDeleted?: boolean;
    riskFlags?: unknown[];
    score?: number | null;
    thumbnailPath?: string | null;
  } = {},
): Promise<{ id: string; hash: string }> {
  const sfx = nextSuffix();
  const asset = await db.localLibraryAsset.create({
    data: {
      userId,
      folderName: "f",
      folderPath: "/p",
      fileName: `f-${sfx}.png`,
      filePath: `/p/f-${sfx}.png`,
      hash: `rq-local-${sfx}`,
      mimeType: "image/png",
      fileSize: 1,
      width: 100,
      height: 100,
      thumbnailPath:
        "thumbnailPath" in opts ? opts.thumbnailPath : `/p/thumb-${sfx}.webp`,
      reviewStatus: opts.reviewStatus ?? ReviewStatus.PENDING,
      reviewScore: opts.score ?? null,
      reviewRiskFlags: opts.riskFlags
        ? (opts.riskFlags as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      isUserDeleted: opts.isUserDeleted ?? false,
      deletedAt: opts.deletedAt ?? null,
    },
  });
  return { id: asset.id, hash: asset.hash };
}

async function cleanup(userIds: string[]) {
  await db.generatedDesign.deleteMany({ where: { userId: { in: userIds } } });
  await db.reference.deleteMany({ where: { userId: { in: userIds } } });
  await db.asset.deleteMany({ where: { userId: { in: userIds } } });
  await db.localLibraryAsset.deleteMany({
    where: { userId: { in: userIds } },
  });
}

function makeRequest(query: string): Request {
  return new Request(`http://localhost/api/review/queue?${query}`);
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe("GET /api/review/queue", () => {
  let userAId: string;
  let userBId: string;
  let productTypeId: string;

  beforeAll(async () => {
    const a = await ensureUser("review-queue-a@etsyhub.local");
    const b = await ensureUser("review-queue-b@etsyhub.local");
    userAId = a.id;
    userBId = b.id;
    const pt = await ensureProductType("rq-wall-art");
    productTypeId = pt.id;
    await cleanup([userAId, userBId]);
  });

  afterAll(async () => {
    await cleanup([userAId, userBId]);
  });

  beforeEach(async () => {
    currentUser.id = null;
    currentUser.role = UserRole.USER;
    signedUrlMock.mockClear();
    signedUrlMock.mockResolvedValue("https://mock.test/signed.png");
    await cleanup([userAId, userBId]);
  });

  it("auth yoksa 401 döner", async () => {
    const res = await GET(makeRequest("scope=design"));
    expect(res.status).toBe(401);
  });

  it("scope yoksa 400", async () => {
    currentUser.id = userAId;
    const res = await GET(makeRequest("status=PENDING"));
    expect(res.status).toBe(400);
  });

  it("scope geçersizse 400", async () => {
    currentUser.id = userAId;
    const res = await GET(makeRequest("scope=other"));
    expect(res.status).toBe(400);
  });

  it("design scope happy: items + total + pageSize=24 döner", async () => {
    currentUser.id = userAId;
    await createDesign(userAId, productTypeId, {
      reviewStatus: ReviewStatus.APPROVED,
      score: 92,
      riskFlags: [{ code: "x" }],
    });
    await createDesign(userAId, productTypeId, {
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      score: 70,
    });

    const res = await GET(makeRequest("scope=design"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{
        thumbnailUrl: string;
        reviewStatus: string;
        riskFlagCount: number;
        reviewScore: number | null;
      }>;
      total: number;
      page: number;
      pageSize: number;
    };
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(24);
    expect(body.items).toHaveLength(2);
    // Storage mock signed URL döndü
    expect(body.items[0]!.thumbnailUrl).toBe("https://mock.test/signed.png");
    // Risk flag count deserializasyonu
    const approved = body.items.find((i) => i.reviewStatus === "APPROVED");
    expect(approved?.riskFlagCount).toBe(1);
    expect(approved?.reviewScore).toBe(92);
    expect(signedUrlMock).toHaveBeenCalled();
  });

  it("local scope happy: thumbnailUrl proxy URL'ine döner", async () => {
    currentUser.id = userAId;
    const { hash } = await createLocalAsset(userAId, { score: 80 });

    const res = await GET(makeRequest("scope=local"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ thumbnailUrl: string | null; reviewScore: number | null }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.items[0]!.thumbnailUrl).toBe(
      `/api/local-library/thumbnail?hash=${encodeURIComponent(hash)}`,
    );
    expect(body.items[0]!.reviewScore).toBe(80);
    // Storage signed URL local scope'ta çağrılmamalı
    expect(signedUrlMock).not.toHaveBeenCalled();
  });

  it("local scope: thumbnailPath null ise thumbnailUrl null", async () => {
    currentUser.id = userAId;
    await createLocalAsset(userAId, { thumbnailPath: null });

    const res = await GET(makeRequest("scope=local"));
    const body = (await res.json()) as {
      items: Array<{ thumbnailUrl: string | null }>;
    };
    expect(body.items[0]!.thumbnailUrl).toBeNull();
  });

  it("status filter sadece o status'u döndürüyor (design)", async () => {
    currentUser.id = userAId;
    await createDesign(userAId, productTypeId, {
      reviewStatus: ReviewStatus.APPROVED,
    });
    await createDesign(userAId, productTypeId, {
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
    });

    const res = await GET(
      makeRequest("scope=design&status=NEEDS_REVIEW"),
    );
    const body = (await res.json()) as {
      items: Array<{ reviewStatus: string }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.items[0]!.reviewStatus).toBe("NEEDS_REVIEW");
  });

  it("ownership: A user, B'nin design'larını görmüyor", async () => {
    await createDesign(userBId, productTypeId, {
      reviewStatus: ReviewStatus.APPROVED,
    });
    currentUser.id = userAId;
    const res = await GET(makeRequest("scope=design"));
    const body = (await res.json()) as { total: number; items: unknown[] };
    expect(body.total).toBe(0);
    expect(body.items).toHaveLength(0);
  });

  it("ownership: A user, B'nin local asset'lerini görmüyor", async () => {
    await createLocalAsset(userBId);
    currentUser.id = userAId;
    const res = await GET(makeRequest("scope=local"));
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(0);
  });

  it("design soft-delete (deletedAt) filtreleniyor", async () => {
    currentUser.id = userAId;
    await createDesign(userAId, productTypeId, {
      reviewStatus: ReviewStatus.APPROVED,
      deletedAt: new Date(),
    });
    await createDesign(userAId, productTypeId, {
      reviewStatus: ReviewStatus.APPROVED,
    });

    const res = await GET(makeRequest("scope=design"));
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(1);
  });

  it("local soft-delete (isUserDeleted=true) filtreleniyor", async () => {
    currentUser.id = userAId;
    await createLocalAsset(userAId, { isUserDeleted: true });
    await createLocalAsset(userAId);

    const res = await GET(makeRequest("scope=local"));
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(1);
  });

  it("local soft-delete (deletedAt) filtreleniyor", async () => {
    currentUser.id = userAId;
    await createLocalAsset(userAId, { deletedAt: new Date() });
    await createLocalAsset(userAId);

    const res = await GET(makeRequest("scope=local"));
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(1);
  });

  it("design signedUrl fail => thumbnailUrl null + endpoint hata vermez", async () => {
    currentUser.id = userAId;
    await createDesign(userAId, productTypeId, {
      reviewStatus: ReviewStatus.APPROVED,
    });

    signedUrlMock.mockRejectedValueOnce(new Error("storage down"));
    const res = await GET(makeRequest("scope=design"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ thumbnailUrl: string | null }>;
    };
    expect(body.items[0]!.thumbnailUrl).toBeNull();
  });
});
