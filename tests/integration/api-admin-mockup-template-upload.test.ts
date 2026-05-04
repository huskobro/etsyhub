// V2 Phase 8 — Admin asset upload + signed URL endpoint testleri.
//
// Senaryolar (upload):
//   - 401 unauthenticated
//   - 403 USER role
//   - 400 multipart/form-data değil
//   - 400 dosya yok
//   - 400 categoryId enum dışı
//   - 400 purpose 'thumb'/'base' dışı
//   - 400 mime allowed değil
//   - 400 size cap aşımı (büyük buffer)
//   - 200 ADMIN — storage upload + width/height + key prefix doğru
//
// Senaryolar (asset-url):
//   - 401 unauthenticated
//   - 403 USER role
//   - 400 key non-templates/ prefix
//   - 200 ADMIN — signed URL döner

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
import sharp from "sharp";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

const currentUser: {
  id: string | null;
  role: UserRole;
  email: string | null;
} = { id: null, role: UserRole.USER, email: null };

vi.mock("@/server/session", () => ({
  requireUser: vi.fn().mockImplementation(async () => {
    if (!currentUser.id) {
      const { UnauthorizedError } = await import("@/lib/errors");
      throw new UnauthorizedError();
    }
    return { id: currentUser.id, email: currentUser.email, role: currentUser.role };
  }),
  requireAdmin: vi.fn().mockImplementation(async () => {
    if (!currentUser.id) {
      const { UnauthorizedError } = await import("@/lib/errors");
      throw new UnauthorizedError();
    }
    if (currentUser.role !== UserRole.ADMIN) {
      const { ForbiddenError } = await import("@/lib/errors");
      throw new ForbiddenError();
    }
    return { id: currentUser.id, email: currentUser.email!, role: currentUser.role };
  }),
}));

// Storage mock — gerçek MinIO bağlantısı YAPMAK İSTEMİYORUZ
vi.mock("@/providers/storage", () => ({
  getStorage: vi.fn(() => ({
    upload: vi.fn(async (key: string, body: Buffer) => ({
      key,
      bucket: "test-bucket",
      size: body.length,
    })),
    signedUrl: vi.fn(async (key: string) => `https://test-storage.local/${key}?signed=1`),
    download: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  })),
}));

import { POST as UPLOAD_POST } from "@/app/api/admin/mockup-templates/upload-asset/route";
import { GET as ASSET_URL_GET } from "@/app/api/admin/mockup-templates/asset-url/route";

let adminId: string;
let userId: string;

async function ensureUser(email: string, role: UserRole) {
  return db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await bcrypt.hash("password-test", 10),
      role,
      status: UserStatus.ACTIVE,
    },
    update: { role },
  });
}

async function makeSamplePngBuffer(): Promise<Buffer> {
  // 100x100 red PNG
  return sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
}

beforeAll(async () => {
  const admin = await ensureUser("v2-asset-upload-admin@etsyhub.local", UserRole.ADMIN);
  const user = await ensureUser("v2-asset-upload-user@etsyhub.local", UserRole.USER);
  adminId = admin.id;
  userId = user.id;
});

beforeEach(() => {
  currentUser.id = null;
  currentUser.role = UserRole.USER;
  currentUser.email = null;
});

afterAll(async () => {
  // No DB writes for asset upload (system asset, no Asset row).
});

function setAuthAdmin() {
  currentUser.id = adminId;
  currentUser.role = UserRole.ADMIN;
  currentUser.email = "v2-asset-upload-admin@etsyhub.local";
}
function setAuthUser() {
  currentUser.id = userId;
  currentUser.role = UserRole.USER;
  currentUser.email = "v2-asset-upload-user@etsyhub.local";
}

function makeUploadRequest(opts: {
  pngBuffer?: Buffer;
  fileName?: string;
  mimeType?: string;
  categoryId?: string;
  purpose?: string;
  noFile?: boolean;
  bodyOverride?: BodyInit;
}): Request {
  if (opts.bodyOverride !== undefined) {
    return new Request("http://localhost/api/admin/mockup-templates/upload-asset", {
      method: "POST",
      body: opts.bodyOverride,
    });
  }
  const fd = new FormData();
  if (!opts.noFile) {
    const buf = opts.pngBuffer ?? Buffer.from("dummy");
    const blob = new Blob([buf], { type: opts.mimeType ?? "image/png" });
    fd.append("file", blob, opts.fileName ?? "test.png");
  }
  if (opts.categoryId !== undefined) {
    fd.append("categoryId", opts.categoryId);
  }
  if (opts.purpose !== undefined) {
    fd.append("purpose", opts.purpose);
  }
  return new Request("http://localhost/api/admin/mockup-templates/upload-asset", {
    method: "POST",
    body: fd,
  });
}

