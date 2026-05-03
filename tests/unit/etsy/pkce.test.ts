// Phase 9 V1 — PKCE helper unit tests.
// generateCodeVerifier/Challenge RFC 7636 + state nonce.

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from "@/providers/etsy/pkce";

const BASE64URL_RX = /^[A-Za-z0-9_-]+$/;

describe("generateCodeVerifier", () => {
  it("RFC 7636 minimum (43+) char base64url", () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(BASE64URL_RX);
  });

  it("padding ('=') yok (base64url)", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).not.toContain("=");
    expect(verifier).not.toContain("+");
    expect(verifier).not.toContain("/");
  });

  it("aynı çağrı farklı sonuç döner (random)", () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe("generateCodeChallenge", () => {
  it("SHA256(verifier) base64url, deterministic", () => {
    const verifier = "fixed-test-verifier";
    const a = generateCodeChallenge(verifier);
    const b = generateCodeChallenge(verifier);
    expect(a).toBe(b);
    // Manuel SHA256 ile karşılaştır
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(a).toBe(expected);
  });

  it("base64url alphabet, padding yok", () => {
    const challenge = generateCodeChallenge("abc");
    expect(challenge).toMatch(BASE64URL_RX);
    expect(challenge).not.toContain("=");
  });

  it("farklı verifier farklı challenge", () => {
    expect(generateCodeChallenge("a")).not.toBe(generateCodeChallenge("b"));
  });
});

describe("generateState", () => {
  it("opaque random string (16+ char)", () => {
    const state = generateState();
    expect(state.length).toBeGreaterThanOrEqual(16);
    expect(state).toMatch(BASE64URL_RX);
  });

  it("aynı çağrı farklı sonuç (random)", () => {
    expect(generateState()).not.toBe(generateState());
  });
});
