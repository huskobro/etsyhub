// Phase 9 V1 — OAuth callback route integration tests.
// Tüm hata path'leri + happy path → /settings?etsy=... redirect.

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";

// requireUser mock
vi.mock("@/server/session", () => ({
  requireUser: vi.fn(async () => ({
    id: "test-user-oauth-cb",
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

// Token exchange + persist mocks (gerçek HTTP çağırma)
vi.mock("@/providers/etsy/oauth", async () => {
  const actual =
    await vi.importActual<typeof import("@/providers/etsy/oauth")>(
      "@/providers/etsy/oauth",
    );
  return {
    ...actual,
    exchangeAuthorizationCode: vi.fn(),
  };
});

vi.mock("@/providers/etsy/connection.service", async () => {
  const actual =
    await vi.importActual<typeof import("@/providers/etsy/connection.service")>(
      "@/providers/etsy/connection.service",
    );
  return {
    ...actual,
    persistEtsyConnection: vi.fn(),
  };
});

import { GET } from "@/app/api/etsy/oauth/callback/route";
import { exchangeAuthorizationCode } from "@/providers/etsy/oauth";
import { persistEtsyConnection } from "@/providers/etsy/connection.service";
import { EtsyApiError } from "@/providers/etsy/errors";

// Helper: cookie payload set helper
function mockCookieState(state: string, verifier: string) {
  const value = Buffer.from(JSON.stringify({ state, verifier })).toString(
    "base64url",
  );
  getSpy.mockReturnValueOnce({ value });
}

function makeReq(url: string): Request {
  return new Request(url);
}

const originalAppUrl = process.env.APP_URL;
beforeEach(() => {
  setSpy.mockReset();
  getSpy.mockReset();
  deleteSpy.mockReset();
  vi.mocked(exchangeAuthorizationCode).mockReset();
  vi.mocked(persistEtsyConnection).mockReset();
  // APP_URL set — redirect base
  process.env.APP_URL = "http://localhost:3000";
});

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.APP_URL;
  } else {
    process.env.APP_URL = originalAppUrl;
  }
});

afterAll(() => {
  vi.restoreAllMocks();
});

function expectRedirectTo(res: Response, reason: string) {
  expect(res.status).toBe(302);
  const loc = res.headers.get("location");
  expect(loc).toBeTruthy();
  const parsed = new URL(loc!);
  expect(parsed.pathname).toBe("/settings");
  expect(parsed.searchParams.get("etsy")).toBe(reason);
}

describe("GET /api/etsy/oauth/callback", () => {
  it("?error=access_denied → /settings?etsy=error-access_denied + cookie cleared", async () => {
    const req = makeReq(
      "http://localhost/api/etsy/oauth/callback?error=access_denied",
    );
    const res = await GET(req);
    expectRedirectTo(res, "error-access_denied");
    expect(deleteSpy).toHaveBeenCalled();
  });

  it("missing code → /settings?etsy=missing-code", async () => {
    const req = makeReq(
      "http://localhost/api/etsy/oauth/callback?state=abc",
    );
    const res = await GET(req);
    expectRedirectTo(res, "missing-code");
  });

  it("missing state param → /settings?etsy=missing-code", async () => {
    const req = makeReq("http://localhost/api/etsy/oauth/callback?code=xyz");
    const res = await GET(req);
    expectRedirectTo(res, "missing-code");
  });

  it("cookie yok → /settings?etsy=missing-state", async () => {
    getSpy.mockReturnValueOnce(undefined);
    const req = makeReq(
      "http://localhost/api/etsy/oauth/callback?code=xyz&state=abc",
    );
    const res = await GET(req);
    expectRedirectTo(res, "missing-state");
  });

  it("state mismatch → /settings?etsy=state-mismatch + cookie cleared", async () => {
    mockCookieState("server-state", "v");
    const req = makeReq(
      "http://localhost/api/etsy/oauth/callback?code=xyz&state=different-state",
    );
    const res = await GET(req);
    expectRedirectTo(res, "state-mismatch");
    expect(deleteSpy).toHaveBeenCalled();
  });

  it("happy path: token exchange + persist OK → /settings?etsy=connected + cookie cleared", async () => {
    mockCookieState("s-1", "v-1");
    vi.mocked(exchangeAuthorizationCode).mockResolvedValueOnce({
      accessToken: "at",
      refreshToken: "rt",
      expiresInSeconds: 3600,
      tokenType: "Bearer",
    });
    vi.mocked(persistEtsyConnection).mockResolvedValueOnce({
      shopId: "12345",
      shopName: "TestShop",
    });

    const req = makeReq(
      "http://localhost/api/etsy/oauth/callback?code=xyz&state=s-1",
    );
    const res = await GET(req);
    expectRedirectTo(res, "connected");
    expect(exchangeAuthorizationCode).toHaveBeenCalledWith({
      code: "xyz",
      codeVerifier: "v-1",
    });
    expect(persistEtsyConnection).toHaveBeenCalledOnce();
    expect(deleteSpy).toHaveBeenCalled();
  });

  it("token exchange AppError throw → /settings?etsy=error-{code}", async () => {
    mockCookieState("s-1", "v-1");
    vi.mocked(exchangeAuthorizationCode).mockRejectedValueOnce(
      new EtsyApiError("token endpoint error", 502),
    );

    const req = makeReq(
      "http://localhost/api/etsy/oauth/callback?code=xyz&state=s-1",
    );
    const res = await GET(req);
    expectRedirectTo(res, "error-ETSY_API_ERROR");
  });

  it("persist throw → /settings?etsy=error-{code}", async () => {
    mockCookieState("s-1", "v-1");
    vi.mocked(exchangeAuthorizationCode).mockResolvedValueOnce({
      accessToken: "at",
      refreshToken: "rt",
      expiresInSeconds: 3600,
      tokenType: "Bearer",
    });
    vi.mocked(persistEtsyConnection).mockRejectedValueOnce(
      new EtsyApiError("shop lookup failed", 502),
    );

    const req = makeReq(
      "http://localhost/api/etsy/oauth/callback?code=xyz&state=s-1",
    );
    const res = await GET(req);
    expectRedirectTo(res, "error-ETSY_API_ERROR");
  });

  it("non-AppError generic Error → /settings?etsy=error-exchange-failed", async () => {
    mockCookieState("s-1", "v-1");
    vi.mocked(exchangeAuthorizationCode).mockRejectedValueOnce(
      new Error("network down"),
    );

    const req = makeReq(
      "http://localhost/api/etsy/oauth/callback?code=xyz&state=s-1",
    );
    const res = await GET(req);
    expectRedirectTo(res, "error-exchange-failed");
  });
});
