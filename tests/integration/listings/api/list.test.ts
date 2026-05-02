// Phase 9 V1 Task 18 — GET /api/listings index route test.
//
// Test scenarios: user isolation, status filter, soft-delete, ordering.

import { describe, it, expect, afterAll, vi, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { GET } from "@/app/api/listings/route";
import { requireUser } from "@/server/session";
import type { ListingIndexView } from "@/features/listings/types";

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

describe("GET /api/listings", () => {
  beforeAll(() => {
    vi.mocked(requireUser).mockResolvedValue({ id: "test-user-id" } as any);
  });

  it("200 — user sees own listings, status filter works", async () => {
    const user = await ensureUser(`user-${Date.now() + Math.random()}@test.local`);
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Test Store" },
    });

    await db.listing.create({
      data: {
        userId: user.id,
        storeId: store.id,
        title: "Draft",
        status: "DRAFT",
      },
    });

    await db.listing.create({
      data: {
        userId: user.id,
        storeId: store.id,
        title: "Published",
        status: "PUBLISHED",
      },
    });

    const req = new Request("http://localhost/api/listings?status=DRAFT");

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as { listings: ListingIndexView[] };
    expect(data.listings.every((l) => l.status === "DRAFT")).toBe(true);
    expect(data.listings.length).toBe(1);
  });

  it("200 — empty list when user has no listings", async () => {
    const user = await ensureUser(`user-empty-${Date.now() + Math.random()}@test.local`);
    userIds.push(user.id);

    const req = new Request("http://localhost/api/listings");

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as { listings: ListingIndexView[] };
    expect(data.listings).toEqual([]);
  });

  it("200 — soft-deleted listings hidden", async () => {
    const user = await ensureUser(`user-soft-delete-${Date.now() + Math.random()}@test.local`);
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Test Store" },
    });

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        storeId: store.id,
        title: "To Delete",
        status: "DRAFT",
      },
    });

    // Soft-delete
    await db.listing.update({
      where: { id: listing.id },
      data: { deletedAt: new Date() },
    });

    const req = new Request("http://localhost/api/listings");

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as { listings: ListingIndexView[] };
    expect(data.listings).toEqual([]);
  });

  it("200 — ordered by updatedAt DESC", async () => {
    const user = await ensureUser(`user-order-${Date.now() + Math.random()}@test.local`);
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Test Store" },
    });

    const listing1 = await db.listing.create({
      data: {
        userId: user.id,
        storeId: store.id,
        title: "First",
        status: "DRAFT",
      },
    });

    await new Promise((r) => setTimeout(r, 10));

    const listing2 = await db.listing.create({
      data: {
        userId: user.id,
        storeId: store.id,
        title: "Second",
        status: "DRAFT",
      },
    });

    const req = new Request("http://localhost/api/listings");

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as { listings: ListingIndexView[] };
    expect(data.listings[0].id).toBe(listing2.id); // Most recent first
    expect(data.listings[1].id).toBe(listing1.id);
  });

  it("200 — ListingIndexView shape (no readiness)", async () => {
    const user = await ensureUser(`user-shape-${Date.now() + Math.random()}@test.local`);
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Test Store" },
    });

    await db.listing.create({
      data: {
        userId: user.id,
        storeId: store.id,
        title: "Test",
        status: "DRAFT",
        priceCents: 2000,
      },
    });

    const req = new Request("http://localhost/api/listings");

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await GET(req);
    const data = (await res.json()) as { listings: ListingIndexView[] };

    const item = data.listings[0];
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("status");
    expect(item).toHaveProperty("title");
    expect(item).toHaveProperty("priceCents");
    expect(item).toHaveProperty("createdAt");
    expect(item).toHaveProperty("updatedAt");
    expect(item).not.toHaveProperty("readiness"); // perf optimization
  });

  it("400 — invalid status query parameter", async () => {
    const user = await ensureUser(`user-invalid-${Date.now() + Math.random()}@test.local`);
    userIds.push(user.id);

    const req = new Request("http://localhost/api/listings?status=INVALID_STATUS");

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});

afterAll(async () => {
  await db.listing.deleteMany({ where: { userId: { in: userIds } } });
  await db.store.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});
