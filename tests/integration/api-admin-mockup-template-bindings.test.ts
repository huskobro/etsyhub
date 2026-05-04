// V2 Phase 8 — Admin MockupTemplateBinding management endpoint testleri.
//
// Senaryolar:
//   - GET list: 200 + items array, status filter, parent template 404
//   - POST create: 201 LOCAL_SHARP valid config, 400 invalid config,
//     409 duplicate (templateId, providerId) çifti
//   - PATCH: status transition + config edit (version bump),
//     ARCHIVED archivedAt timestamp, cross-template 404
//   - DELETE: 200 (no renders) / 409 ConflictError (renders exist)
//   - Auth: 401 unauthenticated, 403 USER role

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
import {
  UserRole,
  UserStatus,
  MockupBindingStatus,
} from "@prisma/client";
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

import {
  GET,
  POST,
} from "@/app/api/admin/mockup-templates/[id]/bindings/route";
import {
  PATCH,
  DELETE,
} from "@/app/api/admin/mockup-templates/[id]/bindings/[bindingId]/route";

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

const VALID_LOCAL_SHARP_CONFIG = {
  baseAssetKey: "templates/test-base.png",
  baseDimensions: { w: 1200, h: 1600 },
  safeArea: { type: "rect", x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
  recipe: { blendMode: "normal" },
  coverPriority: 50,
};

async function createTestTemplate() {
  return db.mockupTemplate.create({
    data: {
      categoryId: "canvas",
      name: "[V2-binding-test] Template",
      thumbKey: "templates/v2-binding-test-thumb.png",
      aspectRatios: ["3:4"],
      tags: [],
      estimatedRenderMs: 2000,
    },
  });
}

async function cleanup() {
  // Render → Binding → Template (cascade)
  await db.mockupRender.deleteMany({
    where: { templateSnapshot: { path: ["marker"], equals: "v2-binding-test" } },
  });
  await db.mockupTemplate.deleteMany({
    where: { name: { startsWith: "[V2-binding-test]" } },
  });
}

beforeAll(async () => {
  const admin = await ensureUser("v2-admin-binding-test@etsyhub.local", UserRole.ADMIN);
  const user = await ensureUser("v2-user-binding-test@etsyhub.local", UserRole.USER);
  adminId = admin.id;
  userId = user.id;
});

beforeEach(async () => {
  await cleanup();
  currentUser.id = null;
  currentUser.role = UserRole.USER;
  currentUser.email = null;
});

afterAll(async () => {
  await cleanup();
});

function setAuthAdmin() {
  currentUser.id = adminId;
  currentUser.role = UserRole.ADMIN;
  currentUser.email = "v2-admin-binding-test@etsyhub.local";
}

function setAuthUser() {
  currentUser.id = userId;
  currentUser.role = UserRole.USER;
  currentUser.email = "v2-user-binding-test@etsyhub.local";
}

describe("GET /api/admin/mockup-templates/[id]/bindings", () => {
  it("401 unauthenticated", async () => {
    const tpl = await createTestTemplate();
    const res = await GET(
      new Request(`http://localhost/api/admin/mockup-templates/${tpl.id}/bindings`),
      { params: { id: tpl.id } },
    );
    expect(res.status).toBe(401);
  });

  it("403 USER role", async () => {
    setAuthUser();
    const tpl = await createTestTemplate();
    const res = await GET(
      new Request(`http://localhost/api/admin/mockup-templates/${tpl.id}/bindings`),
      { params: { id: tpl.id } },
    );
    expect(res.status).toBe(403);
  });

  it("404 olmayan template", async () => {
    setAuthAdmin();
    const fakeId = "clz0000000000000000000000";
    const res = await GET(
      new Request(`http://localhost/api/admin/mockup-templates/${fakeId}/bindings`),
      { params: { id: fakeId } },
    );
    expect(res.status).toBe(404);
  });

  it("200 ADMIN — items boş array (yeni template)", async () => {
    setAuthAdmin();
    const tpl = await createTestTemplate();
    const res = await GET(
      new Request(`http://localhost/api/admin/mockup-templates/${tpl.id}/bindings`),
      { params: { id: tpl.id } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toEqual([]);
  });
});

describe("POST /api/admin/mockup-templates/[id]/bindings (create)", () => {
  it("201 LOCAL_SHARP — valid config", async () => {
    setAuthAdmin();
    const tpl = await createTestTemplate();
    const res = await POST(
      new Request(`http://localhost/api/admin/mockup-templates/${tpl.id}/bindings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: "LOCAL_SHARP",
          config: VALID_LOCAL_SHARP_CONFIG,
          estimatedRenderMs: 2000,
        }),
      }),
      { params: { id: tpl.id } },
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.item.providerId).toBe("LOCAL_SHARP");
    expect(json.item.status).toBe("DRAFT");
    expect(json.item.version).toBe(1);
  });

  it("400 LOCAL_SHARP — invalid config (eksik alan)", async () => {
    setAuthAdmin();
    const tpl = await createTestTemplate();
    const res = await POST(
      new Request(`http://localhost/api/admin/mockup-templates/${tpl.id}/bindings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: "LOCAL_SHARP",
          config: { baseAssetKey: "x" }, // eksik baseDimensions, safeArea, recipe, coverPriority
          estimatedRenderMs: 2000,
        }),
      }),
      { params: { id: tpl.id } },
    );
    expect(res.status).toBe(400);
  });

  it("409 — duplicate (templateId, providerId) çifti", async () => {
    setAuthAdmin();
    const tpl = await createTestTemplate();
    // İlk binding
    const res1 = await POST(
      new Request(`http://localhost/api/admin/mockup-templates/${tpl.id}/bindings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: "LOCAL_SHARP",
          config: VALID_LOCAL_SHARP_CONFIG,
          estimatedRenderMs: 2000,
        }),
      }),
      { params: { id: tpl.id } },
    );
    expect(res1.status).toBe(201);

    // Duplicate
    const res2 = await POST(
      new Request(`http://localhost/api/admin/mockup-templates/${tpl.id}/bindings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: "LOCAL_SHARP",
          config: VALID_LOCAL_SHARP_CONFIG,
          estimatedRenderMs: 2000,
        }),
      }),
      { params: { id: tpl.id } },
    );
    expect(res2.status).toBe(409);
  });

  it("404 olmayan template", async () => {
    setAuthAdmin();
    const fakeId = "clz0000000000000000000000";
    const res = await POST(
      new Request(`http://localhost/api/admin/mockup-templates/${fakeId}/bindings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: "LOCAL_SHARP",
          config: VALID_LOCAL_SHARP_CONFIG,
          estimatedRenderMs: 2000,
        }),
      }),
      { params: { id: fakeId } },
    );
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/admin/mockup-templates/[id]/bindings/[bindingId]", () => {
  async function createBinding(templateId: string) {
    return db.mockupTemplateBinding.create({
      data: {
        templateId,
        providerId: "LOCAL_SHARP",
        version: 1,
        config: { providerId: "local-sharp", ...VALID_LOCAL_SHARP_CONFIG },
        estimatedRenderMs: 2000,
      },
    });
  }

  it("DRAFT → ACTIVE", async () => {
    setAuthAdmin();
    const tpl = await createTestTemplate();
    const b = await createBinding(tpl.id);
    const res = await PATCH(
      new Request(
        `http://localhost/api/admin/mockup-templates/${tpl.id}/bindings/${b.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ACTIVE" }),
        },
      ),
      { params: { id: tpl.id, bindingId: b.id } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.item.status).toBe("ACTIVE");
    expect(json.item.archivedAt).toBeNull();
  });

  it("ACTIVE → ARCHIVED — archivedAt set + render bozulmaz", async () => {
    setAuthAdmin();
    const tpl = await createTestTemplate();
    const b = await createBinding(tpl.id);
    await db.mockupTemplateBinding.update({
      where: { id: b.id },
      data: { status: MockupBindingStatus.ACTIVE },
    });
    const res = await PATCH(
      new Request(
        `http://localhost/api/admin/mockup-templates/${tpl.id}/bindings/${b.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ARCHIVED" }),
        },
      ),
      { params: { id: tpl.id, bindingId: b.id } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.item.status).toBe("ARCHIVED");
    expect(json.item.archivedAt).not.toBeNull();
  });

  it("config edit — version bump", async () => {
    setAuthAdmin();
    const tpl = await createTestTemplate();
    const b = await createBinding(tpl.id);
    const newConfig = { ...VALID_LOCAL_SHARP_CONFIG, coverPriority: 75 };
    const res = await PATCH(
      new Request(
        `http://localhost/api/admin/mockup-templates/${tpl.id}/bindings/${b.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: newConfig }),
        },
      ),
      { params: { id: tpl.id, bindingId: b.id } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.item.version).toBe(2);
  });

  it("404 cross-template binding", async () => {
    setAuthAdmin();
    const tpl1 = await createTestTemplate();
    const tpl2 = await createTestTemplate();
    const b = await createBinding(tpl1.id);
    const res = await PATCH(
      new Request(
        `http://localhost/api/admin/mockup-templates/${tpl2.id}/bindings/${b.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ACTIVE" }),
        },
      ),
      { params: { id: tpl2.id, bindingId: b.id } },
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/mockup-templates/[id]/bindings/[bindingId]", () => {
  it("200 — render history yoksa silinir", async () => {
    setAuthAdmin();
    const tpl = await createTestTemplate();
    const b = await db.mockupTemplateBinding.create({
      data: {
        templateId: tpl.id,
        providerId: "LOCAL_SHARP",
        version: 1,
        config: { providerId: "local-sharp", ...VALID_LOCAL_SHARP_CONFIG },
        estimatedRenderMs: 2000,
      },
    });
    const res = await DELETE(
      new Request(
        `http://localhost/api/admin/mockup-templates/${tpl.id}/bindings/${b.id}`,
        { method: "DELETE" },
      ),
      { params: { id: tpl.id, bindingId: b.id } },
    );
    expect(res.status).toBe(200);
    const exists = await db.mockupTemplateBinding.findUnique({ where: { id: b.id } });
    expect(exists).toBeNull();
  });

  it("409 — render history mevcutsa silinmez", async () => {
    setAuthAdmin();
    const tpl = await createTestTemplate();
    const b = await db.mockupTemplateBinding.create({
      data: {
        templateId: tpl.id,
        providerId: "LOCAL_SHARP",
        version: 1,
        status: MockupBindingStatus.ACTIVE,
        config: { providerId: "local-sharp", ...VALID_LOCAL_SHARP_CONFIG },
        estimatedRenderMs: 2000,
      },
    });
    const set = await db.selectionSet.create({
      data: { userId: adminId, name: "[V2-binding-test] Set", status: "ready" },
    });
    const job = await db.mockupJob.create({
      data: {
        userId: adminId,
        setId: set.id,
        setSnapshotId: "v2-binding-test-snap",
        categoryId: "canvas",
        status: "COMPLETED",
        packSize: 1,
        actualPackSize: 1,
        coverRenderId: null,
        totalRenders: 1,
        successRenders: 1,
        failedRenders: 0,
      },
    });
    await db.mockupRender.create({
      data: {
        jobId: job.id,
        variantId: "v2-binding-variant",
        bindingId: b.id,
        templateSnapshot: { templateId: tpl.id, marker: "v2-binding-test" },
        packPosition: 0,
        selectionReason: "COVER",
        status: "SUCCESS",
        outputKey: "v2-binding-test-output.png",
      },
    });

    const res = await DELETE(
      new Request(
        `http://localhost/api/admin/mockup-templates/${tpl.id}/bindings/${b.id}`,
        { method: "DELETE" },
      ),
      { params: { id: tpl.id, bindingId: b.id } },
    );
    expect(res.status).toBe(409);

    // Cleanup
    await db.mockupRender.deleteMany({ where: { bindingId: b.id } });
    await db.mockupJob.deleteMany({ where: { id: job.id } });
    await db.selectionSet.deleteMany({ where: { id: set.id } });
  });
});
