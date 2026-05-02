// Phase 8 Task 30 — useMockupJobCompletionToast: completion/failure transition
// → toast emit.
//
// 5 core scenarios:
//   1. RUNNING → COMPLETED: success toast (successRenders sayıyla).
//   2. RUNNING → PARTIAL_COMPLETE: success toast (kısmi sayım).
//   3. RUNNING → FAILED: error toast (errorSummary ile).
//   4. RUNNING → CANCELLED: toast emit ETMEZ.
//   5. COMPLETED → COMPLETED re-render: re-push olmaz (debounce guard).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMockupJobCompletionToast } from "@/features/mockups/hooks/useMockupJobCompletionToast";
import type { MockupJobView } from "@/features/mockups/hooks/useMockupJob";

// Mock toast store
let mockToasts: Array<{ tone: string; message: string; source?: string }> = [];

vi.mock("@/features/selection/stores/toast-store", () => ({
  useSelectionStudioToasts: vi.fn((selector) => {
    return selector({
      push: (toast: any) => {
        mockToasts.push(toast);
      },
    });
  }),
}));

function createMockJob(overrides?: Partial<MockupJobView>): MockupJobView {
  return {
    id: "job-1",
    status: "RUNNING",
    packSize: 10,
    actualPackSize: 10,
    totalRenders: 10,
    successRenders: 5,
    failedRenders: 0,
    coverRenderId: "render-1",
    errorSummary: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    estimatedCompletionAt: new Date(Date.now() + 10000).toISOString(),
    renders: [],
    ...overrides,
  };
}

