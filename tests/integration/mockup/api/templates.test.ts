// Phase 8 Task 22 — GET /api/mockup/templates
//
// Spec §4.3: Admin-managed template katalog. Sistem-wide read-only.
//
// Test strategy:
//   - vi.mock requireUser
//   - Prisma fixtures: ACTIVE, DRAFT, ARCHIVED templates + binding variants
//   - Assert hasActiveBinding flag logic
//   - Validate provider/binding details NOT in response (provider-agnostik)
//   - Zod invalid categoryId → 400
//   - Unauthenticated → 401

import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus, MockupTemplateStatus, MockupBindingStatus } from "@prisma/client";
import { db } from "@/server/db";
import { GET } from "@/app/api/mockup/templates/route";
import { UnauthorizedError } from "@/lib/errors";

vi.mock("@/server/session", () => ({ requireUser: vi.fn() }));

import { requireUser } from "@/server/session";

let userId: string;
const createdTemplateIds: string[] = [];

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

function makeRequest(categoryId: string): Request {
  return new Request(
    `http://localhost/api/mockup/templates?categoryId=${encodeURIComponent(categoryId)}`,
    { method: "GET" },
  );
}

describe("GET /api/mockup/templates (Spec §4.3)", () => {
  beforeAll(async () => {
    const user = await ensureUser("template-test@example.com");
    userId = user.id;
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: "template-test@example.com" } });
  });

  beforeEach(() => {
    vi.mocked(requireUser).mockResolvedValue({ id: userId } as any);
  });

  afterEach(async () => {
    // Test'in yarattığı template'leri cleanup'la
    for (const id of createdTemplateIds) {
      try {
        await db.mockupTemplateBinding.deleteMany({ where: { templateId: id } });
        await db.mockupTemplate.delete({ where: { id } });
      } catch (e) {
        // Zaten silinmişse, sorun değil
      }
    }
    createdTemplateIds.length = 0;
  });

  it("200: returns all ACTIVE templates with hasActiveBinding flag", async () => {
    const testSuffix = "-test1-" + Date.now();
    // Create 2 ACTIVE templates
    const t1 = await db.mockupTemplate.create({
      data: {
        categoryId: "canvas",
        name: "Canvas Template A" + testSuffix,
        status: MockupTemplateStatus.ACTIVE,
        thumbKey: "thumbs/canvas-a.jpg",
        aspectRatios: ["2:3", "3:4"],
        tags: ["boho", "minimal"],
        estimatedRenderMs: 2000,
      },
    });
    createdTemplateIds.push(t1.id);

    const t2 = await db.mockupTemplate.create({
      data: {
        categoryId: "canvas",
        name: "Canvas Template B" + testSuffix,
        status: MockupTemplateStatus.ACTIVE,
        thumbKey: "thumbs/canvas-b.jpg",
        aspectRatios: ["1:1"],
        tags: ["abstract"],
        estimatedRenderMs: 2500,
      },
    });
    createdTemplateIds.push(t2.id);

    // Create 1 DRAFT template (should be excluded)
    const t3 = await db.mockupTemplate.create({
      data: {
        categoryId: "canvas",
        name: "Canvas Template Draft" + testSuffix,
        status: MockupTemplateStatus.DRAFT,
        thumbKey: "thumbs/canvas-draft.jpg",
        aspectRatios: ["2:3"],
        tags: ["draft"],
        estimatedRenderMs: 1000,
      },
    });
    createdTemplateIds.push(t3.id);

    // Create ACTIVE binding for t1
    await db.mockupTemplateBinding.create({
      data: {
        templateId: t1.id,
        providerId: "DYNAMIC_MOCKUPS",
        status: MockupBindingStatus.ACTIVE,
        config: { template: "canvas-basic" },
        estimatedRenderMs: 2000,
      },
    });

    // Create ACTIVE binding for t2
    await db.mockupTemplateBinding.create({
      data: {
        templateId: t2.id,
        providerId: "DYNAMIC_MOCKUPS",
        status: MockupBindingStatus.ACTIVE,
        config: { template: "canvas-premium" },
        estimatedRenderMs: 2500,
      },
    });

    const res = await GET(makeRequest("canvas"));
    expect(res.status).toBe(200);

    const body = await res.json();
    // Filter sadece bu test'in template'leri
    const ourTemplates = body.templates.filter((t: any) =>
      t.name.includes("test1-"),
    );
    expect(ourTemplates).toHaveLength(2);

    // Sıra: alphabetical by name
    const [first, second] = ourTemplates;
    expect(first.name).toContain("Canvas Template A");
    expect(second.name).toContain("Canvas Template B");

    // Check fields
    expect(first.id).toBe(t1.id);
    expect(first.aspectRatios).toEqual(["2:3", "3:4"]);
    expect(first.tags).toEqual(["boho", "minimal"]);
    expect(first.thumbKey).toBe("thumbs/canvas-a.jpg");
    expect(first.estimatedRenderMs).toBe(2000);
    expect(first.hasActiveBinding).toBe(true);

    expect(second.hasActiveBinding).toBe(true);
  });

  it("provider-agnostik: bindings/providerId/config response'a sızmaz", async () => {
    const testSuffix = "-test2-" + Date.now();
    const t = await db.mockupTemplate.create({
      data: {
        categoryId: "canvas",
        name: "Template With Binding" + testSuffix,
        status: MockupTemplateStatus.ACTIVE,
        thumbKey: "thumbs/test.jpg",
        aspectRatios: ["2:3"],
        tags: ["test"],
        estimatedRenderMs: 2000,
      },
    });
    createdTemplateIds.push(t.id);

    await db.mockupTemplateBinding.create({
      data: {
        templateId: t.id,
        providerId: "DYNAMIC_MOCKUPS",
        version: 1,
        status: MockupBindingStatus.ACTIVE,
        config: { template: "secret-data" },
        estimatedRenderMs: 2000,
      },
    });

    const res = await GET(makeRequest("canvas"));
    expect(res.status).toBe(200);

    const body = await res.json();
    const template = body.templates.find((x: any) => x.id === t.id);
    expect(template).toBeDefined();

    // Provider detayları YOKSA olmalı
    expect(template).not.toHaveProperty("bindings");
    expect(template).not.toHaveProperty("providerId");
    expect(template).not.toHaveProperty("config");
    expect(template).not.toHaveProperty("version");

    // Sadece View field'ları var
    const keys = Object.keys(template);
    expect(keys.sort()).toEqual(
      [
        "id",
        "name",
        "thumbKey",
        "aspectRatios",
        "tags",
        "estimatedRenderMs",
        "hasActiveBinding",
      ].sort(),
    );

  });

  it("hasActiveBinding=false: templates without active binding", async () => {
    const testSuffix = "-test3-" + Date.now();
    const withActive = await db.mockupTemplate.create({
      data: {
        categoryId: "canvas",
        name: "With Active" + testSuffix,
        status: MockupTemplateStatus.ACTIVE,
        thumbKey: "thumbs/active.jpg",
        aspectRatios: ["2:3"],
        tags: ["test"],
        estimatedRenderMs: 2000,
      },
    });
    createdTemplateIds.push(withActive.id);

    const withoutActive = await db.mockupTemplate.create({
      data: {
        categoryId: "canvas",
        name: "Without Active" + testSuffix,
        status: MockupTemplateStatus.ACTIVE,
        thumbKey: "thumbs/no-active.jpg",
        aspectRatios: ["2:3"],
        tags: ["test"],
        estimatedRenderMs: 2000,
      },
    });
    createdTemplateIds.push(withoutActive.id);

    // ACTIVE binding
    await db.mockupTemplateBinding.create({
      data: {
        templateId: withActive.id,
        providerId: "DYNAMIC_MOCKUPS",
        status: MockupBindingStatus.ACTIVE,
        config: {},
        estimatedRenderMs: 2000,
      },
    });

    // DRAFT binding (no ACTIVE)
    await db.mockupTemplateBinding.create({
      data: {
        templateId: withoutActive.id,
        providerId: "DYNAMIC_MOCKUPS",
        status: MockupBindingStatus.DRAFT,
        config: {},
        estimatedRenderMs: 2000,
      },
    });

    const res = await GET(makeRequest("canvas"));
    expect(res.status).toBe(200);

    const body = await res.json();
    const ourTemplates = body.templates.filter((t: any) =>
      t.name.includes("test3-"),
    );
    expect(ourTemplates).toHaveLength(2);

    const found1 = ourTemplates.find((x: any) => x.id === withActive.id);
    const found2 = ourTemplates.find((x: any) => x.id === withoutActive.id);

    expect(found1.hasActiveBinding).toBe(true);
    expect(found2.hasActiveBinding).toBe(false);
  });

  it("400: invalid categoryId (Zod enum fail)", async () => {
    const res = await GET(makeRequest("invalid-category"));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Geçersiz");
  });

  it("401: unauthenticated (requireUser fails)", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthorizedError());

    const res = await GET(makeRequest("canvas"));
    expect(res.status).toBe(401);
  });
});
