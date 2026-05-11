/**
 * Integration test: GET /api/assets/[id]/signed-url
 *
 * Test kapsamı:
 * 1. Auth yok → 401
 * 2. Kendi asset'i → 200 + url + expiresAt
 * 3. Başka user'ın asset'i → 404 (data isolation; ID varlığını sızdırmamak için 403 değil 404 — mevcut proje pattern'i: api-competitors.test.ts L246)
 * 4. Olmayan ID → 404
 * 5. Soft-deleted asset → 404
 * 6. Response header Cache-Control: private, max-age=240 var mı
 *
 * Storage provider mock'lanır (gerçek MinIO bağımlılığı yok).
 * Gerçek Postgres kullanır.
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import { SourcePlatform, UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";

// Storage provider mock — signedUrl gerçek MinIO'ya bağlanmasın
vi.mock("@/providers/storage", () => ({
  getStorage: vi.fn().mockReturnValue({
    signedUrl: vi.fn().mockResolvedValue("https://mock-storage.test/signed-url?token=abc"),
    upload: vi.fn(),
    download: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Session mock — competitors test pattern'iyle birebir aynı
const currentUser: { id: string | null; role: UserRole } = {
  id: null,
  role: UserRole.USER,
};

vi.mock("@/server/session", () => ({
  requireUser: vi.fn().mockImplementation(async () => {
    if (!currentUser.id) {
      const { UnauthorizedError } = await import("@/lib/errors");
      throw new UnauthorizedError();
    }
    return {
      id: currentUser.id,
      email: `${currentUser.id}@test.local`,
      role: currentUser.role,
    };
  }),
  requireAdmin: vi.fn(),
}));

// Route handler mock'lardan sonra import edilmeli (vi.mock hoisting)
const { GET: signedUrlGET } = await import(
  "@/app/api/assets/[id]/signed-url/route"
);

// ------------------------------------------------------------------
// Test fixture helpers
// ------------------------------------------------------------------

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

async function createTestAsset(
  userId: string,
  opts: { deletedAt?: Date } = {},
) {
  return db.asset.create({
    data: {
      userId,
      storageProvider: "minio",
      storageKey: `test/${userId}/${Date.now()}.png`,
      bucket: "etsyhub",
      mimeType: "image/png",
      sizeBytes: 1024,
      hash: `hash-${Date.now()}-${Math.random()}`,
      sourcePlatform: SourcePlatform.UPLOAD,
      deletedAt: opts.deletedAt ?? null,
    },
  });
}

async function cleanup(userIds: string[]) {
  await db.asset.deleteMany({ where: { userId: { in: userIds } } });
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe("GET /api/assets/[id]/signed-url", () => {
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const a = await ensureUser("signed-url-a@etsyhub.local");
    const b = await ensureUser("signed-url-b@etsyhub.local");
    userAId = a.id;
    userBId = b.id;
    await cleanup([userAId, userBId]);
  });

  afterAll(async () => {
    await cleanup([userAId, userBId]);
  });

  beforeEach(() => {
    currentUser.id = null;
    currentUser.role = UserRole.USER;
    vi.clearAllMocks();
  });

  // 1. Auth yok → 401
  it("session yoksa 401 döner", async () => {
    const asset = await createTestAsset(userAId);
    const res = await signedUrlGET(
      new Request(`http://localhost/api/assets/${asset.id}/signed-url`),
      { params: { id: asset.id } },
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe("UNAUTHORIZED");
    expect(body.error).toBe("Giriş yapmalısın");
  });

  // 2. Kendi asset'i → 200 + url + expiresAt
  it("kendi asset'i için 200 ve url + expiresAt döner", async () => {
    currentUser.id = userAId;
    const asset = await createTestAsset(userAId);

    const before = Date.now();
    const res = await signedUrlGET(
      new Request(`http://localhost/api/assets/${asset.id}/signed-url`),
      { params: { id: asset.id } },
    );
    const after = Date.now();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; expiresAt: string };

    // url dolu ve http ile başlıyor
    expect(typeof body.url).toBe("string");
    expect(body.url).toMatch(/^https?:\/\//);

    // expiresAt ISO datetime, yaklaşık 3600 sn (1 saat) sonra
    // resolveTtlForUser no-settings fallback → DEFAULT_TTL = 3600
    const expiresMs = new Date(body.expiresAt).getTime();
    expect(expiresMs).toBeGreaterThan(before + 3599_000);
    expect(expiresMs).toBeLessThan(after + 3601_000);

    // storage provider 3600 sn TTL ile çağrıldı mı (DEFAULT_TTL)
    expect(getStorage().signedUrl).toHaveBeenCalledWith(asset.storageKey, 3600);
  });

  // 3. Başka user'ın asset'i → 404 (data isolation)
  // Not: Mevcut proje pattern'i (api-competitors.test.ts) başka user'ın
  // kaynağı için 404 dönüyor — ID'nin varlığını sızdırmamak için 403 değil.
  it("başka user'ın asset'i için 404 döner (data isolation)", async () => {
    const assetOfB = await createTestAsset(userBId);

    currentUser.id = userAId; // A olarak giriş yap, B'nin asset'ini sor
    const res = await signedUrlGET(
      new Request(`http://localhost/api/assets/${assetOfB.id}/signed-url`),
      { params: { id: assetOfB.id } },
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NOT_FOUND");
  });

  // 4. Olmayan ID → 404
  it("olmayan asset ID için 404 döner", async () => {
    currentUser.id = userAId;
    const fakeId = "nonexistent-id-00000000";
    const res = await signedUrlGET(
      new Request(`http://localhost/api/assets/${fakeId}/signed-url`),
      { params: { id: fakeId } },
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NOT_FOUND");
  });

  // 5. Soft-deleted asset → 404
  it("soft-deleted asset için 404 döner", async () => {
    currentUser.id = userAId;
    const deletedAsset = await createTestAsset(userAId, {
      deletedAt: new Date(),
    });
    const res = await signedUrlGET(
      new Request(`http://localhost/api/assets/${deletedAsset.id}/signed-url`),
      { params: { id: deletedAsset.id } },
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NOT_FOUND");
  });

  // 6. Cache-Control header
  it("başarılı yanıtta Cache-Control: private, max-age=2880 header'ı var (TTL 3600 * 0.8)", async () => {
    currentUser.id = userAId;
    const asset = await createTestAsset(userAId);
    const res = await signedUrlGET(
      new Request(`http://localhost/api/assets/${asset.id}/signed-url`),
      { params: { id: asset.id } },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=2880");
  });
});
