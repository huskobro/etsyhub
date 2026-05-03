/**
 * Phase 9 V1 — Etsy OAuth PKCE helpers.
 *
 * - generateCodeVerifier(): RFC 7636 compliant random string (43-128 char,
 *   url-safe). Crypto.randomBytes 32 byte → base64url.
 * - generateCodeChallenge(verifier): SHA256(verifier) → base64url.
 * - generateState(): CSRF state nonce (random, opaque).
 *
 * Server-side only (node:crypto). Client'a sızdırma — start route bunları
 * üretir, verifier cookie'ye yazar (httpOnly), browser'a sadece challenge
 * gider.
 */

import { createHash, randomBytes } from "node:crypto";

export function generateCodeVerifier(): string {
  // 32 byte → 43 char base64url (RFC 7636 minimum 43)
  return randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function generateState(): string {
  return randomBytes(16).toString("base64url");
}
