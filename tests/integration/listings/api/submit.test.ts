// Phase 9 V1 Task 17 — POST /api/listings/draft/[id]/submit endpoint test.
// Service mock'lanır; endpoint AppError → HTTP map davranışı doğrulanır.

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/features/listings/server/submit.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/listings/server/submit.service")
  >("@/features/listings/server/submit.service");
  return {
    ...actual,
    submitListingDraft: vi.fn(),
  };
});

import { POST } from "@/app/api/listings/draft/[id]/submit/route";
import { requireUser } from "@/server/session";
import { submitListingDraft } from "@/features/listings/server/submit.service";
import {
  ListingSubmitMissingFieldsError,
} from "@/features/listings/server/submit.service";
import {
  EtsyApiError,
  EtsyConnectionNotFoundError,
  EtsyNotConfiguredError,
} from "@/providers/etsy";

const TEST_PREFIX = "phase9-api-submit";
let nonce = 0;
function uniqueEmail(label: string) {
  return `${TEST_PREFIX}-${label}-${Date.now()}-${++nonce}-${Math.random()
    .toString(36)
    .slice(2, 8)}@test.local`;
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

beforeAll(() => {
  // No-op
});

beforeEach(() => {
  vi.mocked(submitListingDraft).mockReset();
});

afterAll(async () => {
  // FK order: listing -> etsyConnection -> store -> user
  await db.listing.deleteMany({ where: { userId: { in: userIds } } });
  await db.etsyConnection.deleteMany({
    where: { store: { userId: { in: userIds } } },
  });
  await db.store.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("POST /api/listings/draft/[id]/submit", () => {
  it("400 — invalid id (not a cuid)", async () => {
    const user = await ensureUser(uniqueEmail("badid"));
    userIds.push(user.id);
    vi.mocked(requireUser).mockResolvedValueOnce(user as any);

    const req = new Request("http://localhost/api/listings/draft/bad/submit", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, { params: { id: "not-a-cuid" } });
    expect(res.status).toBe(400);
  });

  it("400 — body strict (extra field rejected)", async () => {
    const user = await ensureUser(uniqueEmail("strict"));
    userIds.push(user.id);
    vi.mocked(requireUser).mockResolvedValueOnce(user as any);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "T",
        description: "D",
        priceCents: 500,
        status: "DRAFT",
      },
    });

    const req = new Request(
      "http://localhost/api/listings/draft/" + listing.id + "/submit",
      {
        method: "POST",
        body: JSON.stringify({ dryRun: true }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: { id: listing.id } });
    expect(res.status).toBe(400);
  });

  it("happy path — service mock döner, response { status:'PUBLISHED', etsyListingId, ... }", async () => {
    const user = await ensureUser(uniqueEmail("happy"));
    userIds.push(user.id);
    vi.mocked(requireUser).mockResolvedValueOnce(user as any);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "T",
        description: "D",
        priceCents: 500,
        status: "DRAFT",
      },
    });

    vi.mocked(submitListingDraft).mockResolvedValue({
      status: "PUBLISHED",
      etsyListingId: "11111",
      failedReason: null,
      providerSnapshot: "etsy-api-v3@2026-05-03",
    });

    const req = new Request(
      "http://localhost/api/listings/draft/" + listing.id + "/submit",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: { id: listing.id } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      etsyListingId: string;
      providerSnapshot: string;
    };
    expect(body.status).toBe("PUBLISHED");
    expect(body.etsyListingId).toBe("11111");
    expect(body.providerSnapshot).toMatch(/^etsy-api-v3@/);
  });

  it("503 — service EtsyNotConfiguredError", async () => {
    const user = await ensureUser(uniqueEmail("503"));
    userIds.push(user.id);
    vi.mocked(requireUser).mockResolvedValueOnce(user as any);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "T",
        description: "D",
        priceCents: 500,
        status: "DRAFT",
      },
    });

    vi.mocked(submitListingDraft).mockRejectedValue(
      new EtsyNotConfiguredError(),
    );

    const req = new Request(
      "http://localhost/api/listings/draft/" + listing.id + "/submit",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: { id: listing.id } });
    expect(res.status).toBe(503);
  });

  it("400 — service EtsyConnectionNotFoundError", async () => {
    const user = await ensureUser(uniqueEmail("400conn"));
    userIds.push(user.id);
    vi.mocked(requireUser).mockResolvedValueOnce(user as any);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "T",
        description: "D",
        priceCents: 500,
        status: "DRAFT",
      },
    });

    vi.mocked(submitListingDraft).mockRejectedValue(
      new EtsyConnectionNotFoundError(),
    );

    const req = new Request(
      "http://localhost/api/listings/draft/" + listing.id + "/submit",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: { id: listing.id } });
    expect(res.status).toBe(400);
  });

  it("422 — service ListingSubmitMissingFieldsError + missing details", async () => {
    const user = await ensureUser(uniqueEmail("422"));
    userIds.push(user.id);
    vi.mocked(requireUser).mockResolvedValueOnce(user as any);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        // title yok
        description: "D",
        priceCents: 500,
        status: "DRAFT",
      },
    });

    vi.mocked(submitListingDraft).mockRejectedValue(
      new ListingSubmitMissingFieldsError(["title"]),
    );

    const req = new Request(
      "http://localhost/api/listings/draft/" + listing.id + "/submit",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: { id: listing.id } });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { details: { missing: string[] } };
    expect(body.details.missing).toContain("title");
  });

  it("502 — service EtsyApiError", async () => {
    const user = await ensureUser(uniqueEmail("502"));
    userIds.push(user.id);
    vi.mocked(requireUser).mockResolvedValueOnce(user as any);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "T",
        description: "D",
        priceCents: 500,
        status: "DRAFT",
      },
    });

    vi.mocked(submitListingDraft).mockRejectedValue(
      new EtsyApiError("upstream down", 502),
    );

    const req = new Request(
      "http://localhost/api/listings/draft/" + listing.id + "/submit",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, { params: { id: listing.id } });
    expect(res.status).toBe(502);
  });
});
