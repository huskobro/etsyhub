// Phase 9 V1 — Etsy token refresh + opportunistic resolve integration tests.
// `resolveEtsyConnectionWithRefresh` davranışı: happy path (refresh skip),
// expired + refresh success (DB update), expired + refresh fail (typed wrap).
// Real DB; oauth.refreshAccessToken mock'lanır (live Etsy çağrısı YOK).

import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { encryptSecret, decryptSecret } from "@/lib/secrets";

// Refresh path için oauth.ts:refreshAccessToken'ı mock'la
vi.mock("@/providers/etsy/oauth", async () => {
  const actual = await vi.importActual<typeof import("@/providers/etsy/oauth")>(
    "@/providers/etsy/oauth",
  );
  return {
    ...actual,
    refreshAccessToken: vi.fn(),
  };
});

import { resolveEtsyConnectionWithRefresh } from "@/providers/etsy/connection.service";
import {
  EtsyConnectionNotFoundError,
  EtsyTokenMissingError,
  EtsyTokenRefreshFailedError,
  EtsyApiError,
  EtsyNetworkError,
} from "@/providers/etsy/errors";
import { refreshAccessToken } from "@/providers/etsy/oauth";

const TEST_PREFIX = "phase9-token-refresh";
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

async function createConnection(opts: {
  userId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  shopId?: string | null;
  tokenExpires?: Date | null;
  scopes?: string[];
}) {
  const store = await db.store.create({
    data: { userId: opts.userId, name: "Test Store" },
  });
  return db.etsyConnection.create({
    data: {
      storeId: store.id,
      shopId: opts.shopId === undefined ? "shop-123" : opts.shopId,
      shopName: "Test Shop",
      accessToken:
        opts.accessToken === null
          ? null
          : opts.accessToken
            ? encryptSecret(opts.accessToken)
            : encryptSecret("plain-access"),
      refreshToken:
        opts.refreshToken === null
          ? null
          : opts.refreshToken
            ? encryptSecret(opts.refreshToken)
            : encryptSecret("plain-refresh"),
      tokenExpires:
        opts.tokenExpires === undefined
          ? new Date(Date.now() + 60 * 60 * 1000) // default: 1 hour future (no refresh needed)
          : opts.tokenExpires,
      scopes: opts.scopes ?? ["listings_w", "listings_r", "shops_r"],
    },
  });
}

