/**
 * Phase 9 V1 — Etsy OAuth state + PKCE verifier cookie helper.
 *
 * Cookie strategy (Next.js cookies() API — Next 14.2 senkron):
 *   - HttpOnly + Secure (production) + SameSite=Lax
 *   - Tek cookie: JSON { state, verifier } base64-encoded
 *   - Path: /api/etsy/oauth (callback route'u kapsar)
 *   - Max-Age: 600 saniye (10 dk — OAuth flow süresi yeterli)
 *
 * Niye tek cookie + JSON: state ve verifier eşleşik kullanılır; ayrı
 * cookie yönetmek state drift riski. Read-once + delete pattern.
 *
 * NOT: Cookie body kullanıcının başka oturumlarda görünür (httpOnly olsa
 * bile pre-shared API gibi davranır). Verifier kısa-ömürlü ve callback
 * sonrası silinir; bu V1 için kabul edilebilir threat model.
 */

import { cookies } from "next/headers";

const COOKIE_NAME = "etsy_oauth_state";
const COOKIE_PATH = "/api/etsy/oauth";
const COOKIE_MAX_AGE = 600; // 10 minutes

type StateCookiePayload = {
  state: string;
  verifier: string;
};

export function setOAuthStateCookie(payload: StateCookiePayload): void {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  cookies().set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE,
  });
}

export function readOAuthStateCookie(): StateCookiePayload | null {
  const c = cookies().get(COOKIE_NAME);
  if (!c) return null;
  try {
    const decoded = Buffer.from(c.value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<StateCookiePayload>;
    if (typeof parsed.state !== "string" || typeof parsed.verifier !== "string") {
      return null;
    }
    return { state: parsed.state, verifier: parsed.verifier };
  } catch {
    return null;
  }
}

export function clearOAuthStateCookie(): void {
  cookies().delete({ name: COOKIE_NAME, path: COOKIE_PATH });
}
