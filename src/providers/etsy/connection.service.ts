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
import { encryptSecret } from "@/lib/secrets";
import {
  isEtsyConfigured,
  ETSY_DEFAULT_SCOPES,
  getEtsyOAuthConfig,
} from "./oauth";
import {
  classifyEtsyHttpError,
  classifyEtsyNetworkError,
} from "./error-classifier";
import { EtsyApiError } from "./errors";

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
