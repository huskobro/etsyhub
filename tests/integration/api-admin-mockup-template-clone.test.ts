// V2 Phase 8 (Pass 15) — Admin MockupTemplate clone endpoint testleri.
//
// Senaryolar:
//   - 401 unauthenticated
//   - 403 USER role
//   - 400 body geçersiz (name yok)
//   - 404 source template yok
//   - 201 ADMIN clone (no bindings) — yeni template DRAFT, name değişti, fields aynı
//   - 201 ADMIN clone with bindings — bindings DRAFT olarak kopyalandı, version=1
//   - source ACTIVE iken clone DRAFT (status her zaman DRAFT)

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
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { newId } from "@/lib/id";

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

import { POST as CLONE_POST } from "@/app/api/admin/mockup-templates/[id]/clone/route";

let adminId: string;
let userId: string;
const createdTemplateIds: string[] = [];

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

async function createSourceTemplate(opts: {
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  withBindings?: boolean;
}) {
  const tpl = await db.mockupTemplate.create({
    data: {
      categoryId: "canvas",
      name: `clone-source-${newId()}`,
      thumbKey: "templates/canvas/thumb/source.png",
      aspectRatios: ["3:4"],
      tags: ["test"],
      estimatedRenderMs: 2500,
      status: opts.status ?? "DRAFT",
    },
  });
  createdTemplateIds.push(tpl.id);

  if (opts.withBindings) {
    await db.mockupTemplateBinding.create({
      data: {
        templateId: tpl.id,
        providerId: "LOCAL_SHARP",
        config: {
          providerId: "local-sharp",
          baseAssetKey: "templates/canvas/base/abc.png",
          baseDimensions: { w: 1200, h: 1600 },
          safeArea: { type: "rect", x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
          recipe: { blendMode: "normal" },
          coverPriority: 50,
        },
        version: 3, // ACTIVE binding bir kaç edit olmuş
        estimatedRenderMs: 2500,
        status: "ACTIVE",
      },
    });
  }
  return tpl;
}

beforeAll(async () => {
  const admin = await ensureUser("v2-clone-admin@etsyhub.local", UserRole.ADMIN);
  const user = await ensureUser("v2-clone-user@etsyhub.local", UserRole.USER);
  adminId = admin.id;
  userId = user.id;
});

beforeEach(() => {
  currentUser.id = null;
  currentUser.role = UserRole.USER;
  currentUser.email = null;
});

afterAll(async () => {
  // Cleanup: bindings + templates
  if (createdTemplateIds.length === 0) return;
  await db.mockupTemplateBinding.deleteMany({
    where: { templateId: { in: createdTemplateIds } },
  });
  await db.mockupTemplate.deleteMany({
    where: { id: { in: createdTemplateIds } },
  });
});

function setAuthAdmin() {
  currentUser.id = adminId;
  currentUser.role = UserRole.ADMIN;
  currentUser.email = "v2-clone-admin@etsyhub.local";
}
function setAuthUser() {
  currentUser.id = userId;
  currentUser.role = UserRole.USER;
  currentUser.email = "v2-clone-user@etsyhub.local";
}

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/admin/mockup-templates/x/clone", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/mockup-templates/[id]/clone", () => {
  it("401 unauthenticated", async () => {
    const tpl = await createSourceTemplate({});
    const res = await CLONE_POST(makeReq({ name: "x" }), { params: { id: tpl.id } });
    expect(res.status).toBe(401);
  });

  it("403 USER role", async () => {
    setAuthUser();
    const tpl = await createSourceTemplate({});
    const res = await CLONE_POST(makeReq({ name: "x" }), { params: { id: tpl.id } });
    expect(res.status).toBe(403);
  });

  it("400 body geçersiz (name yok)", async () => {
    setAuthAdmin();
    const tpl = await createSourceTemplate({});
    const res = await CLONE_POST(makeReq({}), { params: { id: tpl.id } });
    expect(res.status).toBe(400);
  });

  it("404 source template yok", async () => {
    setAuthAdmin();
    // Mevcut template oluştur sonra sil — id format valid (cuid) ama kaynak yok
    const tmp = await createSourceTemplate({});
    const fakeId = tmp.id;
    await db.mockupTemplate.delete({ where: { id: tmp.id } });
    // Listeden çıkar (afterAll silme yapmasın)
    const idx = createdTemplateIds.indexOf(tmp.id);
    if (idx >= 0) createdTemplateIds.splice(idx, 1);

    const res = await CLONE_POST(makeReq({ name: "Cloned" }), {
      params: { id: fakeId },
    });
    expect(res.status).toBe(404);
  });

  it("201 ADMIN clone (no bindings) — DRAFT + ad değişti + alanlar aynı", async () => {
    setAuthAdmin();
    const source = await createSourceTemplate({ status: "ACTIVE" });
    const res = await CLONE_POST(makeReq({ name: "Yeni Klon" }), {
      params: { id: source.id },
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    const clone = json.item as {
      id: string;
      name: string;
      categoryId: string;
      thumbKey: string;
      aspectRatios: string[];
      tags: string[];
      estimatedRenderMs: number;
      status: string;
    };
    createdTemplateIds.push(clone.id);

    expect(clone.id).not.toBe(source.id);
    expect(clone.name).toBe("Yeni Klon");
    expect(clone.status).toBe("DRAFT"); // source ACTIVE'di ama clone DRAFT
    expect(clone.categoryId).toBe(source.categoryId);
    expect(clone.thumbKey).toBe(source.thumbKey);
    expect(clone.aspectRatios).toEqual(source.aspectRatios);
    expect(clone.tags).toEqual(source.tags);
    expect(clone.estimatedRenderMs).toBe(source.estimatedRenderMs);

    // Bindings yok
    const cloneBindings = await db.mockupTemplateBinding.findMany({
      where: { templateId: clone.id },
    });
    expect(cloneBindings).toEqual([]);
  });

  it("201 ADMIN clone with bindings — bindings DRAFT + version=1", async () => {
    setAuthAdmin();
    const source = await createSourceTemplate({
      status: "ACTIVE",
      withBindings: true,
    });
    const res = await CLONE_POST(makeReq({ name: "Klon-with-bindings" }), {
      params: { id: source.id },
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    const cloneId = (json.item as { id: string }).id;
    createdTemplateIds.push(cloneId);

    const cloneBindings = await db.mockupTemplateBinding.findMany({
      where: { templateId: cloneId },
    });
    expect(cloneBindings.length).toBe(1);
    const b = cloneBindings[0]!;
    expect(b.providerId).toBe("LOCAL_SHARP");
    expect(b.status).toBe("DRAFT"); // source ACTIVE idi, clone DRAFT
    expect(b.version).toBe(1); // clone yeni lineage
    // Config aynen kopyalandı mı
    const cfg = b.config as Record<string, unknown>;
    expect(cfg.baseAssetKey).toBe("templates/canvas/base/abc.png");
    expect(cfg.coverPriority).toBe(50);
  });
});
