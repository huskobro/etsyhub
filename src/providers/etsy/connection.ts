/**
 * Phase 9 V1 Task 4 — EtsyConnection DB lookup + token decrypt.
 *
 * Submit service `resolveEtsyConnection(userId)` ile bağlantıyı çözer.
 * Kullanıcının default store'undan EtsyConnection'a gider; yoksa typed throw.
 *
 * Token expiry guard:
 *   - tokenExpires < now → EtsyTokenExpiredError (Phase 9.1+ refresh worker)
 *   - accessToken null → EtsyTokenMissingError
 *
 * Encryption: schema'daki accessToken/refreshToken plain text değil — service
 * yazarken `encryptSecret`, okurken `decryptSecret` (CLAUDE.md güvenlik kuralı).
 *
 * NOT: V1 foundation'da yazma path'i (callback handler) gerçek live test
 * yapmaz; ama encrypt fonksiyonunu doğru çağırır. Read path test edilir.
 */

import { db } from "@/server/db";
import { decryptSecret } from "@/lib/secrets";
import {
  EtsyConnectionNotFoundError,
  EtsyTokenExpiredError,
  EtsyTokenMissingError,
} from "./errors";
import type { EtsyConnectionResolved } from "./types";

/**
 * Kullanıcının default store'unu bulur ve bağlı EtsyConnection'ı döner.
 * V1: Kullanıcının ilk Store'u (deletedAt null). Multi-store V1.1+ carry-forward.
 */
export async function resolveEtsyConnection(
  userId: string,
): Promise<EtsyConnectionResolved> {
  // V1: kullanıcının ilk store'u (Phase 1 single-store assumption)
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

  if (connection.tokenExpires && connection.tokenExpires < new Date()) {
    throw new EtsyTokenExpiredError();
  }

  if (!connection.shopId) {
    throw new EtsyTokenMissingError(); // shopId yoksa connection eksik kurulmuş
  }

  return {
    connection,
    accessToken: decryptSecret(connection.accessToken),
    shopId: connection.shopId,
  };
}

/**
 * `hasEtsyConnection(userId)` — non-throw helper.
 * UI conditional render için (örn. "Connect Etsy" CTA göster).
 * V1 foundation; UI consumer'ı yok ama definition var.
 */
export async function hasEtsyConnection(userId: string): Promise<boolean> {
  const store = await db.store.findFirst({
    where: { userId, deletedAt: null },
    include: { etsyConnection: true },
  });
  return !!(store?.etsyConnection?.accessToken && store.etsyConnection.shopId);
}
