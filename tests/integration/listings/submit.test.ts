// Phase 9 V1 Task 10 — submitListingDraft service integration tests.
// Provider mock'lanır; live Etsy çağrısı YOK.

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";

vi.mock("@/providers/etsy", async () => {
  const actual = await vi.importActual<typeof import("@/providers/etsy")>(
    "@/providers/etsy",
  );
  return {
    ...actual,
    getEtsyProvider: vi.fn(),
    resolveEtsyConnection: vi.fn(),
    isEtsyConfigured: vi.fn(),
  };
});

import { db } from "@/server/db";
import {
  submitListingDraft,
  ListingSubmitNotFoundError,
  ListingSubmitNotEditableError,
  ListingSubmitMissingFieldsError,
  buildEtsyDraftPayload,
} from "@/features/listings/server/submit.service";
import {
  getEtsyProvider,
  resolveEtsyConnection,
  isEtsyConfigured,
  EtsyConnectionNotFoundError,
  EtsyNotConfiguredError,
  EtsyApiError,
} from "@/providers/etsy";

const TEST_PREFIX = "phase9-submit";
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

beforeAll(async () => {
  // No-op
});

beforeEach(() => {
  vi.mocked(isEtsyConfigured).mockReset();
  vi.mocked(resolveEtsyConnection).mockReset();
  vi.mocked(getEtsyProvider).mockReset();
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

describe("buildEtsyDraftPayload", () => {
  it("V1 default'ları ile payload üretir (whoMade=i_did, made_to_order, q=1, isDigital=true, taxonomy=null)", () => {
    const payload = buildEtsyDraftPayload({
      title: "Wall Art",
      description: "Beautiful art",
      tags: ["art", "wall"],
      materials: ["paper"],
      priceCents: 1234,
    });
    expect(payload).toEqual({
      title: "Wall Art",
      description: "Beautiful art",
      priceUsd: 12.34,
      tags: ["art", "wall"],
      materials: ["paper"],
      taxonomyId: null,
      isDigital: true,
      quantity: 1,
      whoMade: "i_did",
      whenMade: "made_to_order",
    });
  });

  it("null değerler için 0 / boş default", () => {
    const payload = buildEtsyDraftPayload({
      title: null,
      description: null,
      tags: [],
      materials: [],
      priceCents: null,
    });
    expect(payload.title).toBe("");
    expect(payload.description).toBe("");
    expect(payload.priceUsd).toBe(0);
  });
});

describe("submitListingDraft", () => {
  it("ListingSubmitNotFoundError — listing yok", async () => {
    const user = await ensureUser(uniqueEmail("nf-userless"));
    userIds.push(user.id);

    await expect(
      submitListingDraft("nonexistent-id", user.id),
    ).rejects.toThrow(ListingSubmitNotFoundError);
  });

  it("ListingSubmitNotFoundError — cross-user listing", async () => {
    const user1 = await ensureUser(uniqueEmail("cross1"));
    const user2 = await ensureUser(uniqueEmail("cross2"));
    userIds.push(user1.id, user2.id);

    const listing = await db.listing.create({
      data: {
        userId: user1.id,
        title: "X",
        description: "y",
        priceCents: 500,
        status: "DRAFT",
      },
    });

    await expect(
      submitListingDraft(listing.id, user2.id),
    ).rejects.toThrow(ListingSubmitNotFoundError);
  });

  it("ListingSubmitNotEditableError — status PUBLISHED → 409", async () => {
    const user = await ensureUser(uniqueEmail("pub"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Pub",
        description: "y",
        priceCents: 500,
        status: "PUBLISHED",
      },
    });

    await expect(
      submitListingDraft(listing.id, user.id),
    ).rejects.toThrow(ListingSubmitNotEditableError);
  });

  it("ListingSubmitMissingFieldsError — title null → 422 + missing array", async () => {
    const user = await ensureUser(uniqueEmail("miss"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        // title yok
        description: "yes",
        priceCents: 500,
        status: "DRAFT",
      },
    });

    let caught: unknown;
    try {
      await submitListingDraft(listing.id, user.id);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ListingSubmitMissingFieldsError);
    const err = caught as ListingSubmitMissingFieldsError;
    expect((err.details as { missing: string[] }).missing).toContain("title");
  });

  it("EtsyNotConfiguredError — isEtsyConfigured() false → 503", async () => {
    const user = await ensureUser(uniqueEmail("notconf"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Title",
        description: "Desc",
        priceCents: 500,
        status: "DRAFT",
      },
    });

    vi.mocked(isEtsyConfigured).mockReturnValue(false);

    await expect(
      submitListingDraft(listing.id, user.id),
    ).rejects.toThrow(EtsyNotConfiguredError);
  });

  it("EtsyConnectionNotFoundError — resolveEtsyConnection throw → 400", async () => {
    const user = await ensureUser(uniqueEmail("noconn"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Title",
        description: "Desc",
        priceCents: 500,
        status: "DRAFT",
      },
    });

    vi.mocked(isEtsyConfigured).mockReturnValue(true);
    vi.mocked(resolveEtsyConnection).mockRejectedValue(
      new EtsyConnectionNotFoundError(),
    );

    await expect(
      submitListingDraft(listing.id, user.id),
    ).rejects.toThrow(EtsyConnectionNotFoundError);
  });

  it("happy path mock — provider.createDraftListing → listing PUBLISHED, etsyListingId yazıldı, snapshot format", async () => {
    const user = await ensureUser(uniqueEmail("happy"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Title",
        description: "Desc",
        priceCents: 1500,
        tags: ["a", "b"],
        materials: [],
        status: "DRAFT",
      },
    });

    vi.mocked(isEtsyConfigured).mockReturnValue(true);
    vi.mocked(resolveEtsyConnection).mockResolvedValue({
      connection: {} as any,
      accessToken: "decrypted-at",
      shopId: "55555",
    });
    const createDraftListing = vi.fn().mockResolvedValue({
      etsyListingId: "888777",
      state: "draft",
    });
    vi.mocked(getEtsyProvider).mockReturnValue({
      id: "etsy-api",
      apiVersion: "v3",
      createDraftListing,
      uploadListingImage: vi.fn(),
    });

    const result = await submitListingDraft(listing.id, user.id);

    expect(result.status).toBe("PUBLISHED");
    expect(result.etsyListingId).toBe("888777");
    expect(result.failedReason).toBeNull();
    // Snapshot format: "etsy-api-v3@YYYY-MM-DD"
    expect(result.providerSnapshot).toMatch(/^etsy-api-v3@\d{4}-\d{2}-\d{2}$/);

    // DB persist doğrulama
    const updated = await db.listing.findUnique({ where: { id: listing.id } });
    expect(updated?.status).toBe("PUBLISHED");
    expect(updated?.etsyListingId).toBe("888777");
    expect(updated?.submittedAt).toBeInstanceOf(Date);
    expect(updated?.publishedAt).toBeInstanceOf(Date);
    expect(updated?.failedReason).toBeNull();

    // Provider çağrı kontrolü
    expect(createDraftListing).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Title",
        priceUsd: 15,
        whoMade: "i_did",
        whenMade: "made_to_order",
        quantity: 1,
        isDigital: true,
        taxonomyId: null,
      }),
      expect.objectContaining({
        accessToken: "decrypted-at",
        shopId: "55555",
      }),
    );
  });

  it("provider hata fırlatınca — listing FAILED, failedReason persist", async () => {
    const user = await ensureUser(uniqueEmail("provfail"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Title",
        description: "Desc",
        priceCents: 1500,
        status: "DRAFT",
      },
    });

    vi.mocked(isEtsyConfigured).mockReturnValue(true);
    vi.mocked(resolveEtsyConnection).mockResolvedValue({
      connection: {} as any,
      accessToken: "at",
      shopId: "1",
    });
    vi.mocked(getEtsyProvider).mockReturnValue({
      id: "etsy-api",
      apiVersion: "v3",
      createDraftListing: vi
        .fn()
        .mockRejectedValue(new EtsyApiError("upstream down", 502)),
      uploadListingImage: vi.fn(),
    });

    await expect(
      submitListingDraft(listing.id, user.id),
    ).rejects.toThrow(EtsyApiError);

    const updated = await db.listing.findUnique({ where: { id: listing.id } });
    expect(updated?.status).toBe("FAILED");
    expect(updated?.failedReason).toContain("upstream down");
    expect(updated?.submittedAt).toBeInstanceOf(Date);
    expect(updated?.etsyListingId).toBeNull();
  });
});
