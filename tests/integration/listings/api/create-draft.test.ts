// Phase 9 V1 Task 13 — POST /api/listings/draft API test.
//
// Test scenarios: auth, validation, happy path via mock service.

import { describe, it, expect, afterAll, vi, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/features/listings/server/handoff.service");

import { POST } from "@/app/api/listings/draft/route";
import { requireUser } from "@/server/session";
import { createListingDraftFromMockupJob, ListingHandoffJobNotFoundError } from "@/features/listings/server/handoff.service";

// Stable prefix + per-test nonce → paralel suite collision'ı önler.
const TEST_PREFIX = "phase9-create-draft";
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

describe("POST /api/listings/draft", () => {
  beforeAll(() => {
    vi.mocked(requireUser).mockResolvedValue({ id: "test-user-id" } as any);
    vi.mocked(createListingDraftFromMockupJob).mockResolvedValue({
      listingId: "test-listing-id",
    } as any);
  });

  it("202 — happy path: service called, listingId returned", async () => {
    const user = await ensureUser(uniqueEmail("202"));
    userIds.push(user.id);

    const req = new Request("http://localhost/api/listings/draft", {
      method: "POST",
      body: JSON.stringify({ mockupJobId: "clz0000000000000000000001" }),
      headers: { "Content-Type": "application/json" },
    });

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req);
    expect(res.status).toBe(202);

    const data = (await res.json()) as { listingId: string };
    expect(data.listingId).toBe("test-listing-id");
  });

  it("400 — validation: mockupJobId eksik", async () => {
    const user = await ensureUser(uniqueEmail("400a"));
    userIds.push(user.id);

    const req = new Request("http://localhost/api/listings/draft", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("400 — validation: mockupJobId not cuid", async () => {
    const user = await ensureUser(uniqueEmail("400b"));
    userIds.push(user.id);

    const req = new Request("http://localhost/api/listings/draft", {
      method: "POST",
      body: JSON.stringify({ mockupJobId: "invalid" }),
      headers: { "Content-Type": "application/json" },
    });

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

});

afterAll(async () => {
  // FK order: listing -> mockupRender -> mockupJob -> selectionItem ->
  // selectionSet -> generatedDesign -> reference -> asset -> store -> user.
  // Bu suite çoğunlukla sadece user yaratıyor, ama paralel suite'ler aynı
  // user'a child bağlamış olabilir — defansif tam temizlik.
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