describe("POST /api/admin/mockup-templates/upload-asset", () => {
  it("401 unauthenticated", async () => {
    const buf = await makeSamplePngBuffer();
    const res = await UPLOAD_POST(
      makeUploadRequest({ pngBuffer: buf, categoryId: "canvas", purpose: "thumb" }),
    );
    expect(res.status).toBe(401);
  });

  it("403 USER role", async () => {
    setAuthUser();
    const buf = await makeSamplePngBuffer();
    const res = await UPLOAD_POST(
      makeUploadRequest({ pngBuffer: buf, categoryId: "canvas", purpose: "thumb" }),
    );
    expect(res.status).toBe(403);
  });

  it("400 dosya yok", async () => {
    setAuthAdmin();
    const res = await UPLOAD_POST(
      makeUploadRequest({ noFile: true, categoryId: "canvas", purpose: "thumb" }),
    );
    expect(res.status).toBe(400);
  });

  it("400 categoryId enum dışı", async () => {
    setAuthAdmin();
    const buf = await makeSamplePngBuffer();
    const res = await UPLOAD_POST(
      makeUploadRequest({ pngBuffer: buf, categoryId: "mug", purpose: "thumb" }),
    );
    expect(res.status).toBe(400);
  });

  it("400 purpose dışı değer", async () => {
    setAuthAdmin();
    const buf = await makeSamplePngBuffer();
    const res = await UPLOAD_POST(
      makeUploadRequest({
        pngBuffer: buf,
        categoryId: "canvas",
        purpose: "invalid",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("400 mime desteklenmiyor", async () => {
    setAuthAdmin();
    const res = await UPLOAD_POST(
      makeUploadRequest({
        pngBuffer: Buffer.from("svg-data"),
        mimeType: "image/svg+xml",
        categoryId: "canvas",
        purpose: "thumb",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("400 size cap aşımı (>25MB)", async () => {
    setAuthAdmin();
    const tooBig = Buffer.alloc(26 * 1024 * 1024);
    const res = await UPLOAD_POST(
      makeUploadRequest({
        pngBuffer: tooBig,
        mimeType: "image/png",
        categoryId: "canvas",
        purpose: "thumb",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("200 ADMIN — storage upload + key prefix doğru + width/height", async () => {
    setAuthAdmin();
    const buf = await makeSamplePngBuffer();
    const res = await UPLOAD_POST(
      makeUploadRequest({
        pngBuffer: buf,
        categoryId: "wall_art",
        purpose: "base",
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.storageKey).toMatch(/^templates\/wall_art\/base\/.+\.png$/);
    expect(json.width).toBe(100);
    expect(json.height).toBe(100);
    expect(json.mimeType).toBe("image/png");
    expect(json.sizeBytes).toBeGreaterThan(0);
  });

  it("200 ADMIN — purpose=thumb + categoryId=sticker key prefix doğru", async () => {
    setAuthAdmin();
    const buf = await makeSamplePngBuffer();
    const res = await UPLOAD_POST(
      makeUploadRequest({
        pngBuffer: buf,
        categoryId: "sticker",
        purpose: "thumb",
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.storageKey).toMatch(/^templates\/sticker\/thumb\/.+\.png$/);
  });
});

describe("GET /api/admin/mockup-templates/asset-url", () => {
  it("401 unauthenticated", async () => {
    const res = await ASSET_URL_GET(
      new Request("http://localhost/api/admin/mockup-templates/asset-url?key=templates/x.png"),
    );
    expect(res.status).toBe(401);
  });

  it("403 USER role", async () => {
    setAuthUser();
    const res = await ASSET_URL_GET(
      new Request("http://localhost/api/admin/mockup-templates/asset-url?key=templates/x.png"),
    );
    expect(res.status).toBe(403);
  });

  it("400 templates/ prefix dışı (user asset prefix sızdırma prevent)", async () => {
    setAuthAdmin();
    const res = await ASSET_URL_GET(
      new Request("http://localhost/api/admin/mockup-templates/asset-url?key=u/somebody/secret.png"),
    );
    expect(res.status).toBe(400);
  });

  it("200 ADMIN — signed URL döner + expiresAt", async () => {
    setAuthAdmin();
    const res = await ASSET_URL_GET(
      new Request(
        "http://localhost/api/admin/mockup-templates/asset-url?key=templates/canvas/thumb/abc.png",
      ),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toMatch(/templates\/canvas\/thumb\/abc\.png/);
    expect(json.expiresAt).toBeTruthy();
  });
});
