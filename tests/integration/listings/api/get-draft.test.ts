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

// Stable prefix + per-test nonce → paralel suite collision'ı önler.
const TEST_PREFIX = "phase9-get-draft";
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

describe("GET /api/listings/draft/[id]", () => {
  beforeAll(() => {
    vi.mocked(requireUser).mockResolvedValue({ id: "test-user-id" } as any);
  });

  it("200 — view shape correct, readiness computed", async () => {
    const user = await ensureUser(uniqueEmail("shape"));
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

    const body = (await res.json()) as { listing: ListingDraftView };
    const data = body.listing;
    expect(data.id).toBe(listing.id);
    expect(data.title).toBe("Test Listing");
    expect(data.status).toBe("DRAFT");
    expect(data.readiness).toBeDefined();
    expect(Array.isArray(data.readiness)).toBe(true);
    expect(data.readiness.length).toBe(6);
  });

  it("200 — legacy fields NOT exposed (K6 lock)", async () => {
    const user = await ensureUser(uniqueEmail("legacy"));
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
    const body = (await res.json()) as { listing: Record<string, unknown> };
    const view = body.listing;

    expect(view).not.toHaveProperty("generatedDesignId");
    expect(view).not.toHaveProperty("etsyDraftId");
    expect(view).not.toHaveProperty("productTypeId");
    expect(view).not.toHaveProperty("mockups");
    expect(view).not.toHaveProperty("imageOrderJson");
    expect(view).not.toHaveProperty("deletedAt");
  });

  it("404 — cross-user listing", async () => {
    const user1 = await ensureUser(uniqueEmail("cross1"));
    const user2 = await ensureUser(uniqueEmail("cross2"));
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
    const user = await ensureUser(uniqueEmail("404"));
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
    const user = await ensureUser(uniqueEmail("400"));
    userIds.push(user.id);

    const req = new Request("http://localhost/api/listings/draft/invalid-id");
    const ctx = { params: { id: "invalid-id" } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(400);
  });

  // Phase 9 V1 — Submit sonrası UX paketi: etsyShop additive field.
  it("200 — etsyShop null (Etsy bağlantısı yoksa)", async () => {
    const user = await ensureUser(uniqueEmail("etsyshop-null"));
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Test Store No Etsy" },
    });

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        storeId: store.id,
        title: "Listing No Etsy",
        status: "DRAFT",
      },
    });

    const req = new Request("http://localhost/api/listings/draft/" + listing.id);
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { listing: ListingDraftView };
    expect(body.listing.etsyShop).toBeNull();
  });

  it("200 — etsyShop populated (shopId + shopName)", async () => {
    const user = await ensureUser(uniqueEmail("etsyshop-populated"));
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Test Store With Etsy" },
    });

    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "55555",
        shopName: "EtsyHubStore",
      },
    });

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        storeId: store.id,
        title: "Listing With Etsy",
        status: "DRAFT",
      },
    });

    const req = new Request("http://localhost/api/listings/draft/" + listing.id);
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { listing: ListingDraftView };
    expect(body.listing.etsyShop).toEqual({
      shopId: "55555",
      shopName: "EtsyHubStore",
    });
  });
});

afterAll(async () => {
  // FK order: listing -> mockupRender -> mockupJob -> selectionItem ->
  // selectionSet -> generatedDesign -> reference -> asset -> store -> user.
  // Bu suite çoğunlukla sadece user+store+listing yaratıyor, ama paralel
  // suite'ler aynı user'a child bağlamış olabilir — defansif tam temizlik.
  await db.listing.deleteMany({ where: { userId: { in: userIds } } });
  await db.mockupRender.deleteMany({ where: { job: { userId: { in: userIds } } } });
  await db.mockupJob.deleteMany({ where: { userId: { in: userIds } } });
  await db.selectionItem.deleteMany({ where: { selectionSet: { userId: { in: userIds } } } });
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
