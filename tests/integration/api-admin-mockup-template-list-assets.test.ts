// V2 Phase 8 (Pass 15) — Admin existing asset list endpoint testleri.
//
// Senaryolar:
//   - 401 unauthenticated
//   - 403 USER role
//   - 400 query geçersiz (categoryId yok)
//   - 400 categoryId enum dışı
//   - 400 purpose enum dışı
//   - 200 ADMIN — boş liste (storage list boş döndürünce)
//   - 200 ADMIN — çoklu item, lastModified DESC sıralı
//
// Storage mock — list(prefix) kontrol altında

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

const storageState: { items: { key: string; size: number; lastModified: Date }[] } = {
  items: [],
};
vi.mock("@/providers/storage", () => ({
  getStorage: vi.fn(() => ({
    upload: vi.fn(),
    download: vi.fn(),
    signedUrl: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(async (prefix: string) => {
      // Mock prefix filtering: caller'dan gelen prefix'le başlayanları döndür
      return storageState.items.filter((i) => i.key.startsWith(prefix));
    }),
  })),
}));

import { GET as LIST_ASSETS_GET } from "@/app/api/admin/mockup-templates/list-assets/route";

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
  const admin = await ensureUser("v2-list-assets-admin@etsyhub.local", UserRole.ADMIN);
  const user = await ensureUser("v2-list-assets-user@etsyhub.local", UserRole.USER);
  adminId = admin.id;
  userId = user.id;
});

beforeEach(() => {
  currentUser.id = null;
  currentUser.role = UserRole.USER;
  currentUser.email = null;
  storageState.items = [];
});

function setAuthAdmin() {
  currentUser.id = adminId;
  currentUser.role = UserRole.ADMIN;
  currentUser.email = "v2-list-assets-admin@etsyhub.local";
}
function setAuthUser() {
  currentUser.id = userId;
  currentUser.role = UserRole.USER;
  currentUser.email = "v2-list-assets-user@etsyhub.local";
}

function makeReq(query: string): Request {
  return new Request(
    `http://localhost/api/admin/mockup-templates/list-assets?${query}`,
  );
}

describe("GET /api/admin/mockup-templates/list-assets", () => {
  it("401 unauthenticated", async () => {
    const res = await LIST_ASSETS_GET(makeReq("categoryId=canvas&purpose=thumb"));
    expect(res.status).toBe(401);
  });

  it("403 USER role", async () => {
    setAuthUser();
    const res = await LIST_ASSETS_GET(makeReq("categoryId=canvas&purpose=thumb"));
    expect(res.status).toBe(403);
  });

  it("400 categoryId yok", async () => {
    setAuthAdmin();
    const res = await LIST_ASSETS_GET(makeReq("purpose=thumb"));
    expect(res.status).toBe(400);
  });

  it("400 categoryId enum dışı", async () => {
    setAuthAdmin();
    const res = await LIST_ASSETS_GET(makeReq("categoryId=mug&purpose=thumb"));
    expect(res.status).toBe(400);
  });

  it("400 purpose enum dışı", async () => {
    setAuthAdmin();
    const res = await LIST_ASSETS_GET(
      makeReq("categoryId=canvas&purpose=invalid"),
    );
    expect(res.status).toBe(400);
  });

  it("200 ADMIN — boş liste", async () => {
    setAuthAdmin();
    storageState.items = [];
    const res = await LIST_ASSETS_GET(makeReq("categoryId=canvas&purpose=thumb"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toEqual([]);
  });

  it("200 ADMIN — çoklu item lastModified DESC + prefix filtreli", async () => {
    setAuthAdmin();
    const old = new Date("2026-04-01T00:00:00Z");
    const mid = new Date("2026-04-15T00:00:00Z");
    const recent = new Date("2026-05-01T00:00:00Z");
    storageState.items = [
      { key: "templates/canvas/thumb/old.png", size: 1024, lastModified: old },
      { key: "templates/canvas/thumb/recent.png", size: 4096, lastModified: recent },
      { key: "templates/canvas/thumb/mid.png", size: 2048, lastModified: mid },
      // Bunlar farklı prefix — gözükmemeli
      { key: "templates/canvas/base/baseAsset.png", size: 9999, lastModified: recent },
      { key: "u/some-user/uploaded.png", size: 1, lastModified: recent },
    ];
    const res = await LIST_ASSETS_GET(makeReq("categoryId=canvas&purpose=thumb"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items.length).toBe(3);
    // DESC sıra
    expect(json.items[0].key).toBe("templates/canvas/thumb/recent.png");
    expect(json.items[1].key).toBe("templates/canvas/thumb/mid.png");
    expect(json.items[2].key).toBe("templates/canvas/thumb/old.png");
    // Field shape
    expect(json.items[0].sizeBytes).toBe(4096);
    expect(json.items[0].lastModified).toBe(recent.toISOString());
  });

  it("200 ADMIN — purpose=base kategori-prefix filter", async () => {
    setAuthAdmin();
    storageState.items = [
      { key: "templates/wall_art/base/x.png", size: 100, lastModified: new Date() },
      { key: "templates/wall_art/thumb/y.png", size: 200, lastModified: new Date() },
    ];
    const res = await LIST_ASSETS_GET(makeReq("categoryId=wall_art&purpose=base"));
    const json = await res.json();
    expect(json.items.length).toBe(1);
    expect(json.items[0].key).toBe("templates/wall_art/base/x.png");
  });
});
