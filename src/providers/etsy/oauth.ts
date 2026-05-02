/**
 * Phase 9 V1 Task 4 — Etsy OAuth 2.0 scaffold.
 *
 * V1 KAPSAMI:
 *   - Authorization URL builder (state nonce + PKCE skeleton)
 *   - Token exchange contract
 *   - Refresh token contract
 *
 * V1 foundation, NOT WIRED:
 *   - UI bağlantısı yok (Settings → Etsy bağlantı paneli sonraki slice)
 *   - Callback route foundation; ama "tamamlandı" değil — credential gelmeden
 *     end-to-end smoke yapılmaz
 *
 * Etsy OAuth 2.0 docs:
 *   https://developer.etsy.com/documentation/essentials/authentication
 *
 * Endpoint sabitleri:
 *   - Auth URL: https://www.etsy.com/oauth/connect
 *   - Token URL: https://api.etsy.com/v3/public/oauth/token
 */

import { EtsyNotConfiguredError } from "./errors";
import { classifyEtsyHttpError, classifyEtsyNetworkError } from "./error-classifier";

export const ETSY_AUTH_URL = "https://www.etsy.com/oauth/connect";
export const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

/** V1 minimal scopes. Etsy taxonomy: listings_w (write), listings_r (read), shops_r. */
export const ETSY_DEFAULT_SCOPES = ["listings_w", "listings_r", "shops_r"];

/**
 * Env config — runtime check. ETSY_CLIENT_ID / ETSY_CLIENT_SECRET / ETSY_REDIRECT_URI
 * `process.env`'den okunur; yoksa EtsyNotConfiguredError.
 *
 * NOT: env.ts schema'sına eklemiyoruz çünkü env.ts strict required validation
 * yapıyor — boot-time fail istemiyoruz. Runtime opt-in pattern'ı (KIE/Gemini
 * settings simetrisi).
 */
export type EtsyOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function getEtsyOAuthConfig(): EtsyOAuthConfig {
  const clientId = process.env.ETSY_CLIENT_ID;
  const clientSecret = process.env.ETSY_CLIENT_SECRET;
  const redirectUri = process.env.ETSY_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new EtsyNotConfiguredError();
  }
  return { clientId, clientSecret, redirectUri };
}

/**
 * `isEtsyConfigured()` — boot/diagnostic check.
 * Throw etmez; UI ya da admin diagnostics consumer'ı için.
 */
export function isEtsyConfigured(): boolean {
  return !!(
    process.env.ETSY_CLIENT_ID &&
    process.env.ETSY_CLIENT_SECRET &&
    process.env.ETSY_REDIRECT_URI
  );
}

export type AuthorizationUrlOptions = {
  /** CSRF state — caller cookie'ye yazıp callback'te match etmeli. */
  state: string;
  /** PKCE code_challenge (SHA256 base64url). */
  codeChallenge: string;
  /** Custom scopes; default ETSY_DEFAULT_SCOPES. */
  scopes?: string[];
};

/**
 * Etsy authorization URL builder (PKCE).
 *
 * Etsy OAuth 2.0 + PKCE: response_type=code, code_challenge_method=S256.
 * Redirect kullanıcı izin verirse {redirectUri}?code=...&state=... olur.
 */
export function buildAuthorizationUrl(opts: AuthorizationUrlOptions): string {
  const cfg = getEtsyOAuthConfig();
  const scopes = opts.scopes ?? ETSY_DEFAULT_SCOPES;

  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: cfg.redirectUri,
    scope: scopes.join(" "),
    client_id: cfg.clientId,
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  });

  return `${ETSY_AUTH_URL}?${params.toString()}`;
}

export type TokenExchangeResult = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  /** "Bearer" — Etsy V3 sabit. */
  tokenType: string;
};

/**
 * Authorization code → access/refresh token exchange.
 *
 * V1 foundation: HTTP signature hazır, gerçek live test external dependency
 * (ETSY_CLIENT_SECRET + redirect URI verified) bekler.
 *
 * Provider impl'i Etsy /v3/public/oauth/token'ı çağırır:
 *   POST application/x-www-form-urlencoded
 *   grant_type=authorization_code
 *   client_id, redirect_uri, code, code_verifier
 *
 * Hata durumunda EtsyApiError fırlatır (classifyEtsyHttpError reuse).
 */
export async function exchangeAuthorizationCode(opts: {
  code: string;
  codeVerifier: string;
}): Promise<TokenExchangeResult> {
  const cfg = getEtsyOAuthConfig();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    code: opts.code,
    code_verifier: opts.codeVerifier,
  });

  let res: Response;
  try {
    res = await fetch(ETSY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Etsy OAuth 2.0: Basic auth (client_id:client_secret) PKCE ile birlikte
        // optional değil mecburi; docs onayında "Basic + PKCE" doğrulanmıştır.
        "Authorization": `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    classifyEtsyNetworkError(err);
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    classifyEtsyHttpError({ status: res.status, body: errBody });
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresInSeconds: json.expires_in,
    tokenType: json.token_type,
  };
}

/**
 * Refresh token kullanarak yeni access token al.
 * V1 foundation; Phase 9.1+ submit worker token expiry guard'ı kullanacak.
 */
export async function refreshAccessToken(opts: {
  refreshToken: string;
}): Promise<TokenExchangeResult> {
  const cfg = getEtsyOAuthConfig();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: cfg.clientId,
    refresh_token: opts.refreshToken,
  });

  let res: Response;
  try {
    res = await fetch(ETSY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    classifyEtsyNetworkError(err);
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    classifyEtsyHttpError({ status: res.status, body: errBody });
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresInSeconds: json.expires_in,
    tokenType: json.token_type,
  };
}