describe("resolveEtsyConnectionWithRefresh — Phase 9 V1", () => {
  beforeEach(() => {
    vi.mocked(refreshAccessToken).mockReset();
  });

  it("404 — store yoksa EtsyConnectionNotFound", async () => {
    const user = await ensureUser(uniqueEmail("nostore"));
    userIds.push(user.id);
    await expect(
      resolveEtsyConnectionWithRefresh(user.id),
    ).rejects.toBeInstanceOf(EtsyConnectionNotFoundError);
  });

  it("400 — store var ama EtsyConnection yok → ConnectionNotFound", async () => {
    const user = await ensureUser(uniqueEmail("nocnx"));
    userIds.push(user.id);
    await db.store.create({ data: { userId: user.id, name: "Test Store" } });
    await expect(
      resolveEtsyConnectionWithRefresh(user.id),
    ).rejects.toBeInstanceOf(EtsyConnectionNotFoundError);
  });

  it("400 — accessToken null → TokenMissing", async () => {
    const user = await ensureUser(uniqueEmail("noaccess"));
    userIds.push(user.id);
    await createConnection({ userId: user.id, accessToken: null });
    await expect(
      resolveEtsyConnectionWithRefresh(user.id),
    ).rejects.toBeInstanceOf(EtsyTokenMissingError);
  });

  it("400 — shopId null → TokenMissing", async () => {
    const user = await ensureUser(uniqueEmail("noshop"));
    userIds.push(user.id);
    await createConnection({ userId: user.id, shopId: null });
    await expect(
      resolveEtsyConnectionWithRefresh(user.id),
    ).rejects.toBeInstanceOf(EtsyTokenMissingError);
  });

  it("happy path — token gelecekte ve grace dışında → mevcut token (refresh ÇAĞRILMAZ)", async () => {
    const user = await ensureUser(uniqueEmail("happy"));
    userIds.push(user.id);
    await createConnection({
      userId: user.id,
      accessToken: "live-access",
      tokenExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 saat sonra
    });
    const result = await resolveEtsyConnectionWithRefresh(user.id);
    expect(result.accessToken).toBe("live-access");
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("expired + refresh success → DB güncelle + yeni token döndür", async () => {
    const user = await ensureUser(uniqueEmail("refresh-ok"));
    userIds.push(user.id);
    const cnx = await createConnection({
      userId: user.id,
      accessToken: "old-access",
      refreshToken: "old-refresh",
      tokenExpires: new Date(Date.now() - 60 * 1000), // 1 dk önce expired
    });

    vi.mocked(refreshAccessToken).mockResolvedValueOnce({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresInSeconds: 3600,
      tokenType: "Bearer",
    });

    const result = await resolveEtsyConnectionWithRefresh(user.id);
    expect(result.accessToken).toBe("new-access");
    expect(refreshAccessToken).toHaveBeenCalledOnce();
    expect(refreshAccessToken).toHaveBeenCalledWith({
      refreshToken: "old-refresh",
    });

    // DB güncellendi mi
    const updated = await db.etsyConnection.findUnique({
      where: { id: cnx.id },
    });
    expect(updated).not.toBeNull();
    expect(decryptSecret(updated!.accessToken!)).toBe("new-access");
    expect(decryptSecret(updated!.refreshToken!)).toBe("new-refresh");
    expect(updated!.tokenExpires!.getTime()).toBeGreaterThan(
      Date.now() + 50 * 60 * 1000,
    );
    expect(updated!.shopId).toBe("shop-123"); // değişmedi
    expect(updated!.scopes).toEqual([
      "listings_w",
      "listings_r",
      "shops_r",
    ]); // değişmedi
  });

  it("grace window içinde (5 dk önce expire olacak) → proactive refresh", async () => {
    const user = await ensureUser(uniqueEmail("grace"));
    userIds.push(user.id);
    await createConnection({
      userId: user.id,
      accessToken: "soon-stale",
      refreshToken: "rt",
      tokenExpires: new Date(Date.now() + 2 * 60 * 1000), // 2 dk sonra expire (grace 5 dk)
    });

    vi.mocked(refreshAccessToken).mockResolvedValueOnce({
      accessToken: "fresh",
      refreshToken: "rt-2",
      expiresInSeconds: 3600,
      tokenType: "Bearer",
    });

    const result = await resolveEtsyConnectionWithRefresh(user.id);
    expect(result.accessToken).toBe("fresh");
    expect(refreshAccessToken).toHaveBeenCalledOnce();
  });

  it("expired + refresh token YOK → TokenRefreshFailed (kullanıcı reconnect)", async () => {
    const user = await ensureUser(uniqueEmail("no-refresh-token"));
    userIds.push(user.id);
    await createConnection({
      userId: user.id,
      accessToken: "x",
      refreshToken: null, // null
      tokenExpires: new Date(Date.now() - 60 * 1000),
    });
    await expect(
      resolveEtsyConnectionWithRefresh(user.id),
    ).rejects.toBeInstanceOf(EtsyTokenRefreshFailedError);
  });

  it("expired + refresh Etsy reddetti (4xx) → TokenRefreshFailed", async () => {
    const user = await ensureUser(uniqueEmail("etsy-reject"));
    userIds.push(user.id);
    await createConnection({
      userId: user.id,
      accessToken: "x",
      refreshToken: "revoked",
      tokenExpires: new Date(Date.now() - 60 * 1000),
    });

    vi.mocked(refreshAccessToken).mockRejectedValueOnce(
      new EtsyApiError("invalid_grant", 400, "invalid_grant"),
    );

    await expect(
      resolveEtsyConnectionWithRefresh(user.id),
    ).rejects.toBeInstanceOf(EtsyTokenRefreshFailedError);

    // İkinci kontrol: message içeriği + status 401
    vi.mocked(refreshAccessToken).mockRejectedValueOnce(
      new EtsyApiError("invalid_grant", 400, "invalid_grant"),
    );
    try {
      await resolveEtsyConnectionWithRefresh(user.id);
    } catch (err) {
      expect(err).toBeInstanceOf(EtsyTokenRefreshFailedError);
      expect((err as EtsyTokenRefreshFailedError).message).toContain(
        "invalid_grant",
      );
      expect((err as EtsyTokenRefreshFailedError).status).toBe(401);
    }
  });

  it("expired + refresh network error → TokenRefreshFailed (typed wrap)", async () => {
    const user = await ensureUser(uniqueEmail("net"));
    userIds.push(user.id);
    await createConnection({
      userId: user.id,
      accessToken: "x",
      refreshToken: "rt",
      tokenExpires: new Date(Date.now() - 60 * 1000),
    });

    vi.mocked(refreshAccessToken).mockRejectedValueOnce(
      new EtsyNetworkError("connection timeout"),
    );

    try {
      await resolveEtsyConnectionWithRefresh(user.id);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EtsyTokenRefreshFailedError);
      expect((err as EtsyTokenRefreshFailedError).message).toContain(
        "connection timeout",
      );
    }
  });

  it("happy path eski tokens DB'de korunur (refresh çağrılmadığı için)", async () => {
    const user = await ensureUser(uniqueEmail("notouch"));
    userIds.push(user.id);
    const cnx = await createConnection({
      userId: user.id,
      accessToken: "stable",
      refreshToken: "stable-rt",
      tokenExpires: new Date(Date.now() + 60 * 60 * 1000),
    });
    await resolveEtsyConnectionWithRefresh(user.id);

    const after = await db.etsyConnection.findUnique({
      where: { id: cnx.id },
    });
    expect(decryptSecret(after!.accessToken!)).toBe("stable");
    expect(decryptSecret(after!.refreshToken!)).toBe("stable-rt");
  });
});

afterAll(async () => {
  // FK-safe cleanup chain (handoff.test.ts emsali)
  await db.etsyConnection.deleteMany({
    where: { store: { userId: { in: userIds } } },
  });
  await db.store.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});
