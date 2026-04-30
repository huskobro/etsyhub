// Phase 7 Task 22 — POST /api/selection/sets/[setId]/finalize
//
// Finalize endpoint sözleşmesi (design Section 4.3, 7.2; plan Task 22):
//   - Auth: requireUser (Phase 5)
//   - Body: BOŞ zorunlu (FinalizeInputSchema .strict() — extra alan reject)
//   - Success: 200 + { set } (status="ready", finalizedAt set)
//   - 0 selected → 409 (FinalizeGateError)
//   - Already ready → 409 (SetReadOnlyError; gate'ten önce)
//   - Extra body field → 400 (zod strict)
//   - Cross-user → 404
//   - Unauthenticated → 401

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { POST } from "@/app/api/selection/sets/[setId]/finalize/route";
import { requireUser } from "@/server/session";

const PRODUCT_TYPE_KEY = "phase7-api-finalize-pt";

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

async function ensureBase(userId: string) {
  const refAsset = await db.asset.create({
    data: {
      userId,
      storageProvider: "local",
      storageKey: `phase7-api-finalize/${userId}/${Math.random()}-ref.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-finalize-ref-${userId}-${Math.random()}`,
    },
  });
  const reference = await db.reference.create({
    data: { userId, assetId: refAsset.id, productTypeId },
  });
  return { reference };
}

async function createDesign(userId: string, referenceId: string, tag: string) {
  const asset = await db.asset.create({
    data: {
      userId,
      storageProvider: "local",
      storageKey: `phase7-api-finalize/${userId}/${tag}.png`,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `phase7-api-finalize-design-${userId}-${tag}-${Math.random()}`,
    },
  });
  const design = await db.generatedDesign.create({
    data: { userId, referenceId, assetId: asset.id, productTypeId },
  });
  return { asset, design };
}

function makeRequest(setId: string, body?: unknown): Request {
  return new Request(`http://localhost/api/selection/sets/${setId}/finalize`, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

async function cleanup() {
  const userIds = [userAId, userBId];
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: userIds } } },
  });
  await db.selectionSet.deleteMany({ where: { userId: { in: userIds } } });
  await db.generatedDesign.deleteMany({ where: { userId: { in: userIds } } });
  await db.reference.deleteMany({ where: { userId: { in: userIds } } });
  await db.asset.deleteMany({ where: { userId: { in: userIds } } });
}

beforeAll(async () => {
  const a = await ensureUser("phase7-api-finalize-a@etsyhub.local");
  const b = await ensureUser("phase7-api-finalize-b@etsyhub.local");
  userAId = a.id;
  userBId = b.id;

  const pt = await db.productType.upsert({
    where: { key: PRODUCT_TYPE_KEY },
    update: {},
    create: {
      key: PRODUCT_TYPE_KEY,
      displayName: "API Finalize Wall Art",
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

describe("POST /api/selection/sets/[setId]/finalize", () => {
  it("selected ≥ 1 → 200; status='ready', finalizedAt set", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "f1");
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "Fin1", status: "draft" },
    });
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: d1.design.id,
        sourceAssetId: d1.asset.id,
        position: 0,
        status: "selected",
      },
    });

    const res = await POST(makeRequest(set.id, {}), {
      params: { setId: set.id },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.set.status).toBe("ready");
    expect(data.set.finalizedAt).toBeTruthy();

    const row = await db.selectionSet.findUnique({ where: { id: set.id } });
    expect(row!.status).toBe("ready");
    expect(row!.finalizedAt).not.toBeNull();
  });

  it("0 selected → 409 (FinalizeGateError)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "fg1");
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "FinG", status: "draft" },
    });
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: d1.design.id,
        sourceAssetId: d1.asset.id,
        position: 0,
        status: "pending", // selected DEĞIL
      },
    });

    const res = await POST(makeRequest(set.id, {}), {
      params: { setId: set.id },
    });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe("FINALIZE_GATE");

    const row = await db.selectionSet.findUnique({ where: { id: set.id } });
    expect(row!.status).toBe("draft");
  });

  it("already ready → 409 (SetReadOnlyError; gate'ten önce read-only check)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "fr1");
    const set = await db.selectionSet.create({
      data: {
        userId: userAId,
        name: "FinR",
        status: "ready",
        finalizedAt: new Date(),
      },
    });
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: d1.design.id,
        sourceAssetId: d1.asset.id,
        position: 0,
        status: "selected",
      },
    });

    const res = await POST(makeRequest(set.id, {}), {
      params: { setId: set.id },
    });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe("SET_READ_ONLY");
  });

  it("extra body field → 400 (FinalizeInputSchema strict reject)", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userAId });

    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "fe1");
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "FinE", status: "draft" },
    });
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: d1.design.id,
        sourceAssetId: d1.asset.id,
        position: 0,
        status: "selected",
      },
    });

    const res = await POST(makeRequest(set.id, { force: true }), {
      params: { setId: set.id },
    });
    expect(res.status).toBe(400);

    // State değişmedi
    const row = await db.selectionSet.findUnique({ where: { id: set.id } });
    expect(row!.status).toBe("draft");
  });

  it("cross-user setId → 404 (NotFoundError)", async () => {
    const { reference } = await ensureBase(userAId);
    const d1 = await createDesign(userAId, reference.id, "fcu1");
    const set = await db.selectionSet.create({
      data: { userId: userAId, name: "FinX", status: "draft" },
    });
    await db.selectionItem.create({
      data: {
        selectionSetId: set.id,
        generatedDesignId: d1.design.id,
        sourceAssetId: d1.asset.id,
        position: 0,
        status: "selected",
      },
    });

    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userBId });
    const res = await POST(makeRequest(set.id, {}), {
      params: { setId: set.id },
    });
    expect(res.status).toBe(404);

    const row = await db.selectionSet.findUnique({ where: { id: set.id } });
    expect(row!.status).toBe("draft");
  });

  it("unauthenticated → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new UnauthorizedError(),
    );

    const res = await POST(makeRequest("any-set", {}), {
      params: { setId: "any-set" },
    });
    expect(res.status).toBe(401);
  });
});
