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
    resolveEtsyConnectionWithRefresh: vi.fn(),
    isEtsyConfigured: vi.fn(),
  };
});

vi.mock("@/features/listings/server/image-upload.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/listings/server/image-upload.service")
  >("@/features/listings/server/image-upload.service");
  return {
    ...actual,
    uploadListingImages: vi.fn(),
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
  resolveEtsyConnectionWithRefresh,
  isEtsyConfigured,
  EtsyConnectionNotFoundError,
  EtsyNotConfiguredError,
  EtsyApiError,
  EtsyTaxonomyMissingError,
  EtsyTokenRefreshFailedError,
  resetTaxonomyCache,
} from "@/providers/etsy";
import {
  uploadListingImages,
  ListingImageUploadAllFailedError,
} from "@/features/listings/server/image-upload.service";

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

const ORIG_TAXONOMY_ENV = process.env.ETSY_TAXONOMY_MAP_JSON;

beforeEach(() => {
  vi.mocked(isEtsyConfigured).mockReset();
  vi.mocked(resolveEtsyConnectionWithRefresh).mockReset();
  vi.mocked(getEtsyProvider).mockReset();
  vi.mocked(uploadListingImages).mockReset();
  // Default: image upload mock success path (boş imageOrder → noop)
  vi.mocked(uploadListingImages).mockResolvedValue({
    successCount: 0,
    failedCount: 0,
    partial: false,
    attempts: [],
  });
  // Taxonomy mapping default: 8 ProductType seed key + freeform "category" string
  // pattern'leri (örn. "T", "D" testi minimal alan setlerinde category null;
  // resolveProductTypeKey o durumda EtsyTaxonomyMissingError fırlatır — testler
  // category set ediyorsa fallback path için "t","d" gibi normalize key'leri
  // de map'e koy).
  process.env.ETSY_TAXONOMY_MAP_JSON = JSON.stringify({
    canvas: 100,
    wall_art: 2078,
    printable: 1,
    clipart: 2,
    sticker: 1208,
    tshirt: 3,
    hoodie: 4,
    dtf: 5,
    // Free-form category fallback'leri (testlerde category alanı set edildiyse):
    generic: 99,
  });
  resetTaxonomyCache();
});

afterAll(async () => {
  // FK order: listing -> etsyConnection -> store -> user
  await db.listing.deleteMany({ where: { userId: { in: userIds } } });
  await db.etsyConnection.deleteMany({
    where: { store: { userId: { in: userIds } } },
  });
  await db.store.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });

  // Restore taxonomy env
  if (ORIG_TAXONOMY_ENV === undefined) {
    delete process.env.ETSY_TAXONOMY_MAP_JSON;
  } else {
    process.env.ETSY_TAXONOMY_MAP_JSON = ORIG_TAXONOMY_ENV;
  }
  resetTaxonomyCache();
});

