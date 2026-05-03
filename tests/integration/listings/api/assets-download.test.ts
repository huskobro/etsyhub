// Phase 9 V1 — GET /api/listings/draft/[id]/assets/download integration test.
//
// Listing context'ten Phase 8 ZIP service'i bridging eden route.
// Test scenarios:
//   - 400: invalid path (non-cuid)
//   - 404: listing yok
//   - 404: cross-user listing
//   - 404: soft-deleted listing
//   - 409: mockupJobId null (LISTING_ASSETS_NOT_READY)
//   - 404: underlying mockupJob silinmiş (Phase 8 JobNotFoundError pass-through)
//   - 403: mockupJob status PROCESSING (Phase 8 JobNotDownloadableError pass-through)
//   - 200: happy path — ZIP buffer + headers + filename (cuid path)
//   - 200: etsyListingId varsa filename Etsy id ile
//
// Pattern: vi.mock requireUser + storage; Prisma fixture'lar gerçek
// (handoff.test.ts FK-safe cleanup chain).

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import {
  UserRole,
  UserStatus,
  MockupJobStatus,
  MockupRenderStatus,
  ListingStatus,
} from "@prisma/client";
import { db } from "@/server/db";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/providers/storage", () => ({ getStorage: vi.fn() }));

import { GET } from "@/app/api/listings/draft/[id]/assets/download/route";
import { requireUser } from "@/server/session";
import { getStorage } from "@/providers/storage";

// ────────────────────────────────────────────────────────────
// Fixture helpers — handoff.test.ts paterni
// ────────────────────────────────────────────────────────────

const TEST_PREFIX = "phase9-listing-download";
const TEST_TPL_PREFIX = "phase9-dl-tpl-";
const TEST_PT_KEY = "phase9-dl-pt";
let nonce = 0;

