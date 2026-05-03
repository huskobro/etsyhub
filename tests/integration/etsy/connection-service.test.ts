// Phase 9 V1 — Connection service integration tests.
// getEtsyConnectionStatus / persistEtsyConnection / deleteEtsyConnection.
// Real DB (FK-safe cleanup chain). fetch global override for Etsy API mock.

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { encryptSecret } from "@/lib/secrets";
import {
  getEtsyConnectionStatus,
  persistEtsyConnection,
  deleteEtsyConnection,
} from "@/providers/etsy/connection.service";
import { EtsyApiError } from "@/providers/etsy/errors";

const TEST_PREFIX = "phase9-conn-svc";
let nonce = 0;
function uniqueEmail(label: string) {
  return `${TEST_PREFIX}-${label}-${Date.now()}-${++nonce}-${Math.random()
    .toString(36)
    .slice(2, 8)}@test.local`;
}

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

const userIds: string[] = [];

const ENV_KEYS = [
  "ETSY_CLIENT_ID",
  "ETSY_CLIENT_SECRET",
  "ETSY_REDIRECT_URI",
] as const;
const original: Record<string, string | undefined> = {};

beforeAll(() => {
  // Save originals
  for (const k of ENV_KEYS) original[k] = process.env[k];
});

afterAll(async () => {
  // FK-safe cleanup chain: listing -> etsyConnection -> store -> user
  await db.listing.deleteMany({ where: { userId: { in: userIds } } });
  await db.etsyConnection.deleteMany({
    where: { store: { userId: { in: userIds } } },
  });
  await db.store.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });

  // Restore env
  for (const k of ENV_KEYS) {
    if (original[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = original[k];
    }
  }
});

beforeEach(() => {
  // Default: env set (most tests)
  process.env.ETSY_CLIENT_ID = "test-client";
  process.env.ETSY_CLIENT_SECRET = "test-secret";
  process.env.ETSY_REDIRECT_URI =
    "http://localhost:3000/api/etsy/oauth/callback";
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ────────────────────────────────────────────────────────────
// getEtsyConnectionStatus
// ────────────────────────────────────────────────────────────

describe("getEtsyConnectionStatus", () => {
  it("env yokken state=not_configured", async () => {
    delete process.env.ETSY_CLIENT_ID;
    delete process.env.ETSY_CLIENT_SECRET;
    delete process.env.ETSY_REDIRECT_URI;

    const user = await ensureUser(uniqueEmail("not-cfg"));
    userIds.push(user.id);

    const s = await getEtsyConnectionStatus(user.id);
    expect(s).toEqual({ state: "not_configured" });
  });

  it("env var ama row yok → not_connected", async () => {
    const user = await ensureUser(uniqueEmail("no-row"));
    userIds.push(user.id);

    const s = await getEtsyConnectionStatus(user.id);
    expect(s.state).toBe("not_connected");
  });

  it("store var, etsyConnection yok → not_connected", async () => {
    const user = await ensureUser(uniqueEmail("no-conn"));
    userIds.push(user.id);
    await db.store.create({
      data: { userId: user.id, name: "Store no conn" },
    });

    const s = await getEtsyConnectionStatus(user.id);
    expect(s.state).toBe("not_connected");
  });

  it("accessToken null → not_connected", async () => {
    const user = await ensureUser(uniqueEmail("no-token"));
    userIds.push(user.id);
    const store = await db.store.create({
      data: { userId: user.id, name: "S" },
    });
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "111",
        refreshToken: encryptSecret("rt"),
        tokenExpires: new Date(Date.now() + 3600_000),
        scopes: ["listings_w"],
      },
    });

    const s = await getEtsyConnectionStatus(user.id);
    expect(s.state).toBe("not_connected");
  });

  it("shopId null → not_connected", async () => {
    const user = await ensureUser(uniqueEmail("no-shop"));
    userIds.push(user.id);
    const store = await db.store.create({
      data: { userId: user.id, name: "S" },
    });
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        accessToken: encryptSecret("at"),
        refreshToken: encryptSecret("rt"),
        tokenExpires: new Date(Date.now() + 3600_000),
        scopes: ["listings_w"],
      },
    });

    const s = await getEtsyConnectionStatus(user.id);
    expect(s.state).toBe("not_connected");
  });

  it("tokenExpires geçmişte → expired", async () => {
    const user = await ensureUser(uniqueEmail("expired"));
    userIds.push(user.id);
    const store = await db.store.create({
      data: { userId: user.id, name: "S" },
    });
    const expired = new Date(Date.now() - 1000);
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "999",
        shopName: "ExpiredShop",
        accessToken: encryptSecret("at"),
        refreshToken: encryptSecret("rt"),
        tokenExpires: expired,
        scopes: ["listings_w"],
      },
    });

    const s = await getEtsyConnectionStatus(user.id);
    expect(s.state).toBe("expired");
    if (s.state === "expired") {
      expect(s.shopName).toBe("ExpiredShop");
      expect(s.expiredAt.getTime()).toBe(expired.getTime());
    }
  });

  it("happy path → connected, shopId/shopName/scopes/tokenExpires döner", async () => {
    const user = await ensureUser(uniqueEmail("ok"));
    userIds.push(user.id);
    const store = await db.store.create({
      data: { userId: user.id, name: "S" },
    });
    const exp = new Date(Date.now() + 3600_000);
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "777",
        shopName: "OkShop",
        accessToken: encryptSecret("at"),
        refreshToken: encryptSecret("rt"),
        tokenExpires: exp,
        scopes: ["listings_w", "listings_r", "shops_r"],
      },
    });

    const s = await getEtsyConnectionStatus(user.id);
    expect(s.state).toBe("connected");
    if (s.state === "connected") {
      expect(s.shopId).toBe("777");
      expect(s.shopName).toBe("OkShop");
      expect(s.scopes).toEqual(["listings_w", "listings_r", "shops_r"]);
      expect(s.tokenExpires?.getTime()).toBe(exp.getTime());
    }
  });
});

