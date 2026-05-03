// Phase 9 V1 — OAuth start route integration tests.
// Honest fail (env yok → 503) + redirect 302 + cookie set davranışı.

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterAll,
  afterEach,
} from "vitest";

// requireUser mock — auth gate
vi.mock("@/server/session", () => ({
  requireUser: vi.fn(async () => ({
    id: "test-user-oauth-start",
    email: "test@local",
    role: "USER",
  })),
}));

// next/headers cookies() mock
const setSpy = vi.fn();
const getSpy = vi.fn();
const deleteSpy = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => ({
    set: setSpy,
    get: getSpy,
    delete: deleteSpy,
  }),
}));

import { GET } from "@/app/api/etsy/oauth/start/route";

const ENV_KEYS = [
  "ETSY_CLIENT_ID",
  "ETSY_CLIENT_SECRET",
  "ETSY_REDIRECT_URI",
] as const;
const original: Record<string, string | undefined> = {};

beforeEach(() => {
  setSpy.mockReset();
  getSpy.mockReset();
  deleteSpy.mockReset();
  // Save originals + clear
  for (const k of ENV_KEYS) {
    original[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (original[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = original[k];
    }
  }
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("GET /api/etsy/oauth/start", () => {
  it("env yokken 503 EtsyNotConfigured", async () => {
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("ETSY_NOT_CONFIGURED");
  });

  it("env varken Etsy authorization URL'e 302 redirect + cookie set", async () => {
    process.env.ETSY_CLIENT_ID = "test-client-id";
    process.env.ETSY_CLIENT_SECRET = "test-secret";
    process.env.ETSY_REDIRECT_URI =
      "http://localhost:3000/api/etsy/oauth/callback";

    const res = await GET();
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toBeTruthy();
    expect(location!).toMatch(/^https:\/\/www\.etsy\.com\/oauth\/connect\?/);

    // URL'de PKCE + state + redirect_uri
    const parsed = new URL(location!);
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("code_challenge")).toBeTruthy();
    expect(parsed.searchParams.get("state")).toBeTruthy();

    // Cookie set edildi (state + verifier base64-encoded JSON)
    expect(setSpy).toHaveBeenCalledOnce();
    const [name, value, options] = setSpy.mock.calls[0]!;
    expect(name).toBe("etsy_oauth_state");
    const decoded = Buffer.from(value as string, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as {
      state: string;
      verifier: string;
    };
    expect(payload.state).toBe(parsed.searchParams.get("state"));
    expect(payload.verifier).toBeTruthy();
    expect(options).toMatchObject({
      httpOnly: true,
      path: "/api/etsy/oauth",
    });
  });
});
