// Phase 9 V1 — OAuth state cookie helper unit tests.
// next/headers cookies() mock'u + set/read/clear simetrisi.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock cookies() — set/get/delete spy'lar
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

import {
  setOAuthStateCookie,
  readOAuthStateCookie,
  clearOAuthStateCookie,
} from "@/providers/etsy/oauth-state-cookie";

beforeEach(() => {
  setSpy.mockReset();
  getSpy.mockReset();
  deleteSpy.mockReset();
});

describe("setOAuthStateCookie", () => {
  it("cookies().set name + base64-encoded JSON value + httpOnly + sameSite=lax + path", () => {
    setOAuthStateCookie({ state: "s-1", verifier: "v-1" });
    expect(setSpy).toHaveBeenCalledOnce();
    const [name, value, options] = setSpy.mock.calls[0]!;
    expect(name).toBe("etsy_oauth_state");
    // Decode value: base64url JSON
    const decoded = Buffer.from(value as string, "base64url").toString("utf8");
    expect(JSON.parse(decoded)).toEqual({ state: "s-1", verifier: "v-1" });
    // Options
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/api/etsy/oauth",
      maxAge: 600,
    });
  });
});

describe("readOAuthStateCookie", () => {
  it("cookie yoksa null", () => {
    getSpy.mockReturnValueOnce(undefined);
    expect(readOAuthStateCookie()).toBeNull();
  });

  it("malformed value (parse fail) → null", () => {
    getSpy.mockReturnValueOnce({ value: "not-base64-json" });
    // Buffer.from "not-base64-json" base64url'i decode etmeye çalışınca random
    // bytes verir; JSON.parse exception → catch → null
    expect(readOAuthStateCookie()).toBeNull();
  });

  it("eksik field (sadece state) → null", () => {
    const value = Buffer.from(JSON.stringify({ state: "x" })).toString(
      "base64url",
    );
    getSpy.mockReturnValueOnce({ value });
    expect(readOAuthStateCookie()).toBeNull();
  });

  it("yanlış tip (verifier number) → null", () => {
    const value = Buffer.from(
      JSON.stringify({ state: "x", verifier: 123 }),
    ).toString("base64url");
    getSpy.mockReturnValueOnce({ value });
    expect(readOAuthStateCookie()).toBeNull();
  });

  it("geçerli payload → çözülmüş obje döner", () => {
    const value = Buffer.from(
      JSON.stringify({ state: "s-2", verifier: "v-2" }),
    ).toString("base64url");
    getSpy.mockReturnValueOnce({ value });
    expect(readOAuthStateCookie()).toEqual({ state: "s-2", verifier: "v-2" });
  });
});

describe("clearOAuthStateCookie", () => {
  it("cookies().delete name + path objesi ile çağrılır", () => {
    clearOAuthStateCookie();
    expect(deleteSpy).toHaveBeenCalledOnce();
    expect(deleteSpy).toHaveBeenCalledWith({
      name: "etsy_oauth_state",
      path: "/api/etsy/oauth",
    });
  });
});
