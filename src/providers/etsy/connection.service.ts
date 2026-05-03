/**
 * Phase 9 V1 — Etsy connection write path + status query.
 *
 * Callback handler bu service'i çağırır:
 *   1. Token exchange sonucu encrypt + persist
 *   2. Etsy V3 /users/me shop_id lookup (shopId zorunlu)
 *   3. Store auto-create (kullanıcının store'u yoksa)
 *   4. EtsyConnection upsert (storeId @unique)
 *
 * Connection status query (UI için):
 *   - getEtsyConnectionStatus(userId): non-throw, status enum döner
 *
 * Read path (`resolveEtsyConnection`, `hasEtsyConnection`) DOKUNULMAZ
 * (mevcut [connection.ts](./connection.ts)'da).
 */

import { db } from "@/server/db";
import { encryptSecret, decryptSecret } from "@/lib/secrets";
import {
  isEtsyConfigured,
  ETSY_DEFAULT_SCOPES,
  getEtsyOAuthConfig,
  refreshAccessToken,
} from "./oauth";
import {
  classifyEtsyHttpError,
  classifyEtsyNetworkError,
} from "./error-classifier";
import {
  EtsyApiError,
  EtsyConnectionNotFoundError,
  EtsyTokenMissingError,
  EtsyTokenRefreshFailedError,
} from "./errors";
import type { EtsyConnectionResolved } from "./types";

const ETSY_API_BASE = "https://openapi.etsy.com/v3/application";

/**
 * Connection status — UI panel için.
 *
 * - "not_configured": ETSY_CLIENT_ID env yok (sistem yöneticisi sorumlu)
 * - "not_connected": env var ama EtsyConnection row yok / token / shopId eksik
 * - "expired": token expired (refresh gerek; V1'de manuel reconnect)
 * - "connected": access token geçerli, shopId set
 */
export type EtsyConnectionStatus =
  | { state: "not_configured" }
  | { state: "not_connected" }
  | { state: "expired"; shopName: string | null; expiredAt: Date }
  | {
      state: "connected";
      shopId: string;
      shopName: string | null;
      tokenExpires: Date | null;
      scopes: string[];
    };

export async function getEtsyConnectionStatus(
  userId: string,
): Promise<EtsyConnectionStatus> {
  if (!isEtsyConfigured()) {
    return { state: "not_configured" };
  }

  const store = await db.store.findFirst({
    where: { userId, deletedAt: null },
    include: { etsyConnection: true },
  });

  if (
    !store ||
    !store.etsyConnection ||
    !store.etsyConnection.accessToken ||
    !store.etsyConnection.shopId
  ) {
    return { state: "not_connected" };
  }

  const conn = store.etsyConnection;
  const now = new Date();
  if (conn.tokenExpires && conn.tokenExpires < now) {
    return {
      state: "expired",
      shopName: conn.shopName,
      expiredAt: conn.tokenExpires,
    };
  }

  // Narrow: not_connected guard `!conn.shopId` ile erken çıkışı garanti eder,
  // ama TS bunu Prisma nullable'da yakalayamıyor — explicit non-null assertion
  // (guard'da kontrol edildi).
  return {
    state: "connected",
    shopId: conn.shopId!,
    shopName: conn.shopName,
    tokenExpires: conn.tokenExpires,
    scopes: conn.scopes,
  };
}

/**
 * Etsy V3 /users/me lookup → shop_id + shop_name.
 *
 * V1 foundation — gerçek HTTP yapılır; live test credentials gerek.
 * Hata durumunda classifyEtsyHttpError/Network throw eder.
 */