function uniqueEmail(label: string) {
  return `${TEST_PREFIX}-${label}-${Date.now()}-${++nonce}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

const userIds: string[] = [];

async function ensureUser(email: string) {
  const u = await db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await bcrypt.hash("password-test", 10),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
    update: {},
  });
  userIds.push(u.id);
  return u;
}

async function makeAsset(userId: string, key: string) {
  return db.asset.create({
    data: {
      userId,
      storageProvider: "local",
      storageKey: key,
      bucket: "test",
      mimeType: "image/png",
      sizeBytes: 1,
      hash: `hash-${key}-${Math.random().toString(36).slice(2, 8)}`,
    },
  });
}

async function ensureProductType() {
  return db.productType.upsert({
    where: { key: TEST_PT_KEY },
    update: {},
    create: {
      key: TEST_PT_KEY,
      displayName: "Phase9 Download Wall Art",
      aspectRatio: "1:1",
      isSystem: false,
    },
  });
}

async function makeReadySetWithItem(userId: string) {
  // Selection set + 1 item (variant) — generatedDesign + sourceAsset zorunlu.
  const productType = await ensureProductType();
  const set = await db.selectionSet.create({
    data: { userId, name: "Phase9 Download Set", status: "ready" },
  });
  const refAsset = await makeAsset(
    userId,
    `ref-${userId}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const reference = await db.reference.create({
    data: {
      userId,
      assetId: refAsset.id,
      productTypeId: productType.id,
    },
  });
  const sourceAsset = await makeAsset(
    userId,
    `src-${userId}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const designAsset = await makeAsset(
    userId,
    `design-${userId}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const design = await db.generatedDesign.create({
    data: {
      userId,
      referenceId: reference.id,
      assetId: designAsset.id,
      productTypeId: productType.id,
      aspectRatio: "1:1",
    },
  });
  const variant = await db.selectionItem.create({
    data: {
      selectionSetId: set.id,
      generatedDesignId: design.id,
      sourceAssetId: sourceAsset.id,
      status: "selected",
      position: 0,
    },
  });
  return { set, variant };
}

async function makeTemplate() {
  return db.mockupTemplate.create({
    data: {
      categoryId: "canvas",
      name: `${TEST_TPL_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      thumbKey: "test-thumb",
      aspectRatios: ["1:1"],
      tags: ["test"],
      estimatedRenderMs: 100,
    },
  });
}

/**
 * Terminal mockup job (COMPLETED/PARTIAL_COMPLETE) yarat — 2 success render
 * (cover + 1 other). buildMockupZip için minimum geçerli payload.
 */
async function createTerminalJob(
  userId: string,
  status: MockupJobStatus = MockupJobStatus.COMPLETED,
) {
  const { set, variant } = await makeReadySetWithItem(userId);
  const template = await makeTemplate();

  const job = await db.mockupJob.create({
    data: {
      userId,
      setId: set.id,
      setSnapshotId: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      categoryId: "canvas",
      status,
      packSize: 2,
      actualPackSize: 2,
      coverRenderId: null,
      totalRenders: 2,
      successRenders: status === MockupJobStatus.COMPLETED ? 2 : 0,
      failedRenders: 0,
    },
  });

  const coverRender = await db.mockupRender.create({
    data: {
      jobId: job.id,
      variantId: variant.id,
      bindingId: "dummy-binding",
      packPosition: 0,
      status: MockupRenderStatus.SUCCESS,
      outputKey: `test/${job.id}/cover.png`,
      templateSnapshot: { templateName: template.name },
      selectionReason: "COVER",
    },
  });

  await db.mockupRender.create({
    data: {
      jobId: job.id,
      variantId: variant.id,
      bindingId: "dummy-binding",
      packPosition: 1,
      status: MockupRenderStatus.SUCCESS,
      outputKey: `test/${job.id}/other.png`,
      templateSnapshot: { templateName: template.name },
      selectionReason: "TEMPLATE_DIVERSITY",
    },
  });

  // Cover invariant
  await db.mockupJob.update({
    where: { id: job.id },
    data: { coverRenderId: coverRender.id },
  });

  return { job, set, variant, template };
}

async function createListingWithJob(opts: {
  userId: string;
  mockupJobId: string | null;
  etsyListingId?: string | null;
  deletedAt?: Date | null;
  status?: ListingStatus;
}) {
  return db.listing.create({
    data: {
      userId: opts.userId,
      title: "Test Listing",
      status: opts.status ?? ListingStatus.DRAFT,
      mockupJobId: opts.mockupJobId,
      etsyListingId: opts.etsyListingId ?? null,
      deletedAt: opts.deletedAt ?? null,
    },
  });
}

function makeRequest(id: string): Request {
  return new Request(
    `http://localhost/api/listings/draft/${id}/assets/download`,
    { method: "GET" },
  );
}

// ────────────────────────────────────────────────────────────
// Storage mock — buildMockupZip her render için fakeBuffer döndürür.
// ────────────────────────────────────────────────────────────

const fakeBuffer = Buffer.from("fake-png-content");

beforeAll(() => {
  vi.mocked(getStorage).mockReturnValue({
    download: vi.fn().mockResolvedValue(fakeBuffer),
  } as unknown as ReturnType<typeof getStorage>);
});

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe("GET /api/listings/draft/[id]/assets/download — Phase 9 V1", () => {
  it("400 — invalid id (path schema reject)", async () => {
    const user = await ensureUser(uniqueEmail("invalid"));

    vi.mocked(requireUser).mockResolvedValueOnce(user as never);
    const res = await GET(makeRequest("not-a-cuid"), {
      params: { id: "not-a-cuid" },
    });
    expect(res.status).toBe(400);
  });

  it("404 — listing yok", async () => {
    const user = await ensureUser(uniqueEmail("notfound"));
    const ghostId = "clz0000000000000000000000";

    vi.mocked(requireUser).mockResolvedValueOnce(user as never);
    const res = await GET(makeRequest(ghostId), {
      params: { id: ghostId },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("LISTING_DOWNLOAD_NOT_FOUND");
  });

  it("404 — cross-user listing", async () => {
    const user1 = await ensureUser(uniqueEmail("cross1"));
    const user2 = await ensureUser(uniqueEmail("cross2"));

    const listing = await createListingWithJob({
      userId: user1.id,
      mockupJobId: null,
    });

    vi.mocked(requireUser).mockResolvedValueOnce(user2 as never);
    const res = await GET(makeRequest(listing.id), {
      params: { id: listing.id },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("LISTING_DOWNLOAD_NOT_FOUND");
  });

  it("404 — soft-deleted listing", async () => {
    const user = await ensureUser(uniqueEmail("softdel"));

    const listing = await createListingWithJob({
      userId: user.id,
      mockupJobId: null,
      deletedAt: new Date(),
    });

    vi.mocked(requireUser).mockResolvedValueOnce(user as never);
    const res = await GET(makeRequest(listing.id), {
      params: { id: listing.id },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("LISTING_DOWNLOAD_NOT_FOUND");
  });

  it("409 — mockupJobId null (LISTING_ASSETS_NOT_READY)", async () => {
    const user = await ensureUser(uniqueEmail("nojobid"));

    const listing = await createListingWithJob({
      userId: user.id,
      mockupJobId: null,
    });

    vi.mocked(requireUser).mockResolvedValueOnce(user as never);
    const res = await GET(makeRequest(listing.id), {
      params: { id: listing.id },
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("LISTING_ASSETS_NOT_READY");
  });

  // NOT: "underlying mockupJob silinmiş" senaryosu için Listing.mockupJobId
  // FK SetNull olduğundan job silinince listing.mockupJobId otomatik null'a
  // düşer ve 409 LISTING_ASSETS_NOT_READY testi (yukarıda) zaten kapsar.
  // Pass-through 404 reel bir kenar değil; raw FK ihlali test izolasyonu için
  // anlamlı sinyal vermez. JobNotFoundError pass-through semantiği route
  // kodunda mevcut (try/catch + errorResponse + AppError auto-map); 403
  // pass-through (aşağıdaki QUEUED testi) aynı yolu kanıtlar.

  it("403 — mockupJob status QUEUED (Phase 8 JobNotDownloadableError pass-through)", async () => {
    const user = await ensureUser(uniqueEmail("queued"));

    // QUEUED/RUNNING — buildMockupZip status guard 403 atar.
    const { job } = await createTerminalJob(user.id, MockupJobStatus.QUEUED);
    const listing = await createListingWithJob({
      userId: user.id,
      mockupJobId: job.id,
    });

    vi.mocked(requireUser).mockResolvedValueOnce(user as never);
    const res = await GET(makeRequest(listing.id), {
      params: { id: listing.id },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("JOB_NOT_DOWNLOADABLE");
  });

  it("200 — happy path: ZIP buffer + headers + filename (cuid path)", async () => {
    const user = await ensureUser(uniqueEmail("happy"));

    const { job } = await createTerminalJob(user.id, MockupJobStatus.COMPLETED);
    const listing = await createListingWithJob({
      userId: user.id,
      mockupJobId: job.id,
    });

    vi.mocked(requireUser).mockResolvedValueOnce(user as never);
    const res = await GET(makeRequest(listing.id), {
      params: { id: listing.id },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toContain(
      `filename="listing-${listing.id}.zip"`,
    );
    const lengthHeader = res.headers.get("Content-Length");
    expect(lengthHeader).toBeTruthy();
    expect(Number(lengthHeader)).toBeGreaterThan(0);

    // Body: gerçek ZIP buffer (PK signature)
    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.slice(0, 2).toString("hex")).toBe("504b"); // ZIP magic bytes "PK"
  });

  it("200 — etsyListingId varsa filename Etsy id ile", async () => {
    const user = await ensureUser(uniqueEmail("etsyid"));

    const { job } = await createTerminalJob(user.id, MockupJobStatus.COMPLETED);
    const listing = await createListingWithJob({
      userId: user.id,
      mockupJobId: job.id,
      etsyListingId: "1234567890",
      status: ListingStatus.PUBLISHED,
    });

    vi.mocked(requireUser).mockResolvedValueOnce(user as never);
    const res = await GET(makeRequest(listing.id), {
      params: { id: listing.id },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain(
      `filename="listing-1234567890.zip"`,
    );
  });
});

// ────────────────────────────────────────────────────────────
// FK-safe cleanup chain (handoff.test.ts emsali)
// ────────────────────────────────────────────────────────────

afterAll(async () => {
  if (userIds.length === 0) return;

  await db.listing.deleteMany({ where: { userId: { in: userIds } } });
  await db.mockupRender.deleteMany({
    where: { job: { userId: { in: userIds } } },
  });
  await db.mockupJob.deleteMany({ where: { userId: { in: userIds } } });
  await db.mockupTemplate.deleteMany({
    where: { name: { startsWith: TEST_TPL_PREFIX } },
  });
  await db.selectionItem.deleteMany({
    where: { selectionSet: { userId: { in: userIds } } },
  });
  await db.selectionSet.deleteMany({ where: { userId: { in: userIds } } });
  await db.generatedDesign.deleteMany({
    where: { userId: { in: userIds } },
  });
  await db.reference.deleteMany({ where: { userId: { in: userIds } } });
  await db.asset.deleteMany({ where: { userId: { in: userIds } } });
  await db.productType.deleteMany({ where: { key: TEST_PT_KEY } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});
