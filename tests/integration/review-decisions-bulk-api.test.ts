// Phase 6 Dalga B (Task 16+17) — POST /api/review/decisions/bulk integration testleri.
//
// Sözleşme:
//   - Auth: requireUser mock'lanır.
//   - Body Zod discriminated union (action: approve | reject | delete).
//   - Action=delete + scope=design ⇒ 400 (Not 1).
//   - Skip-on-risk SADECE action=approve. Reject + delete tüm seçimi yazar.
//   - Multi-tenant: cross-user id'ler skippedNotFound olarak sayılır.
//   - Soft-delete filter:
//     design  → deletedAt IS NULL
//     local   → deletedAt IS NULL AND isUserDeleted = false
//   - Delete soft-delete: isUserDeleted=true + deletedAt set.
//
// Karar 5 (local soft-delete) ve Karar 6 (tek endpoint) doğrulamaları.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import {
  Prisma,
  ReviewStatus,
  ReviewStatusSource,
  UserRole,
  UserStatus,
  VariationCapability,
  VariationState,
} from "@prisma/client";
import { db } from "@/server/db";

// Session mock
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

const { POST } = await import("@/app/api/review/decisions/bulk/route");

// ----------------------------------------------------------------
// Fixture helpers
// ----------------------------------------------------------------