// ────────────────────────────────────────────────────────────
// deleteEtsyConnection
// ────────────────────────────────────────────────────────────

describe("deleteEtsyConnection", () => {
  it("happy path: row siler", async () => {
    const user = await ensureUser(uniqueEmail("del-ok"));
    userIds.push(user.id);
    const store = await db.store.create({
      data: { userId: user.id, name: "S" },
    });
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "1",
        accessToken: encryptSecret("at"),
        refreshToken: encryptSecret("rt"),
        tokenExpires: new Date(Date.now() + 3600_000),
        scopes: [],
      },
    });

    await deleteEtsyConnection(user.id);
    const after = await db.etsyConnection.findUnique({
      where: { storeId: store.id },
    });
    expect(after).toBeNull();
  });

  it("no-op: store/connection yoksa hata yok", async () => {
    const user = await ensureUser(uniqueEmail("del-noop"));
    userIds.push(user.id);

    await expect(deleteEtsyConnection(user.id)).resolves.toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────
// persistEtsyConnection — fetch mock'la (Etsy /users/me + /shops)
// ────────────────────────────────────────────────────────────

describe("persistEtsyConnection", () => {
  it("new connection: store yoksa create eder + EtsyConnection upsert", async () => {
    const user = await ensureUser(uniqueEmail("persist-new"));
    userIds.push(user.id);

    // fetch mock — Etsy /users/me + /users/{id}/shops
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (url) => {
        const u = url.toString();
        if (u.endsWith("/users/me")) {
          return new Response(JSON.stringify({ user_id: 42 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (u.endsWith("/users/42/shops")) {
          return new Response(
            JSON.stringify({ shop_id: 12345, shop_name: "NewShop" }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        throw new Error(`Unmocked fetch: ${u}`);
      });

    const result = await persistEtsyConnection({
      userId: user.id,
      accessToken: "at-plain",
      refreshToken: "rt-plain",
      expiresInSeconds: 3600,
    });

    expect(result.shopId).toBe("12345");
    expect(result.shopName).toBe("NewShop");

    // Store auto-created
    const store = await db.store.findFirst({
      where: { userId: user.id, deletedAt: null },
    });
    expect(store).not.toBeNull();
    expect(store!.name).toBe("NewShop");

    const conn = await db.etsyConnection.findUnique({
      where: { storeId: store!.id },
    });
    expect(conn).not.toBeNull();
    expect(conn!.shopId).toBe("12345");
    expect(conn!.shopName).toBe("NewShop");
    // accessToken encrypted (plain DEĞİL)
    expect(conn!.accessToken).not.toBe("at-plain");
    expect(conn!.scopes).toEqual(["listings_w", "listings_r", "shops_r"]);

    fetchSpy.mockRestore();
  });

  it("existing store + connection: upsert update path (token rotated)", async () => {
    const user = await ensureUser(uniqueEmail("persist-update"));
    userIds.push(user.id);

    // Pre-existing store + connection
    const store = await db.store.create({
      data: { userId: user.id, name: "Pre Store" },
    });
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "old-shop",
        shopName: "OldShop",
        accessToken: encryptSecret("old-at"),
        refreshToken: encryptSecret("old-rt"),
        tokenExpires: new Date(Date.now() + 60_000),
        scopes: ["listings_r"],
      },
    });

    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (url) => {
        const u = url.toString();
        if (u.endsWith("/users/me")) {
          return new Response(JSON.stringify({ user_id: 99 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (u.endsWith("/users/99/shops")) {
          return new Response(
            JSON.stringify({ shop_id: 88888, shop_name: "RenewedShop" }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        throw new Error(`Unmocked: ${u}`);
      });

    await persistEtsyConnection({
      userId: user.id,
      accessToken: "new-at",
      refreshToken: "new-rt",
      expiresInSeconds: 7200,
    });

    const conn = await db.etsyConnection.findUnique({
      where: { storeId: store.id },
    });
    expect(conn!.shopId).toBe("88888");
    expect(conn!.shopName).toBe("RenewedShop");
    expect(conn!.scopes).toEqual(["listings_w", "listings_r", "shops_r"]);
    // Token değişti
    expect(conn!.accessToken).not.toBe("old-at");

    fetchSpy.mockRestore();
  });

  it("Etsy /shops yanıtında shop_id yok → EtsyApiError", async () => {
    const user = await ensureUser(uniqueEmail("persist-noshop"));
    userIds.push(user.id);

    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (url) => {
        const u = url.toString();
        if (u.endsWith("/users/me")) {
          return new Response(JSON.stringify({ user_id: 1 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (u.endsWith("/users/1/shops")) {
          return new Response(JSON.stringify({}), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`Unmocked: ${u}`);
      });

    await expect(
      persistEtsyConnection({
        userId: user.id,
        accessToken: "at",
        refreshToken: "rt",
        expiresInSeconds: 3600,
      }),
    ).rejects.toThrow(EtsyApiError);

    fetchSpy.mockRestore();
  });
});
