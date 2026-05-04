// V2 Phase 8 — Admin MockupTemplate management endpoint testleri.
//
// Senaryolar:
//   - List: 200 + items array (categoryId/status filter optional)
//   - Create: 201 + DRAFT default + audit log
//   - Status transition: PATCH DRAFT→ACTIVE→ARCHIVED→DRAFT cycle + archivedAt
//   - Delete: 200 (no renders) / 409 ConflictError (renders exist)
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
import { UserRole, UserStatus, MockupBindingStatus } from "@prisma/client";
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

import { GET, POST } from "@/app/api/admin/mockup-templates/route";
import { PATCH, DELETE } from "@/app/api/admin/mockup-templates/[id]/route";

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

async function cleanup() {
  // Render → Binding → Template (cascade)
  await db.mockupRender.deleteMany({
    where: { templateSnapshot: { path: ["marker"], equals: "v2-admin-test" } },
  });
  await db.mockupTemplate.deleteMany({
    where: { name: { startsWith: "[V2-test]" } },
  });
}

beforeAll(async () => {
  const admin = await ensureUser("v2-admin-mockup-templates-test@etsyhub.local", UserRole.ADMIN);
  const user = await ensureUser("v2-user-mockup-templates-test@etsyhub.local", UserRole.USER);
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
  currentUser.email = "v2-admin-mockup-templates-test@etsyhub.local";
}

function setAuthUser() {
  currentUser.id = userId;
  currentUser.role = UserRole.USER;
  currentUser.email = "v2-user-mockup-templates-test@etsyhub.local";
}

describe("GET /api/admin/mockup-templates", () => {
  it("401 unauthenticated", async () => {
    const res = await GET(new Request("http://localhost/api/admin/mockup-templates"));
    expect(res.status).toBe(401);
  });

  it("403 USER role", async () => {
    setAuthUser();
    const res = await GET(new Request("http://localhost/api/admin/mockup-templates"));
    expect(res.status).toBe(403);
  });

  it("200 ADMIN — items array", async () => {
    setAuthAdmin();
    const res = await GET(new Request("http://localhost/api/admin/mockup-templates"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.items)).toBe(true);
  });

  it("200 ADMIN — categoryId filter", async () => {
    setAuthAdmin();
    const res = await GET(new Request("http://localhost/api/admin/mockup-templates?categoryId=canvas"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.items)).toBe(true);
    for (const it of json.items) {
      expect(it.categoryId).toBe("canvas");
    }
  });

  it("400 invalid categoryId (enum dışı)", async () => {
    setAuthAdmin();
    const res = await GET(
      new Request("http://localhost/api/admin/mockup-templates?categoryId=invalid"),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/mockup-templates (create)", () => {
  it("201 ADMIN — create DRAFT default", async () => {
    setAuthAdmin();
    const body = {
      categoryId: "wall_art",
      name: "[V2-test] Wall Art Template",
      thumbKey: "templates/wall-art-test-thumb.png",
      aspectRatios: ["2:3"],
      tags: ["test"],
      estimatedRenderMs: 2000,
    };
    const res = await POST(
      new Request("http://localhost/api/admin/mockup-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.item.status).toBe("DRAFT");
    expect(json.item.categoryId).toBe("wall_art");
    expect(json.item.name).toBe(body.name);
  });

  it("400 invalid categoryId (V2 enum sınırı)", async () => {
    setAuthAdmin();
    const res = await POST(
      new Request("http://localhost/api/admin/mockup-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: "mug",
          name: "[V2-test] Mug",
          thumbKey: "x",
          aspectRatios: ["1:1"],
          tags: [],
          estimatedRenderMs: 1000,
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("403 USER role create reject", async () => {
    setAuthUser();
    const res = await POST(
      new Request("http://localhost/api/admin/mockup-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: "canvas",
          name: "[V2-test] Sneaky",
          thumbKey: "x",
          aspectRatios: ["3:4"],
          tags: [],
          estimatedRenderMs: 1000,
        }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/admin/mockup-templates/[id] (status transition)", () => {
  async function createTemplate() {
    return db.mockupTemplate.create({
      data: {
        categoryId: "sticker",
        name: "[V2-test] Sticker Template",
        thumbKey: "templates/sticker-test-thumb.png",
        aspectRatios: ["1:1"],
        tags: ["test"],
        estimatedRenderMs: 1500,
      },
    });
  }

  it("DRAFT → ACTIVE", async () => {
    setAuthAdmin();
    const tpl = await createTemplate();
    const res = await PATCH(
      new Request(`http://localhost/api/admin/mockup-templates/${tpl.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      }),
      { params: { id: tpl.id } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.item.status).toBe("ACTIVE");
    expect(json.item.archivedAt).toBeNull();
  });

  it("ACTIVE → ARCHIVED — archivedAt set", async () => {
    setAuthAdmin();
    const tpl = await createTemplate();
    await db.mockupTemplate.update({
      where: { id: tpl.id },
      data: { status: "ACTIVE" },
    });
    const res = await PATCH(
      new Request(`http://localhost/api/admin/mockup-templates/${tpl.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      }),
      { params: { id: tpl.id } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.item.status).toBe("ARCHIVED");
    expect(json.item.archivedAt).not.toBeNull();
  });

  it("ARCHIVED → DRAFT — archivedAt null", async () => {
    setAuthAdmin();
    const tpl = await createTemplate();
    await db.mockupTemplate.update({
      where: { id: tpl.id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    const res = await PATCH(
      new Request(`http://localhost/api/admin/mockup-templates/${tpl.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT" }),
      }),
      { params: { id: tpl.id } },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.item.status).toBe("DRAFT");
    expect(json.item.archivedAt).toBeNull();
  });

  it("404 olmayan id", async () => {
    setAuthAdmin();
    const res = await PATCH(
      new Request("http://localhost/api/admin/mockup-templates/clz0000000000000000000000", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      }),
      { params: { id: "clz0000000000000000000000" } },
    );
    expect(res.status).toBe(404);
  });

  it("400 boş body (en az bir alan zorunlu)", async () => {
    setAuthAdmin();
    const tpl = await createTemplate();
    const res = await PATCH(
      new Request(`http://localhost/api/admin/mockup-templates/${tpl.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: { id: tpl.id } },
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/mockup-templates/[id]", () => {
  it("200 — render history yoksa silinir", async () => {
    setAuthAdmin();
    const tpl = await db.mockupTemplate.create({
      data: {
        categoryId: "clipart",
        name: "[V2-test] Clipart Delete",
        thumbKey: "x",
        aspectRatios: ["1:1"],
        tags: [],
        estimatedRenderMs: 1000,
      },
    });
    const res = await DELETE(
      new Request(`http://localhost/api/admin/mockup-templates/${tpl.id}`, { method: "DELETE" }),
      { params: { id: tpl.id } },
    );
    expect(res.status).toBe(200);
    const exists = await db.mockupTemplate.findUnique({ where: { id: tpl.id } });
    expect(exists).toBeNull();
  });

  it("409 — render history mevcutsa silinmez", async () => {
    setAuthAdmin();
    // Template + binding + selection set + job + render
    const tpl = await db.mockupTemplate.create({
      data: {
        categoryId: "canvas",
        name: "[V2-test] With Render",
        thumbKey: "x",
        aspectRatios: ["3:4"],
        tags: [],
        estimatedRenderMs: 1000,
      },
    });
    const binding = await db.mockupTemplateBinding.create({
      data: {
        templateId: tpl.id,
        providerId: "LOCAL_SHARP",
        version: 1,
        status: MockupBindingStatus.ACTIVE,
        config: { providerId: "local-sharp", baseAssetKey: "x", baseDimensions: { w: 100, h: 100 }, safeArea: { type: "rect", x: 0, y: 0, w: 1, h: 1 }, recipe: { blendMode: "normal" }, coverPriority: 1 },
        estimatedRenderMs: 1000,
      },
    });
    const set = await db.selectionSet.create({
      data: { userId: adminId, name: "[V2-test] Render Set", status: "ready" },
    });
    const job = await db.mockupJob.create({
      data: {
        userId: adminId,
        setId: set.id,
        setSnapshotId: "v2-admin-test-snap",
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
        variantId: "v2-test-variant",
        bindingId: binding.id,
        templateSnapshot: { templateId: tpl.id, marker: "v2-admin-test" },
        packPosition: 0,
        selectionReason: "COVER",
        status: "SUCCESS",
        outputKey: "v2-test-output.png",
      },
    });

    const res = await DELETE(
      new Request(`http://localhost/api/admin/mockup-templates/${tpl.id}`, { method: "DELETE" }),
      { params: { id: tpl.id } },
    );
    expect(res.status).toBe(409);
    const exists = await db.mockupTemplate.findUnique({ where: { id: tpl.id } });
    expect(exists).not.toBeNull();
  });
});
