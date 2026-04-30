// Phase 7 Task 19 — POST /api/selection/sets/quick-start integration testleri.
//
// Sözleşmeler (design Section 2.1, 7.2; plan Task 19):
//   - body: QuickStartInputSchema {
//       source: "variation-batch", referenceId, batchId, productTypeId
//     }
//   - Auth: requireUser; user.id ile quickStartFromBatch
//   - success: 201 + { setId } (UI redirect için minimal payload)
//   - cross-user reference / cross-user batch / olmayan id → 404
//   - source unsupported (zod literal reject) → 400
//   - missing required field → 400
//   - boş batch (variant 0) → 400 (typed EmptyBatchError; service'in
//     `throw new Error` yerine typed sınıf üzerinden dönüş)
//   - unauthenticated → 401
//
// Phase 6 paterni: requireUser vi.mock; Request standartı; service'ten
// NotFoundError/EmptyBatchError gibi typed AppError'lar withErrorHandling
// üzerinden HTTP'ye map.

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { JobStatus, JobType, UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { POST } from "@/app/api/selection/sets/quick-start/route";
import { requireUser } from "@/server/session";

const PRODUCT_TYPE_KEY = "phase7-api-qs-pt";

let userAId: string;
let userBId: string;
let productTypeId: string;

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

type SeedBatchOptions = {
  userId: string;
  designCount?: number;
  jobType?: JobType;
  referenceNotes?: string | null;
  suffix?: string;
};

type SeededBatch = {
  referenceId: string;
  batchId: string;
};

async function seedBatch(opts: SeedBatchOptions): Promise<SeededBatch> {
  const suffix = opts.suffix ?? `${Date.now()}-${Math.random()}`;

  const refAsset = await db.asset.create({
    data: {
      userId: opts.userId,
      storageProvider: "local",
      storageKey: `phase7-api-qs/ref-${suffix}.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-qs-ref-${suffix}`,
    },
  });

  const reference = await db.reference.create({
    data: {
      userId: opts.userId,
      assetId: refAsset.id,
      productTypeId,
      notes: opts.referenceNotes ?? null,
    },
  });

  const job = await db.job.create({
    data: {
      type: opts.jobType ?? JobType.GENERATE_VARIATIONS,
      status: JobStatus.SUCCESS,
      userId: opts.userId,
      progress: 100,
    },
  });

  const designCount = opts.designCount ?? 0;
  for (let i = 0; i < designCount; i++) {
    const designAsset = await db.asset.create({
      data: {
        userId: opts.userId,
        storageProvider: "local",
        storageKey: `phase7-api-qs/design-${suffix}-${i}.png`,
        bucket: "test",
        mimeType: "image/png",
        sizeBytes: 1,
        hash: `phase7-api-qs-design-${suffix}-${i}`,
      },
    });
    await db.generatedDesign.create({
      data: {
        userId: opts.userId,
        referenceId: reference.id,
        assetId: designAsset.id,
        productTypeId,
        jobId: job.id,
      },
    });
    await new Promise((r) => setTimeout(r, 5));
  }

  return { referenceId: reference.id, batchId: job.id };
}

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/selection/sets/quick-start", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function cleanup() {
  const userIds = [userAId, userBId];
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
  await db.job.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.asset.deleteMany({
    where: { userId: { in: userIds } },
  });
}

beforeAll(async () => {
  const a = await ensureUser("phase7-api-qs-a@etsyhub.local");
  const b = await ensureUser("phase7-api-qs-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;

  const pt = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "API Quick Start Wall Art",
      isSystem: false,
    },
  });
  productTypeId = pt.id;
});

beforeEach(async () => {
  (requireUser as ReturnType<typeof vi.fn>).mockReset();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("POST /api/selection/sets/quick-start", () => {
  it("valid input → 201; new set + items oluşur; response { setId }", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 3,
      referenceNotes: "Boho Set",
    });

    const res = await POST(
      makePostRequest({
        source: "variation-batch",
        referenceId: seeded.referenceId,
        batchId: seeded.batchId,
        productTypeId,
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(typeof data.setId).toBe("string");
    expect(data.setId.length).toBeGreaterThan(0);

    const set = await db.selectionSet.findUnique({ where: { id: data.setId } });
    expect(set).not.toBeNull();
    expect(set!.userId).toBe(userAId);
    expect(set!.status).toBe("draft");

    const items = await db.selectionItem.findMany({
      where: { selectionSetId: data.setId },
    });
    expect(items).toHaveLength(3);
  });

  it("cross-user reference → 404; User B'ye set yaratılmaz", async () => {
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 2,
      referenceNotes: "A's batch",
    });

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userBId });
    const res = await POST(
      makePostRequest({
        source: "variation-batch",
        referenceId: seeded.referenceId, // User A'nın reference'ı
        batchId: seeded.batchId,
        productTypeId,
      }),
    );
    expect(res.status).toBe(404);

    const setsCount = await db.selectionSet.count({ where: { userId: userBId } });
    expect(setsCount).toBe(0);
  });

  it("cross-user batch (B'nin reference'ı, A'nın batch'i) → 404", async () => {
    const userBSeed = await seedBatch({
      userId: userBId,
      designCount: 1,
      referenceNotes: "B's ref",
    });
    const userASeed = await seedBatch({
      userId: userAId,
      designCount: 2,
      referenceNotes: "A's ref",
    });

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userBId });
    const res = await POST(
      makePostRequest({
        source: "variation-batch",
        referenceId: userBSeed.referenceId,
        batchId: userASeed.batchId, // B'ye ait değil
        productTypeId,
      }),
    );
    expect(res.status).toBe(404);
  });

  it("olmayan referenceId → 404", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 1,
      referenceNotes: "Bad ref test",
    });
    const res = await POST(
      makePostRequest({
        source: "variation-batch",
        referenceId: "phase7-api-qs-no-such-ref",
        batchId: seeded.batchId,
        productTypeId,
      }),
    );
    expect(res.status).toBe(404);
  });

  it("olmayan batchId → 404", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 1,
      referenceNotes: "Bad batch test",
    });
    const res = await POST(
      makePostRequest({
        source: "variation-batch",
        referenceId: seeded.referenceId,
        batchId: "phase7-api-qs-no-such-batch",
        productTypeId,
      }),
    );
    expect(res.status).toBe(404);
  });

  it("boş batch (variant 0) → 400 (typed EmptyBatchError)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 0,
      referenceNotes: "Empty",
    });

    const res = await POST(
      makePostRequest({
        source: "variation-batch",
        referenceId: seeded.referenceId,
        batchId: seeded.batchId,
        productTypeId,
      }),
    );
    expect(res.status).toBe(400);

    const setsCount = await db.selectionSet.count({ where: { userId: userAId } });
    expect(setsCount).toBe(0);
  });

  it("source unsupported → 400 (zod literal reject)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 1,
      referenceNotes: "Bad source",
    });
    const res = await POST(
      makePostRequest({
        source: "other-source",
        referenceId: seeded.referenceId,
        batchId: seeded.batchId,
        productTypeId,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("missing required field (referenceId yok) → 400 (zod reject)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });
    const seeded = await seedBatch({
      userId: userAId,
      designCount: 1,
      referenceNotes: "Missing field",
    });
    const res = await POST(
      makePostRequest({
        source: "variation-batch",
        batchId: seeded.batchId,
        productTypeId,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("auth eksik → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );
    const res = await POST(
      makePostRequest({
        source: "variation-batch",
        referenceId: "x",
        batchId: "y",
        productTypeId: "z",
      }),
    );
    expect(res.status).toBe(401);
  });
});
