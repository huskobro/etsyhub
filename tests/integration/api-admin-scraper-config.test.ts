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

// requireAdmin/requireUser'ı doğrudan mock'la (next-auth harness gerektirmesin)
const currentUser: {
  id: string | null;
  role: UserRole;
  email: string | null;
} = {
  id: null,
  role: UserRole.USER,
  email: null,
};
vi.mock("@/server/session", () => ({
  requireUser: vi.fn().mockImplementation(async () => {
    if (!currentUser.id) {
      const { UnauthorizedError } = await import("@/lib/errors");
      throw new UnauthorizedError();
    }
    return {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
    };
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
    return {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
    };
  }),
}));

// Route handlers mock'lardan sonra import edilmeli
const { GET, PATCH } = await import(
  "@/app/api/admin/scraper-config/route"
);

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

async function clearScraperFlags() {
  await db.featureFlag.deleteMany({
    where: { key: { startsWith: "scraper." } },
  });
}

describe("api/admin/scraper-config integration", () => {
  let adminId: string;
  let adminEmail: string;
  let userId: string;
  let userEmail: string;

  beforeAll(async () => {
    adminEmail = "admin-scraper-cfg@etsyhub.local";
    userEmail = "user-scraper-cfg@etsyhub.local";
    const adminUser = await ensureUser(adminEmail, UserRole.ADMIN);
    const normalUser = await ensureUser(userEmail, UserRole.USER);
    adminId = adminUser.id;
    userId = normalUser.id;
    await clearScraperFlags();
  });

  afterAll(async () => {
    await clearScraperFlags();
    await db.auditLog.deleteMany({
      where: { userId: { in: [adminId, userId] } },
    });
  });

  beforeEach(async () => {
    currentUser.id = null;
    currentUser.email = null;
    currentUser.role = UserRole.USER;
    await clearScraperFlags();
    await db.auditLog.deleteMany({
      where: { userId: { in: [adminId, userId] } },
    });
  });

  describe("GET /api/admin/scraper-config", () => {
    it("kimliksiz → 401", async () => {
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("normal kullanıcı → 403", async () => {
      currentUser.id = userId;
      currentUser.email = userEmail;
      currentUser.role = UserRole.USER;
      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("admin → 200, default self-hosted + key'ler yok, plain key dönmez", async () => {
      currentUser.id = adminId;
      currentUser.email = adminEmail;
      currentUser.role = UserRole.ADMIN;
      const res = await GET();
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        activeProvider: string;
        hasApifyKey: boolean;
        hasFirecrawlKey: boolean;
      };
      expect(body.activeProvider).toBe("self-hosted");
      expect(body.hasApifyKey).toBe(false);
      expect(body.hasFirecrawlKey).toBe(false);
      // Plain key alanı kesinlikle olmasın
      const raw = body as unknown as Record<string, unknown>;
      expect(raw).not.toHaveProperty("apifyApiKey");
      expect(raw).not.toHaveProperty("firecrawlApiKey");
      expect(raw).not.toHaveProperty("apifyToken");
      expect(raw).not.toHaveProperty("firecrawlToken");
    });
  });

  describe("PATCH /api/admin/scraper-config", () => {
    it("kimliksiz → 401", async () => {
      const res = await PATCH(
        new Request("http://localhost/api/admin/scraper-config", {
          method: "PATCH",
          body: JSON.stringify({ activeProvider: "apify" }),
        }),
      );
      expect(res.status).toBe(401);
    });

    it("normal kullanıcı → 403", async () => {
      currentUser.id = userId;
      currentUser.email = userEmail;
      currentUser.role = UserRole.USER;
      const res = await PATCH(
        new Request("http://localhost/api/admin/scraper-config", {
          method: "PATCH",
          body: JSON.stringify({ activeProvider: "apify" }),
        }),
      );
      expect(res.status).toBe(403);
    });

    it("admin → geçersiz provider reddedilir (400)", async () => {
      currentUser.id = adminId;
      currentUser.email = adminEmail;
      currentUser.role = UserRole.ADMIN;
      const res = await PATCH(
        new Request("http://localhost/api/admin/scraper-config", {
          method: "PATCH",
          body: JSON.stringify({ activeProvider: "nonsense" }),
        }),
      );
      expect(res.status).toBe(400);
    });

    it("admin → provider + apify key set, GET ile yansır, audit kaydı var", async () => {
      currentUser.id = adminId;
      currentUser.email = adminEmail;
      currentUser.role = UserRole.ADMIN;

      const plainKey = "apify-integration-test-token-aaa111";
      const patchRes = await PATCH(
        new Request("http://localhost/api/admin/scraper-config", {
          method: "PATCH",
          body: JSON.stringify({
            activeProvider: "apify",
            apiKeys: { apify: plainKey },
          }),
        }),
      );
      expect(patchRes.status).toBe(200);

      // PATCH response'ta plain key görünmemeli
      const patchBody = (await patchRes.json()) as unknown;
      expect(JSON.stringify(patchBody)).not.toContain(plainKey);

      // GET yansıması
      const getRes = await GET();
      const getBody = (await getRes.json()) as {
        activeProvider: string;
        hasApifyKey: boolean;
        hasFirecrawlKey: boolean;
      };
      expect(getBody.activeProvider).toBe("apify");
      expect(getBody.hasApifyKey).toBe(true);
      expect(getBody.hasFirecrawlKey).toBe(false);
      expect(JSON.stringify(getBody)).not.toContain(plainKey);

      // Audit kaydı
      const audits = await db.auditLog.findMany({
        where: { userId: adminId, action: { startsWith: "admin.scraper" } },
        orderBy: { createdAt: "desc" },
      });
      expect(audits.length).toBeGreaterThanOrEqual(1);
      // Plain key audit metadata'da da olmamalı
      const auditSer = JSON.stringify(audits);
      expect(auditSer).not.toContain(plainKey);
    });

    it("admin → apiKeys.apify=null gönderilince silinir", async () => {
      currentUser.id = adminId;
      currentUser.email = adminEmail;
      currentUser.role = UserRole.ADMIN;

      await PATCH(
        new Request("http://localhost/api/admin/scraper-config", {
          method: "PATCH",
          body: JSON.stringify({
            apiKeys: { apify: "delete-me-token-zzz" },
          }),
        }),
      );
      let getBody = (await (await GET()).json()) as { hasApifyKey: boolean };
      expect(getBody.hasApifyKey).toBe(true);

      await PATCH(
        new Request("http://localhost/api/admin/scraper-config", {
          method: "PATCH",
          body: JSON.stringify({ apiKeys: { apify: null } }),
        }),
      );
      getBody = (await (await GET()).json()) as { hasApifyKey: boolean };
      expect(getBody.hasApifyKey).toBe(false);
    });
  });
});
