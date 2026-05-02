// Phase 9 V1 Task 14 — GET /api/listings/draft/[id] API test.
//
// Test scenarios: view shape, readiness compute, legacy field exclusion, auth.

import { describe, it, expect, afterAll, vi, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { GET } from "@/app/api/listings/draft/[id]/route";
import { requireUser } from "@/server/session";
import type { ListingDraftView } from "@/features/listings/types";

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

describe("GET /api/listings/draft/[id]", () => {
  beforeAll(() => {
    vi.mocked(requireUser).mockResolvedValue({ id: "test-user-id" } as any);
  });

  it("200 — view shape correct, readiness computed", async () => {
    const user = await ensureUser(`user-${Date.now() + Math.random()}@test.local`);
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Test Store" },
    });

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        storeId: store.id,
        title: "Test Listing",
        description: "Test Desc",
        tags: ["tag1"],
        category: "canvas",
        priceCents: 5000,
        status: "DRAFT",
      },
    });

    const req = new Request("http://localhost/api/listings/draft/" + listing.id);
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(200);

    const data = (await res.json()) as ListingDraftView;
    expect(data.id).toBe(listing.id);
    expect(data.title).toBe("Test Listing");
    expect(data.status).toBe("DRAFT");
    expect(data.readiness).toBeDefined();
    expect(Array.isArray(data.readiness)).toBe(true);
    expect(data.readiness.length).toBe(6);
  });

  it("200 — legacy fields NOT exposed (K6 lock)", async () => {
    const user = await ensureUser(`user-legacy-${Date.now() + Math.random()}@test.local`);
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Test Store" },
    });

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        storeId: store.id,
        title: "Test",
        status: "DRAFT",
      },
    });

    const req = new Request("http://localhost/api/listings/draft/" + listing.id);
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await GET(req, ctx as any);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body).not.toHaveProperty("generatedDesignId");
    expect(body).not.toHaveProperty("etsyDraftId");
    expect(body).not.toHaveProperty("productTypeId");
    expect(body).not.toHaveProperty("mockups");
    expect(body).not.toHaveProperty("imageOrderJson");
    expect(body).not.toHaveProperty("deletedAt");
  });

  it("404 — cross-user listing", async () => {
    const user1 = await ensureUser(`user1-${Date.now() + Math.random()}@test.local`);
    const user2 = await ensureUser(`user2-${Date.now() + Math.random()}@test.local`);
    userIds.push(user1.id, user2.id);

    const store1 = await db.store.create({
      data: { userId: user1.id, name: "Store 1" },
    });

    const listing = await db.listing.create({
      data: {
        userId: user1.id,
        storeId: store1.id,
        title: "Test",
        status: "DRAFT",
      },
    });

    const req = new Request("http://localhost/api/listings/draft/" + listing.id);
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user2 as any);
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(404);
  });

  it("404 — non-existent listing", async () => {
    const user = await ensureUser(`user-404-${Date.now() + Math.random()}@test.local`);
    userIds.push(user.id);

    const req = new Request(
      "http://localhost/api/listings/draft/clz0000000000000000000000"
    );
    const ctx = { params: { id: "clz0000000000000000000000" } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(404);
  });

  it("400 — invalid id param (not cuid)", async () => {
    const user = await ensureUser(`user-400-${Date.now() + Math.random()}@test.local`);
    userIds.push(user.id);

    const req = new Request("http://localhost/api/listings/draft/invalid-id");
    const ctx = { params: { id: "invalid-id" } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(400);
  });
});

afterAll(async () => {
  await db.listing.deleteMany({ where: { userId: { in: userIds } } });
  await db.store.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});