async function fetchEtsyUserShop(accessToken: string): Promise<{
  shopId: string;
  shopName: string | null;
}> {
  const cfg = getEtsyOAuthConfig();

  // Önce /users/me — user_id al
  let res: Response;
  try {
    res = await fetch(`${ETSY_API_BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-api-key": cfg.clientId,
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    classifyEtsyNetworkError(err);
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    classifyEtsyHttpError({ status: res.status, body: errBody });
  }

  const me = (await res.json()) as { user_id: number };
  if (!me.user_id) {
    throw new EtsyApiError("Etsy /users/me yanıtında user_id yok", res.status);
  }

  // Sonra /users/{user_id}/shops — shop bilgileri
  let shopRes: Response;
  try {
    shopRes = await fetch(`${ETSY_API_BASE}/users/${me.user_id}/shops`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-api-key": cfg.clientId,
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    classifyEtsyNetworkError(err);
  }

  if (!shopRes.ok) {
    const errBody = await shopRes.json().catch(() => ({}));
    classifyEtsyHttpError({ status: shopRes.status, body: errBody });
  }

  // Etsy V3 shops endpoint dönüş yapısı: { shop_id, shop_name, ... }
  // (single shop per user — Etsy V3 sözleşmesi)
  const shopJson = (await shopRes.json()) as {
    shop_id?: number;
    shop_name?: string;
  };
  if (!shopJson.shop_id) {
    throw new EtsyApiError(
      "Etsy shops endpoint'inde shop_id yok (kullanıcının shop'u yok mu?)",
      shopRes.status,
    );
  }

  return {
    shopId: String(shopJson.shop_id),
    shopName: shopJson.shop_name ?? null,
  };
}

/**
 * Token exchange sonucu callback'te bu fonksiyon çağrılır.
 * - Etsy /users/me shop lookup
 * - Store auto-create (user'ın store'u yoksa)
 * - EtsyConnection upsert (storeId @unique)
 */
export async function persistEtsyConnection(opts: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}): Promise<{ shopId: string; shopName: string | null }> {
  // 1. Etsy /users/me shop lookup
  const { shopId, shopName } = await fetchEtsyUserShop(opts.accessToken);

  // 2. Store auto-create / find
  let store = await db.store.findFirst({
    where: { userId: opts.userId, deletedAt: null },
  });
  if (!store) {
    store = await db.store.create({
      data: {
        userId: opts.userId,
        name: shopName ?? "Etsy Store",
      },
    });
  }

  // 3. Token persist (encrypted)
  const tokenExpires = new Date(Date.now() + opts.expiresInSeconds * 1000);
  await db.etsyConnection.upsert({
    where: { storeId: store.id },
    create: {
      storeId: store.id,
      shopId,
      shopName,
      accessToken: encryptSecret(opts.accessToken),
      refreshToken: encryptSecret(opts.refreshToken),
      tokenExpires,
      scopes: [...ETSY_DEFAULT_SCOPES],
    },
    update: {
      shopId,
      shopName,
      accessToken: encryptSecret(opts.accessToken),
      refreshToken: encryptSecret(opts.refreshToken),
      tokenExpires,
      scopes: [...ETSY_DEFAULT_SCOPES],
    },
  });

  return { shopId, shopName };
}

/**
 * Connection delete — kullanıcı "Bağlantıyı kaldır" tıklarsa.
 * Token DB'den silinir; Etsy tarafı revoke ETMEZ (V1 sözleşmesi: kullanıcı
 * Etsy admin'den uygulama izinlerini ayrıca iptal etmeli — UI'da bilgilendir).
 */
export async function deleteEtsyConnection(userId: string): Promise<void> {
  const store = await db.store.findFirst({
    where: { userId, deletedAt: null },
    include: { etsyConnection: true },
  });
  if (!store?.etsyConnection) return;
  await db.etsyConnection.delete({
    where: { id: store.etsyConnection.id },
  });
}

/**
 * Token refresh threshold — token bu süreden önce expired'a düşerse
 * proactive olarak refresh eder. V1: 5 dakika (Etsy V3 access tokens
 * 1 saat geçerli; 5 dk margin yeterli).
 *
 * V1.1+: configurable + background worker preempt refresh (BullMQ).
 */
const TOKEN_REFRESH_GRACE_MS = 5 * 60 * 1000;

/**
 * Phase 9 V1 — Etsy connection resolve + opportunistic token refresh.
 *
 * Submit pipeline `resolveEtsyConnection` (read-only) yerine bu helper'ı
 * kullanır. Davranış:
 *   1. Store + EtsyConnection fetch (read path connection.ts emsali)
 *   2. accessToken null veya shopId null → EtsyTokenMissingError 400
 *   3. tokenExpires geçmişte veya grace window içinde:
 *      a. refreshToken null/boş → EtsyTokenRefreshFailedError 401
 *         (kullanıcı Settings'ten yeniden bağlanmalı)
 *      b. refreshToken var → refreshAccessToken çağır
 *         - Success: EtsyConnection update (yeni access + refresh +
 *           tokenExpires + scopes corun) → decrypted yeni token döndür
 *         - Fail: underlying error message ile EtsyTokenRefreshFailedError
 *           wrap (Etsy reddetti / network / vs)
 *   4. Token geçerli ve grace dışında → mevcut decrypted accessToken döndür
 *
 * Connection state hâlâ kullanıcı action gerektiriyorsa (refresh fail)
 * dürüst 401 fırlatılır; UI Settings panel `expired` state gösterir.
 *
 * Read-only `resolveEtsyConnection` (connection.ts) DOKUNULMADI; tüketiciler
 * (V1'de yalnız submit) opportunistic refresh isterse bu helper'ı kullanır.
 */
export async function resolveEtsyConnectionWithRefresh(
  userId: string,
): Promise<EtsyConnectionResolved> {
  // 1. Store + connection fetch (read path emsali)
  const store = await db.store.findFirst({
    where: { userId, deletedAt: null },
    include: { etsyConnection: true },
  });

  if (!store || !store.etsyConnection) {
    throw new EtsyConnectionNotFoundError();
  }

  const connection = store.etsyConnection;

  if (!connection.accessToken) {
    throw new EtsyTokenMissingError();
  }

  if (!connection.shopId) {
    throw new EtsyTokenMissingError();
  }

  // 2. Token expiry guard — eğer grace window içinde değilse mevcut token'ı dön
  const now = Date.now();
  const expiresAt = connection.tokenExpires?.getTime() ?? 0;
  const needsRefresh = expiresAt - now <= TOKEN_REFRESH_GRACE_MS;

  if (!needsRefresh) {
    return {
      connection,
      accessToken: decryptSecret(connection.accessToken),
      shopId: connection.shopId,
    };
  }

  // 3. Refresh path — refreshToken yoksa honest fail
  if (!connection.refreshToken) {
    throw new EtsyTokenRefreshFailedError(
      "refresh token mevcut değil (eski bağlantı OAuth scope eksik veya manuel insert)",
    );
  }

  let refreshed;
  try {
    refreshed = await refreshAccessToken({
      refreshToken: decryptSecret(connection.refreshToken),
    });
  } catch (err) {
    // Etsy reddetti / token revoked / network — wrap honest error
    const message = err instanceof Error ? err.message : String(err);
    throw new EtsyTokenRefreshFailedError(message);
  }

  // 4. DB update — yeni token'ları encrypt + persist (scopes + shopId/shopName korun)
  const newTokenExpires = new Date(
    Date.now() + refreshed.expiresInSeconds * 1000,
  );
  const updated = await db.etsyConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encryptSecret(refreshed.accessToken),
      refreshToken: encryptSecret(refreshed.refreshToken),
      tokenExpires: newTokenExpires,
      // scopes, shopId, shopName: değişmez — Etsy refresh response'unda yer almaz
    },
  });

  return {
    connection: updated,
    accessToken: refreshed.accessToken, // already plain (just refreshed)
    shopId: connection.shopId,
  };
}
