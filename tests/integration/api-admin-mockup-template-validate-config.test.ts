// V2 Phase 8 (Pass 14) — Admin LOCAL_SHARP/DM provider config validate endpoint testleri.
//
// Senaryolar:
//   - 401 unauthenticated
//   - 403 USER role
//   - 400 body geçersiz
//   - 200 LOCAL_SHARP — valid + baseAsset exists (storage download mock OK)
//   - 200 LOCAL_SHARP — valid schema fakat baseAsset yok (storage download throw → exists=false)
//   - 200 LOCAL_SHARP — schema fail (safeArea kötü) → valid=false + errors[]
//   - 200 DYNAMIC_MOCKUPS — valid (externalTemplateId)
//   - 200 DYNAMIC_MOCKUPS — schema fail (externalTemplateId yok)
//
// Storage mock'unda download() davranışını test bazında değiştiriyoruz:
//   - "exists" path: buffer döner
//   - "missing" path: throw (NoSuchKey benzeri)

import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";

const currentUser: {
  id: string | null;
  role: UserRole;
  email: string | null;
} = { id: null, role: UserRole.USER, email: null };

vi.mock("@/server/session", () => ({
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

// Storage download davranışı: storageState.shouldExist=true → buffer; false → throw
const storageState = { shouldExist: true };
vi.mock("@/providers/storage", () => ({
  getStorage: vi.fn(() => ({
    upload: vi.fn(),
    signedUrl: vi.fn(),
    download: vi.fn(async () => {
      if (!storageState.shouldExist) {
        throw new Error("NoSuchKey: missing");
      }
      // 100x100 dummy PNG-ish buffer (1KB) — sadece exists check için
      return Buffer.alloc(1024, 0xff);
    }),
    delete: vi.fn(),
    list: vi.fn(),
  })),
}));

import { POST as VALIDATE_POST } from "@/app/api/admin/mockup-templates/validate-config/route";

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

beforeAll(async () => {
  const admin = await ensureUser("v2-validate-config-admin@etsyhub.local", UserRole.ADMIN);
  const user = await ensureUser("v2-validate-config-user@etsyhub.local", UserRole.USER);
  adminId = admin.id;
  userId = user.id;
});

beforeEach(() => {
  currentUser.id = null;
  currentUser.role = UserRole.USER;
  currentUser.email = null;
  storageState.shouldExist = true;
});

function setAuthAdmin() {
  currentUser.id = adminId;
  currentUser.role = UserRole.ADMIN;
  currentUser.email = "v2-validate-config-admin@etsyhub.local";
}
function setAuthUser() {
  currentUser.id = userId;
  currentUser.role = UserRole.USER;
  currentUser.email = "v2-validate-config-user@etsyhub.local";
}

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/mockup-templates/validate-config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validLocalSharpConfig = {
  baseAssetKey: "templates/canvas/base/abc.png",
  baseDimensions: { w: 1200, h: 1600 },
  safeArea: { type: "rect", x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
  recipe: { blendMode: "normal" as const },
  coverPriority: 50,
};

describe("POST /api/admin/mockup-templates/validate-config", () => {
  it("401 unauthenticated", async () => {
    const res = await VALIDATE_POST(
      makePostRequest({ providerId: "LOCAL_SHARP", config: validLocalSharpConfig }),
    );
    expect(res.status).toBe(401);
  });

  it("403 USER role", async () => {
    setAuthUser();
    const res = await VALIDATE_POST(
      makePostRequest({ providerId: "LOCAL_SHARP", config: validLocalSharpConfig }),
    );
    expect(res.status).toBe(403);
  });

  it("400 body geçersiz (providerId yok)", async () => {
    setAuthAdmin();
    const res = await VALIDATE_POST(
      makePostRequest({ config: validLocalSharpConfig }),
    );
    expect(res.status).toBe(400);
  });

  it("200 LOCAL_SHARP valid + baseAsset exists", async () => {
    setAuthAdmin();
    storageState.shouldExist = true;
    const res = await VALIDATE_POST(
      makePostRequest({ providerId: "LOCAL_SHARP", config: validLocalSharpConfig }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(true);
    expect(json.errors).toEqual([]);
    expect(json.summary.providerId).toBe("local-sharp");
    expect(json.summary.baseAsset.exists).toBe(true);
    expect(json.summary.baseAsset.mimeType).toBe("image/png");
    expect(json.summary.safeAreaType).toBe("rect");
    expect(json.summary.baseDimensions).toEqual({ w: 1200, h: 1600 });
    expect(json.summary.coverPriority).toBe(50);
  });

  it("200 LOCAL_SHARP valid schema fakat baseAsset storage'da yok", async () => {
    setAuthAdmin();
    storageState.shouldExist = false;
    const res = await VALIDATE_POST(
      makePostRequest({ providerId: "LOCAL_SHARP", config: validLocalSharpConfig }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.errors.length).toBe(1);
    expect(json.errors[0].path).toBe("baseAssetKey");
    expect(json.summary.baseAsset.exists).toBe(false);
  });

  it("200 LOCAL_SHARP schema fail (safeArea x dışarı taştı)", async () => {
    setAuthAdmin();
    const badConfig = {
      ...validLocalSharpConfig,
      safeArea: { type: "rect", x: 1.5, y: 0.1, w: 0.8, h: 0.8 }, // x > 1
    };
    const res = await VALIDATE_POST(
      makePostRequest({ providerId: "LOCAL_SHARP", config: badConfig }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.errors.length).toBeGreaterThan(0);
  });

  it("200 LOCAL_SHARP schema fail (coverPriority > 100)", async () => {
    setAuthAdmin();
    const badConfig = { ...validLocalSharpConfig, coverPriority: 150 };
    const res = await VALIDATE_POST(
      makePostRequest({ providerId: "LOCAL_SHARP", config: badConfig }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.errors.some((e: { path: string }) => e.path === "coverPriority")).toBe(true);
  });

  it("200 DYNAMIC_MOCKUPS valid (externalTemplateId)", async () => {
    setAuthAdmin();
    const res = await VALIDATE_POST(
      makePostRequest({
        providerId: "DYNAMIC_MOCKUPS",
        config: { externalTemplateId: "dm-tpl-123" },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(true);
    expect(json.errors).toEqual([]);
    expect(json.summary.providerId).toBe("dynamic-mockups");
    // DYNAMIC_MOCKUPS için baseAsset yok (storage'a uğramıyoruz)
    expect(json.summary.baseAsset).toBeUndefined();
  });

  it("200 DYNAMIC_MOCKUPS schema fail (externalTemplateId eksik)", async () => {
    setAuthAdmin();
    const res = await VALIDATE_POST(
      makePostRequest({
        providerId: "DYNAMIC_MOCKUPS",
        config: {},
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.errors.length).toBeGreaterThan(0);
  });
});
