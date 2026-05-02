// Phase 9 V1 Task 4 — Etsy OAuth scaffold unit tests.
// isEtsyConfigured / getEtsyOAuthConfig / buildAuthorizationUrl + sabitler.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildAuthorizationUrl,
  isEtsyConfigured,
  ETSY_DEFAULT_SCOPES,
  ETSY_AUTH_URL,
  ETSY_TOKEN_URL,
} from "@/providers/etsy/oauth";
import { EtsyNotConfiguredError } from "@/providers/etsy/errors";

// Re-import for getEtsyOAuthConfig (not exported via barrel).
import { getEtsyOAuthConfig } from "@/providers/etsy/oauth";

const ENV_KEYS = ["ETSY_CLIENT_ID", "ETSY_CLIENT_SECRET", "ETSY_REDIRECT_URI"] as const;
const original: Record<string, string | undefined> = {};

beforeEach(() => {
  // Save originals
  for (const k of ENV_KEYS) original[k] = process.env[k];
  // Default: clear all
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  // Restore originals
  for (const k of ENV_KEYS) {
    if (original[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = original[k];
    }
  }
});

describe("constants", () => {
  it("ETSY_AUTH_URL sabit değer", () => {
    expect(ETSY_AUTH_URL).toBe("https://www.etsy.com/oauth/connect");
  });

  it("ETSY_TOKEN_URL sabit değer", () => {
    expect(ETSY_TOKEN_URL).toBe("https://api.etsy.com/v3/public/oauth/token");
  });

  it("ETSY_DEFAULT_SCOPES V1 minimal scope listesi", () => {
    expect(ETSY_DEFAULT_SCOPES).toEqual(["listings_w", "listings_r", "shops_r"]);
  });
});

describe("isEtsyConfigured", () => {
  it("env yokken false", () => {
    expect(isEtsyConfigured()).toBe(false);
  });

  it("kısmi env (sadece client_id) → false", () => {
    process.env.ETSY_CLIENT_ID = "test-id";
    expect(isEtsyConfigured()).toBe(false);
  });

  it("üçü de varsa true", () => {
    process.env.ETSY_CLIENT_ID = "test-id";
    process.env.ETSY_CLIENT_SECRET = "test-secret";
    process.env.ETSY_REDIRECT_URI = "http://localhost:3000/cb";
    expect(isEtsyConfigured()).toBe(true);
  });
});

describe("getEtsyOAuthConfig", () => {
  it("env yokken EtsyNotConfiguredError throw", () => {
    expect(() => getEtsyOAuthConfig()).toThrow(EtsyNotConfiguredError);
  });

  it("env varsa config döner", () => {
    process.env.ETSY_CLIENT_ID = "id";
    process.env.ETSY_CLIENT_SECRET = "secret";
    process.env.ETSY_REDIRECT_URI = "http://localhost:3000/cb";
    const cfg = getEtsyOAuthConfig();
    expect(cfg.clientId).toBe("id");
    expect(cfg.clientSecret).toBe("secret");
    expect(cfg.redirectUri).toBe("http://localhost:3000/cb");
  });
});

describe("buildAuthorizationUrl", () => {
  beforeEach(() => {
    process.env.ETSY_CLIENT_ID = "test-client-id";
    process.env.ETSY_CLIENT_SECRET = "test-secret";
    process.env.ETSY_REDIRECT_URI = "http://localhost:3000/api/etsy/oauth/callback";
  });

  it("doğru URL üretir (response_type=code, code_challenge_method=S256)", () => {
    const url = buildAuthorizationUrl({
      state: "csrf-state-1",
      codeChallenge: "challenge-abc",
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(ETSY_AUTH_URL);
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/etsy/oauth/callback",
    );
    expect(parsed.searchParams.get("state")).toBe("csrf-state-1");
    expect(parsed.searchParams.get("code_challenge")).toBe("challenge-abc");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("default scopes space-joined", () => {
    const url = buildAuthorizationUrl({
      state: "s",
      codeChallenge: "c",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("scope")).toBe("listings_w listings_r shops_r");
  });

  it("custom scopes override default", () => {
    const url = buildAuthorizationUrl({
      state: "s",
      codeChallenge: "c",
      scopes: ["listings_r"],
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("scope")).toBe("listings_r");
  });

  it("env yokken EtsyNotConfiguredError throw", () => {
    delete process.env.ETSY_CLIENT_ID;
    expect(() =>
      buildAuthorizationUrl({ state: "s", codeChallenge: "c" }),
    ).toThrow(EtsyNotConfiguredError);
  });
});
