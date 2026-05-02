// Phase 9 V1 Task 16 — POST /api/listings/draft/[id]/generate-meta API test.
//
// Endpoint HTTP layer test'i: auth, body validation, error mapping.
// generateListingMeta service mock'lanır (zaten kendi unit/integration suite'inde test edildi);
// burada endpoint'in withErrorHandling üzerinden AppError → HTTP map'lemesi doğrulanır.
//
// Pattern: update-draft.test.ts (uniqueEmail, FK-safe cleanup) + service mock.

import { describe, it, expect, afterAll, vi, beforeAll, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/features/listings/server/generate-meta.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/listings/server/generate-meta.service")
  >("@/features/listings/server/generate-meta.service");
  return {
    ...actual,
    generateListingMeta: vi.fn(),
  };
});

import { POST } from "@/app/api/listings/draft/[id]/generate-meta/route";
import { requireUser } from "@/server/session";
import {
  generateListingMeta,
  ListingMetaListingNotFoundError,
  ListingMetaProviderNotConfiguredError,
  ListingMetaProviderError,
} from "@/features/listings/server/generate-meta.service";

// Stable prefix + per-test nonce → paralel suite collision'ı önler.
const TEST_PREFIX = "phase9-api-generate-meta";
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

describe("POST /api/listings/draft/[id]/generate-meta", () => {
  beforeAll(() => {
    vi.mocked(requireUser).mockResolvedValue({ id: "test-user-id" } as any);
  });

  beforeEach(() => {
    vi.mocked(generateListingMeta).mockReset();
  });

  it("400 — invalid id (path schema cuid fail)", async () => {
    const user = await ensureUser(uniqueEmail("invalid-id"));
    userIds.push(user.id);

    const req = new Request("http://localhost/api/listings/draft/not-a-cuid/generate-meta", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const ctx = { params: { id: "not-a-cuid" } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(400);
    expect(vi.mocked(generateListingMeta)).not.toHaveBeenCalled();
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

    const req = new Request(
      "http://localhost/api/listings/draft/" + listing.id + "/generate-meta",
      {
        method: "POST",
        body: JSON.stringify({ provider: "openai" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(400);
    expect(vi.mocked(generateListingMeta)).not.toHaveBeenCalled();
  });

  it("200 — happy path: service result response shape", async () => {
    const user = await ensureUser(uniqueEmail("happy"));
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

    const tags = Array.from({ length: 13 }, (_, i) => `tag${i + 1}`);
    vi.mocked(generateListingMeta).mockResolvedValueOnce({
      output: {
        title: "AI Title",
        description: "AI Desc",
        tags,
      },
      providerSnapshot: "gemini-2.5-flash@2026-05-03",
      promptVersion: "v1.0",
    });

    const req = new Request(
      "http://localhost/api/listings/draft/" + listing.id + "/generate-meta",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
    );
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      output: { title: string; description: string; tags: string[] };
      providerSnapshot: string;
      promptVersion: string;
    };
    expect(body.output.title).toBe("AI Title");
    expect(body.output.description).toBe("AI Desc");
    expect(body.output.tags).toEqual(tags);
    expect(body.providerSnapshot).toBe("gemini-2.5-flash@2026-05-03");
    expect(body.promptVersion).toBe("v1.0");

    expect(vi.mocked(generateListingMeta)).toHaveBeenCalledWith(
      listing.id,
      user.id,
      expect.objectContaining({ toneHint: null }),
    );
  });

  it("404 — service ListingNotFound (cross-user)", async () => {
    const user = await ensureUser(uniqueEmail("notfound"));
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

    vi.mocked(generateListingMeta).mockRejectedValueOnce(
      new ListingMetaListingNotFoundError(),
    );

    const req = new Request(
      "http://localhost/api/listings/draft/" + listing.id + "/generate-meta",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
    );
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(404);
  });

  it("400 — service NotConfigured", async () => {
    const user = await ensureUser(uniqueEmail("notconfig"));
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

    vi.mocked(generateListingMeta).mockRejectedValueOnce(
      new ListingMetaProviderNotConfiguredError(),
    );

    const req = new Request(
      "http://localhost/api/listings/draft/" + listing.id + "/generate-meta",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
    );
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("LISTING_META_PROVIDER_NOT_CONFIGURED");
  });

  it("502 — service ProviderError", async () => {
    const user = await ensureUser(uniqueEmail("provider-err"));
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

    vi.mocked(generateListingMeta).mockRejectedValueOnce(
      new ListingMetaProviderError("upstream timeout"),
    );

    const req = new Request(
      "http://localhost/api/listings/draft/" + listing.id + "/generate-meta",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
    );
    const ctx = { params: { id: listing.id } };

    vi.mocked(requireUser).mockResolvedValueOnce(user as any);
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("LISTING_META_PROVIDER_ERROR");
  });
});

afterAll(async () => {
  // FK order: listing -> store -> userSetting -> user.
  await db.listing.deleteMany({ where: { userId: { in: userIds } } });
  await db.userSetting.deleteMany({ where: { userId: { in: userIds } } });
  await db.store.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});