describe("useMockupJobCompletionToast", () => {
  beforeEach(() => {
    mockToasts = [];
    vi.clearAllMocks();
  });

  it("RUNNING → COMPLETED: success toast ile (successRenders ile)", () => {
    const { rerender } = renderHook(
      ({ job }: { job?: MockupJobView }) => useMockupJobCompletionToast(job),
      {
        initialProps: {
          job: createMockJob({ status: "RUNNING", successRenders: 5 }),
        } as any,
      }
    );

    expect(mockToasts).toHaveLength(0);

    // Transition: RUNNING → COMPLETED
    rerender({
      job: createMockJob({
        status: "COMPLETED",
        successRenders: 10,
        completedAt: new Date().toISOString(),
      }),
    });

    expect(mockToasts).toHaveLength(1);
    expect(mockToasts[0]).toEqual({
      tone: "success",
      message: "Pack hazır: 10 görsel — Sonucu gör",
      source: "mockup-job",
    });
  });

  it("RUNNING → PARTIAL_COMPLETE: success toast ile (kısmi sayım)", () => {
    const { rerender } = renderHook(
      ({ job }) => useMockupJobCompletionToast(job),
      {
        initialProps: {
          job: createMockJob({ status: "RUNNING", successRenders: 3 }),
        },
      }
    );

    expect(mockToasts).toHaveLength(0);

    // Transition: RUNNING → PARTIAL_COMPLETE
    rerender({
      job: createMockJob({
        status: "PARTIAL_COMPLETE",
        successRenders: 7,
        actualPackSize: 10,
        completedAt: new Date().toISOString(),
      }),
    });

    expect(mockToasts).toHaveLength(1);
    expect(mockToasts[0]).toEqual({
      tone: "success",
      message: "Pack hazır: 7/10 görsel — Sonucu gör",
      source: "mockup-job",
    });
  });

  it("RUNNING → FAILED: error toast ile (errorSummary)", () => {
    const { rerender } = renderHook(
      ({ job }) => useMockupJobCompletionToast(job),
      {
        initialProps: {
          job: createMockJob({ status: "RUNNING" }),
        },
      }
    );

    expect(mockToasts).toHaveLength(0);

    // Transition: RUNNING → FAILED
    rerender({
      job: createMockJob({
        status: "FAILED",
        errorSummary: "Provider timeout",
        failedRenders: 10,
        completedAt: new Date().toISOString(),
      }),
    });

    expect(mockToasts).toHaveLength(1);
    expect(mockToasts[0]).toEqual({
      tone: "error",
      message: "Pack hazırlanamadı: Provider timeout",
      source: "mockup-job",
    });
  });

  it("RUNNING → FAILED: errorSummary null → fallback message", () => {
    const { rerender } = renderHook(
      ({ job }) => useMockupJobCompletionToast(job),
      {
        initialProps: {
          job: createMockJob({ status: "RUNNING" }),
        },
      }
    );

    expect(mockToasts).toHaveLength(0);

    // Transition: RUNNING → FAILED (errorSummary null)
    rerender({
      job: createMockJob({
        status: "FAILED",
        errorSummary: null,
        failedRenders: 10,
        completedAt: new Date().toISOString(),
      }),
    });

    expect(mockToasts).toHaveLength(1);
    expect(mockToasts[0]).toEqual({
      tone: "error",
      message: "Pack hazırlanamadı: bilinmeyen hata",
      source: "mockup-job",
    });
  });

  it("RUNNING → CANCELLED: toast emit ETMEZ", () => {
    const { rerender } = renderHook(
      ({ job }) => useMockupJobCompletionToast(job),
      {
        initialProps: {
          job: createMockJob({ status: "RUNNING" }),
        },
      }
    );

    expect(mockToasts).toHaveLength(0);

    // Transition: RUNNING → CANCELLED
    rerender({
      job: createMockJob({
        status: "CANCELLED",
        completedAt: new Date().toISOString(),
      }),
    });

    // Toast emit edilmez (kullanıcı kendi iptal etti)
    expect(mockToasts).toHaveLength(0);
  });

  it("COMPLETED → COMPLETED re-render: re-push olmaz (debounce guard)", () => {
    const { rerender } = renderHook(
      ({ job }) => useMockupJobCompletionToast(job),
      {
        initialProps: {
          job: createMockJob({
            status: "COMPLETED",
            successRenders: 10,
            completedAt: new Date().toISOString(),
          }),
        },
      }
    );

    // İlk render: no transition (zaten COMPLETED'dan başladı)
    expect(mockToasts).toHaveLength(0);

    // Re-render: COMPLETED → COMPLETED (status değişmedi)
    rerender({
      job: createMockJob({
        status: "COMPLETED",
        successRenders: 10,
        completedAt: new Date().toISOString(),
      }),
    });

    // Toast push edilmez (status değişmedi; guard aktif)
    expect(mockToasts).toHaveLength(0);
  });

  it("undefined job: toast emit ETMEZ", () => {
    const { rerender } = renderHook(
      ({ job }: { job?: MockupJobView }) => useMockupJobCompletionToast(job),
      {
        initialProps: { job: undefined },
      }
    );

    expect(mockToasts).toHaveLength(0);

    // undefined → COMPLETED (transition yok; job null'dan başladı)
    rerender({
      job: createMockJob({ status: "COMPLETED", successRenders: 10 }),
    } as any);

    // Toast emit edilmez (wasProcessing false; transition yok)
    expect(mockToasts).toHaveLength(0);
  });

  it("QUEUED → COMPLETED: transition guard'ı (QUEUED processing)", () => {
    const { rerender } = renderHook(
      ({ job }) => useMockupJobCompletionToast(job),
      {
        initialProps: {
          job: createMockJob({ status: "QUEUED" }),
        },
      }
    );

    expect(mockToasts).toHaveLength(0);

    // Transition: QUEUED → COMPLETED
    rerender({
      job: createMockJob({
        status: "COMPLETED",
        successRenders: 10,
        completedAt: new Date().toISOString(),
      }),
    });

    expect(mockToasts).toHaveLength(1);
    expect(mockToasts[0]?.tone).toBe("success");
  });
});
