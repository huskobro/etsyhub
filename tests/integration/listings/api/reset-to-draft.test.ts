// Phase 9 V1 — POST /api/listings/draft/[id]/reset-to-draft API test.
//
// Test scenarios (8 senaryo):
// - 400 invalid path param (cuid değil)
// - 404 listing yok
// - 404 cross-user listing
// - 404 soft-deleted listing
// - 409 status DRAFT (henüz fail değil)
// - 409 status PUBLISHED (terminal değil sayılır FAILED dışı)
// - 200 happy path FAILED → DRAFT (tüm Etsy field'lar null)
// - 200 previousEtsyListingId response payload doğrulaması

import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { POST } from "@/app/api/listings/draft/[id]/reset-to-draft/route";
import { requireUser } from "@/server/session";

// Stable prefix + per-test nonce → paralel suite collision'ı önler.
const TEST_PREFIX = "phase9-reset-to-draft";
let nonce = 0;
function uniqueEmail(label: string) {
  return `${TEST_PREFIX}-${label}-${Date.now()}-${++nonce}-${Math.random().toString(36).slice(2, 8)}@test.local`;
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

const userIds: string[] = [];

describe("POST /api/listings/draft/[id]/reset-to-draft", () => {
  beforeAll(() => {
    vi.mocked(requireUser).mockResolvedValue({ id: "test-user-id" } as any);
  });

  it("400 — invalid path param (cuid değil)", async () => {
    const user = await ensureUser(uniqueEmail("400"));
    userIds.push(user.id);

    const req = new Request(
      "http://localhost/api/listings/draft/invalid-id/reset-to-draft",
      { method: "POST" },
    );
    const ctx = { params: { id: "invalid-id" } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it("404 — listing yok", async () => {
    const user = await ensureUser(uniqueEmail("nf"));
    userIds.push(user.id);

    const req = new Request(
      "http://localhost/api/listings/draft/clz0000000000000000000000/reset-to-draft",
      { method: "POST" },
    );
    const ctx = { params: { id: "clz0000000000000000000000" } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(404);
  });

  it("404 — cross-user listing", async () => {
    const user1 = await ensureUser(uniqueEmail("cross1"));
    const user2 = await ensureUser(uniqueEmail("cross2"));
    userIds.push(user1.id, user2.id);

    const listing = await db.listing.create({
      data: {
        userId: user1.id,
        title: "Other user listing",
        description: "x",
        priceCents: 500,
        status: "FAILED",
        failedReason: "test fail",
        etsyListingId: "999",
      },
    });

    const req = new Request(
      `http://localhost/api/listings/draft/${listing.id}/reset-to-draft`,
      { method: "POST" },
    );
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user2 as any);
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(404);
  });

  it("404 — soft-deleted listing", async () => {
    const user = await ensureUser(uniqueEmail("softdel"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Soft deleted listing",
        description: "x",
        priceCents: 500,
        status: "FAILED",
        failedReason: "test fail",
        deletedAt: new Date(),
      },
    });

    const req = new Request(
      `http://localhost/api/listings/draft/${listing.id}/reset-to-draft`,
      { method: "POST" },
    );
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(404);
  });

  it("409 — status DRAFT (henüz fail değil)", async () => {
    const user = await ensureUser(uniqueEmail("draft"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Draft listing",
        description: "x",
        priceCents: 500,
        status: "DRAFT",
      },
    });

    const req = new Request(
      `http://localhost/api/listings/draft/${listing.id}/reset-to-draft`,
      { method: "POST" },
    );
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("LISTING_RESET_INVALID_STATE");
  });

  it("409 — status PUBLISHED (FAILED değil)", async () => {
    const user = await ensureUser(uniqueEmail("pub"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Published listing",
        description: "x",
        priceCents: 500,
        status: "PUBLISHED",
        etsyListingId: "111",
        publishedAt: new Date(),
        submittedAt: new Date(),
      },
    });

    const req = new Request(
      `http://localhost/api/listings/draft/${listing.id}/reset-to-draft`,
      { method: "POST" },
    );
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(409);
  });

  it("200 — happy path FAILED → DRAFT (tüm Etsy field'lar null)", async () => {
    const user = await ensureUser(uniqueEmail("happy"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Failed listing",
        description: "x",
        priceCents: 500,
        status: "FAILED",
        failedReason: "Etsy V3 503 maintenance",
        etsyListingId: "L-OLD-12345",
        submittedAt: new Date(),
        publishedAt: null,
      },
    });

    const req = new Request(
      `http://localhost/api/listings/draft/${listing.id}/reset-to-draft`,
      { method: "POST" },
    );
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(200);

    // DB persist doğrulama — tüm Etsy field'lar null, status DRAFT
    const updated = await db.listing.findUnique({
      where: { id: listing.id },
    });
    expect(updated?.status).toBe("DRAFT");
    expect(updated?.etsyListingId).toBeNull();
    expect(updated?.failedReason).toBeNull();
    expect(updated?.submittedAt).toBeNull();
    expect(updated?.publishedAt).toBeNull();
  });

  it("200 — previousEtsyListingId response payload doğru döner", async () => {
    const user = await ensureUser(uniqueEmail("payload"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Failed listing 2",
        description: "x",
        priceCents: 500,
        status: "FAILED",
        failedReason: "Image upload all failed",
        etsyListingId: "L-ORPHAN-77777",
      },
    });

    const req = new Request(
      `http://localhost/api/listings/draft/${listing.id}/reset-to-draft`,
      { method: "POST" },
    );
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("DRAFT");
    expect(body.previousEtsyListingId).toBe("L-ORPHAN-77777");
  });
});

afterAll(async () => {
  // FK-safe cleanup chain (handoff.test.ts emsali).
  // listing -> mockupRender -> mockupJob -> selectionItem ->
  // selectionSet -> generatedDesign -> reference -> asset ->
  // etsyConnection -> store -> user.
  await db.listing.deleteMany({ where: { userId: { in: userIds } } });
  await db.mockupRender.deleteMany({
    where: { job: { userId: { in: userIds } } },
  });
  await db.mockupJob.deleteMany({ where: { userId: { in: userIds } } });
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: userIds } } },
  });
  await db.selectionSet.deleteMany({ where: { userId: { in: userIds } } });
  await db.generatedDesign.deleteMany({ where: { userId: { in: userIds } } });
  await db.reference.deleteMany({ where: { userId: { in: userIds } } });
  await db.asset.deleteMany({ where: { userId: { in: userIds } } });
  await db.etsyConnection.deleteMany({
    where: { store: { userId: { in: userIds } } },
  });
  await db.store.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});
