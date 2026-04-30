// Phase 7 Task 13 — generateExportSignedUrl unit testleri.
//
// Test sözleşmesi (plan Task 13, design Section 6.5):
//   - TTL sabiti: EXPORT_SIGNED_URL_TTL_SECONDS === 24 * 3600 (86400 saniye).
//   - getStorage().signedUrl(key, ttl) doğru argümanlarla çağrılır.
//   - Helper, storage'ın döndürdüğü URL'i AYNEN propagate eder.
//   - expiresAt: Date.now() + 24h ± 5 saniye toleransla doğru.
//
// Mock stratejisi:
//   - `@/providers/storage` getStorage() mock'lanır; signedUrl spy alınır.

import { describe, it, expect, vi, beforeEach } from "vitest";

const signedUrlMock = vi.fn();
vi.mock("@/providers/storage", () => ({
  getStorage: () => ({
    signedUrl: signedUrlMock,
  }),
}));

import {
  generateExportSignedUrl,
  EXPORT_SIGNED_URL_TTL_SECONDS,
} from "@/server/services/selection/export/signed-url";

describe("generateExportSignedUrl — TTL sabiti", () => {
  it("EXPORT_SIGNED_URL_TTL_SECONDS === 24 * 3600 (86400)", () => {
    expect(EXPORT_SIGNED_URL_TTL_SECONDS).toBe(24 * 3600);
    expect(EXPORT_SIGNED_URL_TTL_SECONDS).toBe(86400);
  });
});

describe("generateExportSignedUrl — happy path", () => {
  beforeEach(() => {
    signedUrlMock.mockReset();
  });

  it("storage.signedUrl(key, 24h) doğru argümanlarla çağrılır", async () => {
    signedUrlMock.mockResolvedValue("https://mock-signed.example/zip?token=abc");
    const key = "exports/u1/s1/j1.zip";
    await generateExportSignedUrl(key);
    expect(signedUrlMock).toHaveBeenCalledTimes(1);
    expect(signedUrlMock).toHaveBeenCalledWith(key, 86400);
  });

  it("storage'ın döndürdüğü URL aynen propagate edilir", async () => {
    const stubUrl = "https://mock-signed.example/zip?token=xyz&exp=999";
    signedUrlMock.mockResolvedValue(stubUrl);
    const result = await generateExportSignedUrl("exports/u/s/j.zip");
    expect(result.url).toBe(stubUrl);
  });

  it("expiresAt = now + 24h ± 5 saniye toleransla doğru", async () => {
    signedUrlMock.mockResolvedValue("https://mock");
    const before = Date.now();
    const result = await generateExportSignedUrl("exports/u/s/j.zip");
    const after = Date.now();

    const expectedMin = before + 24 * 3600 * 1000 - 5000;
    const expectedMax = after + 24 * 3600 * 1000 + 5000;

    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
  });
});