let createCounter = 0;
function nextSuffix(): string {
  createCounter += 1;
  return `${Date.now()}-${createCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

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

async function createDesign(
  userId: string,
  productTypeId: string,
  opts: { riskFlags?: unknown[]; deletedAt?: Date | null } = {},
): Promise<string> {
  const sfx = nextSuffix();
  const refAsset = await db.asset.create({
    data: {
      userId,
      storageProvider: "local",
      storageKey: `bk/ref-${sfx}`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `bk-ref-${sfx}`,
    },
  });
  const designAsset = await db.asset.create({
    data: {
      userId,
      storageProvider: "local",
      storageKey: `bk/d-${sfx}`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `bk-d-${sfx}`,
    },
  });
  const reference = await db.reference.create({
    data: { userId, assetId: refAsset.id, productTypeId },
  });
  const d = await db.generatedDesign.create({
    data: {
      userId,
      referenceId: reference.id,
      assetId: designAsset.id,
      productTypeId,
      providerId: "kie-gpt-image-1.5",
      capabilityUsed: VariationCapability.IMAGE_TO_IMAGE,
      promptSnapshot: "x",
      briefSnapshot: null,
      state: VariationState.SUCCESS,
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      reviewRiskFlags: opts.riskFlags
        ? (opts.riskFlags as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      deletedAt: opts.deletedAt ?? null,
    },
  });
  return d.id;
}

async function createLocalAsset(
  userId: string,
  opts: {
    riskFlags?: unknown[];
    deletedAt?: Date | null;
    isUserDeleted?: boolean;
  } = {},
): Promise<string> {
  const sfx = nextSuffix();
  const a = await db.localLibraryAsset.create({
    data: {
      userId,
      folderName: "f",
      folderPath: "/p",
      fileName: `f-${sfx}.png`,
      filePath: `/p/f-${sfx}.png`,
      hash: `bk-local-${sfx}`,
      mimeType: "image/png",
      fileSize: 1,
      width: 1,
      height: 1,
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      reviewRiskFlags: opts.riskFlags
        ? (opts.riskFlags as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      isUserDeleted: opts.isUserDeleted ?? false,
      deletedAt: opts.deletedAt ?? null,
    },
  });
  return a.id;
}

async function cleanup(userIds: string[]) {
  await db.designReview.deleteMany({
    where: { generatedDesign: { userId: { in: userIds } } },
  });
  await db.generatedDesign.deleteMany({ where: { userId: { in: userIds } } });
  await db.reference.deleteMany({ where: { userId: { in: userIds } } });
  await db.asset.deleteMany({ where: { userId: { in: userIds } } });
  await db.localLibraryAsset.deleteMany({ where: { userId: { in: userIds } } });
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/review/decisions/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe("POST /api/review/decisions/bulk", () => {
  let userAId: string;
  let userBId: string;
  let productTypeId: string;

  beforeAll(async () => {
    const a = await ensureUser("review-bulk-a@etsyhub.local");
    const b = await ensureUser("review-bulk-b@etsyhub.local");
    userAId = a.id;
    userBId = b.id;
    const pt = await ensureProductType("bk-wall-art");
    productTypeId = pt.id;
    await cleanup([userAId, userBId]);
  });

  afterAll(async () => {
    await cleanup([userAId, userBId]);
  });

  beforeEach(async () => {
    currentUser.id = null;
    currentUser.role = UserRole.USER;
    await cleanup([userAId, userBId]);
  });

  // ---------- Auth ----------

  it("auth yoksa 401", async () => {
    const res = await POST(
      makeRequest({ action: "approve", scope: "design", ids: ["abc"] }),
    );
    expect(res.status).toBe(401);
  });

  // ---------- Validation ----------

  it("invalid action ⇒ 400", async () => {
    currentUser.id = userAId;
    const res = await POST(
      makeRequest({ action: "purge", scope: "design", ids: ["x"] }),
    );
    expect(res.status).toBe(400);
  });

  it("ids boş ⇒ 400", async () => {
    currentUser.id = userAId;
    const res = await POST(
      makeRequest({ action: "approve", scope: "design", ids: [] }),
    );
    expect(res.status).toBe(400);
  });

  it("ids > 100 ⇒ 400", async () => {
    currentUser.id = userAId;
    const ids = Array.from({ length: 101 }, () => "ckabc1234567890123456789x"); // dummy cuid-like
    const res = await POST(
      makeRequest({ action: "approve", scope: "design", ids }),
    );
    expect(res.status).toBe(400);
  });

  it("delete + scope=design ⇒ 400 (Not 1: delete sadece local)", async () => {
    currentUser.id = userAId;
    const designId = await createDesign(userAId, productTypeId);
    const res = await POST(
      makeRequest({ action: "delete", scope: "design", ids: [designId] }),
    );
    expect(res.status).toBe(400);
  });

  // ---------- Approve happy path ----------

  it("approve design temiz: tüm seçim approved (skippedRisky=0)", async () => {
    currentUser.id = userAId;
    const id1 = await createDesign(userAId, productTypeId);
    const id2 = await createDesign(userAId, productTypeId);
    const id3 = await createDesign(userAId, productTypeId);

    const res = await POST(
      makeRequest({ action: "approve", scope: "design", ids: [id1, id2, id3] }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requested).toBe(3);
    expect(body.approved).toBe(3);
    expect(body.skippedRisky).toBe(0);
    expect(body.skippedRiskyIds).toEqual([]);

    const updated = await db.generatedDesign.findMany({
      where: { id: { in: [id1, id2, id3] } },
      select: { reviewStatus: true, reviewStatusSource: true },
    });
    for (const u of updated) {
      expect(u.reviewStatus).toBe(ReviewStatus.APPROVED);
      expect(u.reviewStatusSource).toBe(ReviewStatusSource.USER);
    }
  });

  it("approve design risk: skip-on-risk", async () => {
    currentUser.id = userAId;
    const safe1 = await createDesign(userAId, productTypeId);
    const risky1 = await createDesign(userAId, productTypeId, {
      riskFlags: [
        { type: "watermark_detected", confidence: 0.9, reason: "x" },
      ],
    });
    const risky2 = await createDesign(userAId, productTypeId, {
      riskFlags: [
        { type: "text_detected", confidence: 0.7, reason: "y" },
      ],
    });

    const res = await POST(
      makeRequest({
        action: "approve",
        scope: "design",
        ids: [safe1, risky1, risky2],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requested).toBe(3);
    expect(body.approved).toBe(1);
    expect(body.skippedRisky).toBe(2);
    expect(new Set(body.skippedRiskyIds)).toEqual(new Set([risky1, risky2]));

    const safe = await db.generatedDesign.findUnique({ where: { id: safe1 } });
    expect(safe?.reviewStatus).toBe(ReviewStatus.APPROVED);
    const risky = await db.generatedDesign.findUnique({ where: { id: risky1 } });
    // Risky kayıt değişmedi (status NEEDS_REVIEW kaldı)
    expect(risky?.reviewStatus).toBe(ReviewStatus.NEEDS_REVIEW);
  });

  it("approve local temiz: tüm seçim approved", async () => {
    currentUser.id = userAId;
    const id1 = await createLocalAsset(userAId);
    const id2 = await createLocalAsset(userAId);

    const res = await POST(
      makeRequest({ action: "approve", scope: "local", ids: [id1, id2] }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.approved).toBe(2);
    expect(body.skippedRisky).toBe(0);
  });

  // ---------- Reject ----------

  it("reject design: tüm seçim reddedilir (skip-on-risk YOK)", async () => {
    currentUser.id = userAId;
    const safe1 = await createDesign(userAId, productTypeId);
    const risky1 = await createDesign(userAId, productTypeId, {
      riskFlags: [{ type: "text_detected", confidence: 0.5, reason: "x" }],
    });

    const res = await POST(
      makeRequest({ action: "reject", scope: "design", ids: [safe1, risky1] }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rejected).toBe(2);
    expect(body.skippedRisky).toBeUndefined();

    const updated = await db.generatedDesign.findMany({
      where: { id: { in: [safe1, risky1] } },
      select: { reviewStatus: true, reviewStatusSource: true },
    });
    for (const u of updated) {
      expect(u.reviewStatus).toBe(ReviewStatus.REJECTED);
      expect(u.reviewStatusSource).toBe(ReviewStatusSource.USER);
    }
  });

  // ---------- Delete (local only) ----------

  it("delete local: soft-delete (isUserDeleted=true + deletedAt set)", async () => {
    currentUser.id = userAId;
    const id1 = await createLocalAsset(userAId);
    const id2 = await createLocalAsset(userAId);

    const res = await POST(
      makeRequest({ action: "delete", scope: "local", ids: [id1, id2] }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(2);

    const after = await db.localLibraryAsset.findMany({
      where: { id: { in: [id1, id2] } },
      select: { isUserDeleted: true, deletedAt: true },
    });
    for (const a of after) {
      expect(a.isUserDeleted).toBe(true);
      expect(a.deletedAt).not.toBeNull();
    }
  });

  // ---------- Multi-tenant ----------

  it("ownership: B'nin design'larını approve etmeye çalışmak skippedNotFound", async () => {
    const otherId = await createDesign(userBId, productTypeId);
    currentUser.id = userAId;
    const ownId = await createDesign(userAId, productTypeId);
    const res = await POST(
      makeRequest({
        action: "approve",
        scope: "design",
        ids: [ownId, otherId],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.approved).toBe(1);
    expect(body.skippedNotFound).toBe(1);

    const other = await db.generatedDesign.findUnique({ where: { id: otherId } });
    // B'nin kaydı değişmedi
    expect(other?.reviewStatus).toBe(ReviewStatus.NEEDS_REVIEW);
  });

  it("soft-deleted local asset (isUserDeleted=true) bulk'ta skippedNotFound", async () => {
    currentUser.id = userAId;
    const live = await createLocalAsset(userAId);
    const deleted = await createLocalAsset(userAId, { isUserDeleted: true });

    const res = await POST(
      makeRequest({ action: "approve", scope: "local", ids: [live, deleted] }),
    );
    const body = await res.json();
    expect(body.approved).toBe(1);
    expect(body.skippedNotFound).toBe(1);
  });

  // ---------- Dedup ----------

  it("duplicate ids dedup: skippedDuplicates sayılır", async () => {
    currentUser.id = userAId;
    const id1 = await createDesign(userAId, productTypeId);
    const res = await POST(
      makeRequest({
        action: "approve",
        scope: "design",
        ids: [id1, id1, id1],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requested).toBe(3);
    expect(body.skippedDuplicates).toBe(2);
    expect(body.approved).toBe(1);
  });
});
