// Phase 7 Task 13 — selection-export-cleanup worker integration testleri.
//
// Test sözleşmesi (plan Task 13, design Section 6.5):
//   - Worker handler eski ZIP'leri siler (cleanupExpiredExports'u çağırır).
//   - Worker handler 7 günden yeni ZIP'leri silmez.
//   - Worker handler 0 ZIP'li bucket'ta clean (no-op).
//
// Test stratejisi:
//   - Worker handler doğrudan test edilir (queue üzerinden değil — Phase 6 emsali).
//   - Cleanup service mock'lanır → handler input/output kontratını test eder.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

const { cleanupMock } = vi.hoisted(() => ({
  cleanupMock: vi.fn(),
}));
vi.mock("@/server/services/selection/export/cleanup", () => ({
  cleanupExpiredExports: cleanupMock,
}));

import { handleSelectionExportCleanup } from "@/server/workers/selection-export-cleanup.worker";

function makeJob(jobId = "w13-cleanup-job-1"): Job<Record<string, never>> {
  return { id: jobId, data: {} } as unknown as Job<Record<string, never>>;
}

beforeEach(() => {
  cleanupMock.mockReset();
});

describe("handleSelectionExportCleanup — happy path", () => {
  it("cleanupExpiredExports çağrılır ve sonucu propagate eder", async () => {
    cleanupMock.mockResolvedValue({ deletedCount: 5, totalScanned: 12 });
    const result = await handleSelectionExportCleanup(makeJob());
    expect(cleanupMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ deletedCount: 5, totalScanned: 12 });
  });

  it("0 ZIP'li bucket → deletedCount=0, totalScanned=0", async () => {
    cleanupMock.mockResolvedValue({ deletedCount: 0, totalScanned: 0 });
    const result = await handleSelectionExportCleanup(makeJob("empty-job"));
    expect(result.deletedCount).toBe(0);
    expect(result.totalScanned).toBe(0);
  });

  it("yeni ZIP'lerden silmez (cleanup 0 dönerse)", async () => {
    cleanupMock.mockResolvedValue({ deletedCount: 0, totalScanned: 3 });
    const result = await handleSelectionExportCleanup(makeJob("fresh-only"));
    expect(result.deletedCount).toBe(0);
    expect(result.totalScanned).toBe(3);
  });
});

describe("handleSelectionExportCleanup — failure propagation", () => {
  it("cleanupExpiredExports throw ederse handler de re-throw eder", async () => {
    cleanupMock.mockRejectedValue(new Error("boom"));
    await expect(handleSelectionExportCleanup(makeJob())).rejects.toThrow("boom");
  });
});