describe("buildEtsyDraftPayload", () => {
  it("V1 default'ları ile payload üretir (whoMade=i_did, made_to_order, q=1, isDigital=true) + taxonomyId caller'dan gelir", () => {
    const payload = buildEtsyDraftPayload(
      {
        title: "Wall Art",
        description: "Beautiful art",
        tags: ["art", "wall"],
        materials: ["paper"],
        priceCents: 1234,
      },
      2078,
    );
    expect(payload).toEqual({
      title: "Wall Art",
      description: "Beautiful art",
      priceUsd: 12.34,
      tags: ["art", "wall"],
      materials: ["paper"],
      taxonomyId: 2078,
      isDigital: true,
      quantity: 1,
      whoMade: "i_did",
      whenMade: "made_to_order",
    });
  });

  it("null değerler için 0 / boş default", () => {
    const payload = buildEtsyDraftPayload(
      {
        title: null,
        description: null,
        tags: [],
        materials: [],
        priceCents: null,
      },
      1234,
    );
    expect(payload.title).toBe("");
    expect(payload.description).toBe("");
    expect(payload.priceUsd).toBe(0);
    expect(payload.taxonomyId).toBe(1234);
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
    vi.mocked(resolveEtsyConnectionWithRefresh).mockRejectedValue(
      new EtsyConnectionNotFoundError(),
    );

    await expect(
      submitListingDraft(listing.id, user.id),
    ).rejects.toThrow(EtsyConnectionNotFoundError);
  });

  it("happy path mock — provider.createDraftListing → listing PUBLISHED, etsyListingId yazıldı, snapshot format, taxonomy resolve edildi", async () => {
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
        category: "wall_art",
        status: "DRAFT",
      },
    });

    vi.mocked(isEtsyConfigured).mockReturnValue(true);
    vi.mocked(resolveEtsyConnectionWithRefresh).mockResolvedValue({
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

    // Provider çağrı kontrolü — taxonomyId artık resolve edilmiş (wall_art → 2078)
    expect(createDraftListing).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Title",
        priceUsd: 15,
        whoMade: "i_did",
        whenMade: "made_to_order",
        quantity: 1,
        isDigital: true,
        taxonomyId: 2078,
      }),
      expect.objectContaining({
        accessToken: "decrypted-at",
        shopId: "55555",
      }),
    );

    // Image upload mock çağrıldı (boş imageOrder default — noop)
    expect(uploadListingImages).toHaveBeenCalledWith(
      expect.objectContaining({
        etsyListingId: "888777",
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
        category: "wall_art",
        status: "DRAFT",
      },
    });

    vi.mocked(isEtsyConfigured).mockReturnValue(true);
    vi.mocked(resolveEtsyConnectionWithRefresh).mockResolvedValue({
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

    // Image upload denenmedi (draft create fail oldu)
    expect(uploadListingImages).not.toHaveBeenCalled();
  });

  it("EtsyTaxonomyMissing — env mapping yoksa 422 honest fail", async () => {
    const user = await ensureUser(uniqueEmail("taxomiss"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Title",
        description: "Desc",
        priceCents: 500,
        category: "unknown_type", // map'te yok
        status: "DRAFT",
      },
    });

    vi.mocked(isEtsyConfigured).mockReturnValue(true);
    vi.mocked(resolveEtsyConnectionWithRefresh).mockResolvedValue({
      connection: {} as any,
      accessToken: "at",
      shopId: "1",
    });

    await expect(
      submitListingDraft(listing.id, user.id),
    ).rejects.toThrow(EtsyTaxonomyMissingError);

    // Provider çağrılmadı (taxonomy resolve fail oldu)
    expect(uploadListingImages).not.toHaveBeenCalled();
  });

  it("EtsyTaxonomyMissing — productType ve category boşsa 422", async () => {
    const user = await ensureUser(uniqueEmail("taxonothing"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Title",
        description: "Desc",
        priceCents: 500,
        // category yok, productTypeId yok
        status: "DRAFT",
      },
    });

    vi.mocked(isEtsyConfigured).mockReturnValue(true);
    vi.mocked(resolveEtsyConnectionWithRefresh).mockResolvedValue({
      connection: {} as any,
      accessToken: "at",
      shopId: "1",
    });

    await expect(
      submitListingDraft(listing.id, user.id),
    ).rejects.toThrow(EtsyTaxonomyMissingError);
  });

  it("happy path with image upload — partial fail durumu PUBLISHED + failedReason mesajı içerir", async () => {
    const user = await ensureUser(uniqueEmail("imgpartial"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Title",
        description: "Desc",
        priceCents: 1500,
        category: "wall_art",
        status: "DRAFT",
        imageOrderJson: [
          { packPosition: 0, renderId: "r0", outputKey: "k0", templateName: "tpl-c", isCover: true },
          { packPosition: 1, renderId: "r1", outputKey: "k1", templateName: "tpl-1", isCover: false },
          { packPosition: 2, renderId: "r2", outputKey: "k2", templateName: "tpl-2", isCover: false },
        ],
      },
    });

    vi.mocked(isEtsyConfigured).mockReturnValue(true);
    vi.mocked(resolveEtsyConnectionWithRefresh).mockResolvedValue({
      connection: {} as any,
      accessToken: "at",
      shopId: "55",
    });
    vi.mocked(getEtsyProvider).mockReturnValue({
      id: "etsy-api",
      apiVersion: "v3",
      createDraftListing: vi.fn().mockResolvedValue({
        etsyListingId: "L-PARTIAL",
        state: "draft",
      }),
      uploadListingImage: vi.fn(),
    });
    vi.mocked(uploadListingImages).mockResolvedValue({
      successCount: 2,
      failedCount: 1,
      partial: true,
      attempts: [
        { rank: 1, packPosition: 0, renderId: "r0", isCover: true, ok: true, etsyImageId: "i1" },
        { rank: 2, packPosition: 1, renderId: "r1", isCover: false, ok: false, error: "503 maintenance" },
        { rank: 3, packPosition: 2, renderId: "r2", isCover: false, ok: true, etsyImageId: "i3" },
      ],
    });

    const result = await submitListingDraft(listing.id, user.id);

    expect(result.status).toBe("PUBLISHED");
    expect(result.etsyListingId).toBe("L-PARTIAL");
    expect(result.failedReason).toContain("kısmen başarısız");
    expect(result.failedReason).toContain("rank=2");
    expect(result.imageUpload?.partial).toBe(true);
    expect(result.imageUpload?.successCount).toBe(2);
    expect(result.imageUpload?.failedCount).toBe(1);

    // DB persist
    const updated = await db.listing.findUnique({ where: { id: listing.id } });
    expect(updated?.status).toBe("PUBLISHED");
    expect(updated?.etsyListingId).toBe("L-PARTIAL");
    expect(updated?.failedReason).toContain("kısmen başarısız");
    expect(updated?.publishedAt).toBeInstanceOf(Date);
  });

  it("all-failed image upload — listing FAILED + etsyListingId persist (orphan listing)", async () => {
    const user = await ensureUser(uniqueEmail("imgallfail"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Title",
        description: "Desc",
        priceCents: 1500,
        category: "wall_art",
        status: "DRAFT",
        imageOrderJson: [
          { packPosition: 0, renderId: "r0", outputKey: "k0", templateName: "tpl", isCover: true },
        ],
      },
    });

    vi.mocked(isEtsyConfigured).mockReturnValue(true);
    vi.mocked(resolveEtsyConnectionWithRefresh).mockResolvedValue({
      connection: {} as any,
      accessToken: "at",
      shopId: "55",
    });
    vi.mocked(getEtsyProvider).mockReturnValue({
      id: "etsy-api",
      apiVersion: "v3",
      createDraftListing: vi.fn().mockResolvedValue({
        etsyListingId: "L-ORPHAN",
        state: "draft",
      }),
      uploadListingImage: vi.fn(),
    });
    vi.mocked(uploadListingImages).mockRejectedValue(
      new ListingImageUploadAllFailedError(
        "rank=1: storage offline",
        [1],
      ),
    );

    await expect(
      submitListingDraft(listing.id, user.id),
    ).rejects.toThrow(ListingImageUploadAllFailedError);

    // DB persist — listing FAILED ama etsyListingId orphan olarak set
    const updated = await db.listing.findUnique({ where: { id: listing.id } });
    expect(updated?.status).toBe("FAILED");
    expect(updated?.etsyListingId).toBe("L-ORPHAN");
    expect(updated?.failedReason).toContain("Listing image upload tamamen başarısız");
    expect(updated?.submittedAt).toBeInstanceOf(Date);
    expect(updated?.publishedAt).toBeNull();
  });

  it("happy path with image upload — full success → PUBLISHED + failedReason null + imageUpload counts", async () => {
    const user = await ensureUser(uniqueEmail("imghappy"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Title",
        description: "Desc",
        priceCents: 1500,
        category: "sticker",
        status: "DRAFT",
        imageOrderJson: [
          { packPosition: 0, renderId: "r0", outputKey: "k0", templateName: "tpl", isCover: true },
          { packPosition: 1, renderId: "r1", outputKey: "k1", templateName: "tpl", isCover: false },
        ],
      },
    });

    vi.mocked(isEtsyConfigured).mockReturnValue(true);
    vi.mocked(resolveEtsyConnectionWithRefresh).mockResolvedValue({
      connection: {} as any,
      accessToken: "at",
      shopId: "10",
    });
    vi.mocked(getEtsyProvider).mockReturnValue({
      id: "etsy-api",
      apiVersion: "v3",
      createDraftListing: vi.fn().mockResolvedValue({
        etsyListingId: "L-OK",
        state: "draft",
      }),
      uploadListingImage: vi.fn(),
    });
    vi.mocked(uploadListingImages).mockResolvedValue({
      successCount: 2,
      failedCount: 0,
      partial: false,
      attempts: [
        { rank: 1, packPosition: 0, renderId: "r0", isCover: true, ok: true, etsyImageId: "i1" },
        { rank: 2, packPosition: 1, renderId: "r1", isCover: false, ok: true, etsyImageId: "i2" },
      ],
    });

    const result = await submitListingDraft(listing.id, user.id);

    expect(result.status).toBe("PUBLISHED");
    expect(result.failedReason).toBeNull();
    expect(result.imageUpload?.partial).toBe(false);
    expect(result.imageUpload?.successCount).toBe(2);

    // Provider çağrısı taxonomy=sticker (1208) ile yapıldı
    const calls = vi.mocked(getEtsyProvider).mock.results;
    const providerInst = calls[calls.length - 1]!.value as {
      createDraftListing: ReturnType<typeof vi.fn>;
    };
    expect(providerInst.createDraftListing).toHaveBeenCalledWith(
      expect.objectContaining({ taxonomyId: 1208 }),
      expect.any(Object),
    );

    const updated = await db.listing.findUnique({ where: { id: listing.id } });
    expect(updated?.failedReason).toBeNull();
  });

  // ────────────────────────────────────────────────────────────
  // Phase 9 V1 — token refresh resilience integration (submit pipeline)
  //
  // resolveEtsyConnectionWithRefresh refresh path'inde sessizce yeni token
  // döner; submit pipeline farkına bile varmaz. Refresh fail durumunda
  // typed EtsyTokenRefreshFailedError 401 fırlatılır; listing'e dokunulmaz
  // (provider çağrılmadığı için draft create denenmemiştir; image upload
  // path da hiç açılmaz). Bu davranış endpoint'te 401'e map edilir.
  // ────────────────────────────────────────────────────────────

  it("refresh success — pipeline expired token görür, refresh sessizce yeni token döndürür, PUBLISHED yolu açılır", async () => {
    const user = await ensureUser(uniqueEmail("refresh-ok"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Title",
        description: "Desc",
        priceCents: 1500,
        category: "wall_art",
        status: "DRAFT",
      },
    });

    vi.mocked(isEtsyConfigured).mockReturnValue(true);
    // Helper içinde refresh tamamlandı varsay; pipeline'a fresh accessToken döner
    vi.mocked(resolveEtsyConnectionWithRefresh).mockResolvedValue({
      connection: {} as any,
      accessToken: "fresh-after-refresh",
      shopId: "55555",
    });
    const createDraftListing = vi.fn().mockResolvedValue({
      etsyListingId: "L-REFRESHED",
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
    expect(result.etsyListingId).toBe("L-REFRESHED");

    // Provider, refresh sonrası fresh accessToken ile çağrıldı (pipeline farkına varmadı)
    expect(createDraftListing).toHaveBeenCalledWith(
      expect.objectContaining({ taxonomyId: 2078 }),
      expect.objectContaining({ accessToken: "fresh-after-refresh" }),
    );
  });

  it("refresh fail — EtsyTokenRefreshFailedError 401, listing DRAFT'ta kalır (provider çağrılmaz)", async () => {
    const user = await ensureUser(uniqueEmail("refresh-fail"));
    userIds.push(user.id);

    const listing = await db.listing.create({
      data: {
        userId: user.id,
        title: "Title",
        description: "Desc",
        priceCents: 1500,
        category: "wall_art",
        status: "DRAFT",
      },
    });

    vi.mocked(isEtsyConfigured).mockReturnValue(true);
    vi.mocked(resolveEtsyConnectionWithRefresh).mockRejectedValue(
      new EtsyTokenRefreshFailedError("invalid_grant"),
    );

    let caught: unknown;
    try {
      await submitListingDraft(listing.id, user.id);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EtsyTokenRefreshFailedError);
    expect((caught as EtsyTokenRefreshFailedError).status).toBe(401);
    expect((caught as EtsyTokenRefreshFailedError).message).toContain(
      "Etsy token yenileme başarısız",
    );

    // Listing DRAFT'ta kalmış olmalı (provider hiç çağrılmadı, image upload hiç açılmadı)
    const updated = await db.listing.findUnique({ where: { id: listing.id } });
    expect(updated?.status).toBe("DRAFT");
    expect(updated?.etsyListingId).toBeNull();
    expect(updated?.failedReason).toBeNull();
    expect(updated?.submittedAt).toBeNull();
    expect(getEtsyProvider).not.toHaveBeenCalled();
    expect(uploadListingImages).not.toHaveBeenCalled();
  });
});
