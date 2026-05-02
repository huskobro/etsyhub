// Phase 9 V1 Task 15 — PATCH /api/listings/draft/[id] API test.
//
// Test scenarios: metadata update, readiness recompute, status guard, strict mode.

import { describe, it, expect, afterAll, vi, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { PATCH } from "@/app/api/listings/draft/[id]/route";
import { requireUser } from "@/server/session";
import type { ListingDraftView } from "@/features/listings/types";

// Stable prefix + per-test nonce → paralel suite collision'ı önler.
const TEST_PREFIX = "phase9-update-draft";
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

describe("PATCH /api/listings/draft/[id]", () => {
  beforeAll(() => {
    vi.mocked(requireUser).mockResolvedValue({ id: "test-user-id" } as any);
  });

  it("200 — title update + readiness recompute", async () => {
    const user = await ensureUser(uniqueEmail("title"));
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Test Store" },
    });

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        storeId: store.id,
        title: "Old Title",
        status: "DRAFT",
      },
    });

    const req = new Request("http://localhost/api/listings/draft/" + listing.id, {
      method: "PATCH",
      body: JSON.stringify({ title: "New Title Test" }),
      headers: { "Content-Type": "application/json" },
    });
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(200);

    const data = (await res.json()) as ListingDraftView;
    expect(data.title).toBe("New Title Test");
    expect(data.readiness).toBeDefined();
  });

  it("200 — partial update: tags only", async () => {
    const user = await ensureUser(uniqueEmail("partial"));
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Test Store" },
    });

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        storeId: store.id,
        title: "Title",
        tags: ["old"],
        status: "DRAFT",
      },
    });

    const req = new Request("http://localhost/api/listings/draft/" + listing.id, {
      method: "PATCH",
      body: JSON.stringify({ tags: ["new1", "new2"] }),
      headers: { "Content-Type": "application/json" },
    });
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(200);

    const data = (await res.json()) as ListingDraftView;
    expect(data.tags).toEqual(["new1", "new2"]);
    expect(data.title).toBe("Title");
  });

  it("400 — title too short (min 5)", async () => {
    const user = await ensureUser(uniqueEmail("short"));
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

    const req = new Request("http://localhost/api/listings/draft/" + listing.id, {
      method: "PATCH",
      body: JSON.stringify({ title: "Bad" }),
      headers: { "Content-Type": "application/json" },
    });
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it("400 — strict mode: unknown field rejected", async () => {
    const user = await ensureUser(uniqueEmail("strict"));
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

    const req = new Request("http://localhost/api/listings/draft/" + listing.id, {
      method: "PATCH",
      body: JSON.stringify({
        title: "New",
        productionPartner: "someone", // Unknown field
      }),
      headers: { "Content-Type": "application/json" },
    });
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it("409 — PUBLISHED status not editable", async () => {
    const user = await ensureUser(uniqueEmail("pub"));
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Test Store" },
    });

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        storeId: store.id,
        title: "Published",
        status: "PUBLISHED",
      },
    });

    const req = new Request("http://localhost/api/listings/draft/" + listing.id, {
      method: "PATCH",
      body: JSON.stringify({ title: "Try Edit" }),
      headers: { "Content-Type": "application/json" },
    });
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(409);
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

    const req = new Request("http://localhost/api/listings/draft/" + listing.id, {
      method: "PATCH",
      body: JSON.stringify({ title: "Hacked" }),
      headers: { "Content-Type": "application/json" },
    });
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user2 as any);
    const res = await PATCH(req, ctx as any);
    expect(res.status).toBe(404);
  });
});

afterAll(async () => {
  // FK order: listing -> mockupRender -> mockupJob -> selectionItem ->
  // selectionSet -> generatedDesign -> reference -> asset -> store -> user.
  // Paralel suite'ler aynı user'a child bağlamış olabilir — defansif tam temizlik.
  await db.listing.deleteMany({ where: { userId: { in: userIds } } });
  await db.mockupRender.deleteMany({ where: { job: { userId: { in: userIds } } } });
  await db.mockupJob.deleteMany({ where: { userId: { in: userIds } } });
  await db.selectionItem.deleteMany({ where: { selectionSet: { userId: { in: userIds } } } });
  await db.selectionSet.deleteMany({ where: { userId: { in: userIds } } });
  await db.generatedDesign.deleteMany({ where: { userId: { in: userIds } } });
  await db.reference.deleteMany({ where: { userId: { in: userIds } } });
  await db.asset.deleteMany({ where: { userId: { in: userIds } } });
  await db.store.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});
