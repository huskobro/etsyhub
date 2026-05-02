// Phase 9 V1 Task 4 — resolveEtsyConnection / hasEtsyConnection integration tests.
// Encrypted token decrypt + token expiry guards.

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { encryptSecret } from "@/lib/secrets";
import {
  resolveEtsyConnection,
  hasEtsyConnection,
} from "@/providers/etsy/connection";
import {
  EtsyConnectionNotFoundError,
  EtsyTokenExpiredError,
  EtsyTokenMissingError,
} from "@/providers/etsy/errors";

const TEST_PREFIX = "phase9-etsy-conn";
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

beforeAll(() => {
  // No-op
});

afterAll(async () => {
  // FK order: listing -> etsyConnection -> store -> user
  await db.listing.deleteMany({ where: { userId: { in: userIds } } });
  await db.etsyConnection.deleteMany({
    where: { store: { userId: { in: userIds } } },
  });
  await db.store.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("resolveEtsyConnection", () => {
  it("store yok → EtsyConnectionNotFoundError", async () => {
    const user = await ensureUser(uniqueEmail("no-store"));
    userIds.push(user.id);

    await expect(resolveEtsyConnection(user.id)).rejects.toThrow(
      EtsyConnectionNotFoundError,
    );
  });

  it("store var, etsyConnection null → EtsyConnectionNotFoundError", async () => {
    const user = await ensureUser(uniqueEmail("no-conn"));
    userIds.push(user.id);

    await db.store.create({
      data: { userId: user.id, name: "Store no conn" },
    });

    await expect(resolveEtsyConnection(user.id)).rejects.toThrow(
      EtsyConnectionNotFoundError,
    );
  });

  it("accessToken null → EtsyTokenMissingError", async () => {
    const user = await ensureUser(uniqueEmail("no-token"));
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Store no token" },
    });
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "12345",
        // accessToken yok
        refreshToken: encryptSecret("rt"),
        tokenExpires: new Date(Date.now() + 3600_000),
        scopes: ["listings_w"],
      },
    });

    await expect(resolveEtsyConnection(user.id)).rejects.toThrow(
      EtsyTokenMissingError,
    );
  });

  it("tokenExpires geçmişte → EtsyTokenExpiredError", async () => {
    const user = await ensureUser(uniqueEmail("expired"));
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Store expired" },
    });
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "12345",
        accessToken: encryptSecret("at"),
        refreshToken: encryptSecret("rt"),
        tokenExpires: new Date(Date.now() - 1000), // 1s geçmiş
        scopes: ["listings_w"],
      },
    });

    await expect(resolveEtsyConnection(user.id)).rejects.toThrow(
      EtsyTokenExpiredError,
    );
  });

  it("shopId null → EtsyTokenMissingError (eksik kurulum)", async () => {
    const user = await ensureUser(uniqueEmail("no-shop"));
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Store no shop" },
    });
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        // shopId yok
        accessToken: encryptSecret("at"),
        refreshToken: encryptSecret("rt"),
        tokenExpires: new Date(Date.now() + 3600_000),
        scopes: ["listings_w"],
      },
    });

    await expect(resolveEtsyConnection(user.id)).rejects.toThrow(
      EtsyTokenMissingError,
    );
  });

  it("happy path: encrypted accessToken decrypt edilir, plain string döner", async () => {
    const user = await ensureUser(uniqueEmail("ok"));
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Store ok" },
    });
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "12345",
        accessToken: encryptSecret("plain-access-token"),
        refreshToken: encryptSecret("plain-refresh-token"),
        tokenExpires: new Date(Date.now() + 3600_000),
        scopes: ["listings_w"],
      },
    });

    const result = await resolveEtsyConnection(user.id);
    expect(result.accessToken).toBe("plain-access-token");
    expect(result.shopId).toBe("12345");
    expect(result.connection.storeId).toBe(store.id);
  });
});

describe("hasEtsyConnection", () => {
  it("yoksa false", async () => {
    const user = await ensureUser(uniqueEmail("hasno"));
    userIds.push(user.id);

    expect(await hasEtsyConnection(user.id)).toBe(false);
  });

  it("varsa true", async () => {
    const user = await ensureUser(uniqueEmail("hasok"));
    userIds.push(user.id);

    const store = await db.store.create({
      data: { userId: user.id, name: "Has Store" },
    });
    await db.etsyConnection.create({
      data: {
        storeId: store.id,
        shopId: "999",
        accessToken: encryptSecret("at"),
        refreshToken: encryptSecret("rt"),
        tokenExpires: new Date(Date.now() + 3600_000),
        scopes: ["listings_w"],
      },
    });

    expect(await hasEtsyConnection(user.id)).toBe(true);
  });
});
