// Phase 7 Task 39 — useExportCompletionToast testleri.
//
// Sözleşme (plan Task 39):
//   - Initial render (idle) → push edilmez.
//   - Transition queued/running → completed → success toast.
//   - Transition queued/running → failed → error toast (failedReason).
//   - Hâlâ processing iken transition yok → push edilmez.
//   - null/idle → push edilmez.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useExportCompletionToast } from "@/features/selection/hooks/useExportCompletionToast";
import { useSelectionStudioToasts } from "@/features/selection/stores/toast-store";
import type { ActiveExportView } from "@/features/selection/queries";

function reset() {
  useSelectionStudioToasts.setState({ toasts: [] });
}

beforeEach(() => reset());
afterEach(() => reset());

describe("useExportCompletionToast — initial render", () => {
  it("null → push edilmez", () => {
    renderHook(() => useExportCompletionToast(null));
    expect(useSelectionStudioToasts.getState().toasts).toHaveLength(0);
  });

  it("ilk render queued → push edilmez (transition gerekli)", () => {
    renderHook(() =>
      useExportCompletionToast({ jobId: "j1", status: "queued" }),
    );
    expect(useSelectionStudioToasts.getState().toasts).toHaveLength(0);
  });
});

describe("useExportCompletionToast — completion transitions", () => {
  it("queued → completed → success toast", () => {
    const { rerender } = renderHook(
      ({ ae }: { ae: ActiveExportView }) => useExportCompletionToast(ae),
      {
        initialProps: {
          ae: { jobId: "j1", status: "queued" } as ActiveExportView,
        },
      },
    );

    rerender({
      ae: {
        jobId: "j1",
        status: "completed",
        downloadUrl: "https://x/y.zip",
      } as ActiveExportView,
    });

    const toasts = useSelectionStudioToasts.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.tone).toBe("success");
    expect(toasts[0]!.message).toMatch(/export hazır/i);
    expect(toasts[0]!.source).toBe("export");
  });

  it("running → failed (with failedReason) → error toast", () => {
    const { rerender } = renderHook(
      ({ ae }: { ae: ActiveExportView }) => useExportCompletionToast(ae),
      {
        initialProps: {
          ae: { jobId: "j1", status: "running" } as ActiveExportView,
        },
      },
    );
    rerender({
      ae: {
        jobId: "j1",
        status: "failed",
        failedReason: "S3 upload timed out",
      } as ActiveExportView,
    });

    const toasts = useSelectionStudioToasts.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.tone).toBe("error");
    expect(toasts[0]!.message).toContain("S3 upload timed out");
    expect(toasts[0]!.source).toBe("export");
  });

  it("running → failed (no reason) → error toast (default reason)", () => {
    const { rerender } = renderHook(
      ({ ae }: { ae: ActiveExportView }) => useExportCompletionToast(ae),
      {
        initialProps: {
          ae: { jobId: "j1", status: "running" } as ActiveExportView,
        },
      },
    );
    rerender({
      ae: { jobId: "j1", status: "failed" } as ActiveExportView,
    });
    const toasts = useSelectionStudioToasts.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.tone).toBe("error");
    expect(toasts[0]!.message).toMatch(/bilinmeyen hata/i);
  });
});

describe("useExportCompletionToast — no transition", () => {
  it("queued → running → push edilmez (hâlâ processing)", () => {
    const { rerender } = renderHook(
      ({ ae }: { ae: ActiveExportView }) => useExportCompletionToast(ae),
      {
        initialProps: {
          ae: { jobId: "j1", status: "queued" } as ActiveExportView,
        },
      },
    );
    rerender({
      ae: { jobId: "j1", status: "running" } as ActiveExportView,
    });
    expect(useSelectionStudioToasts.getState().toasts).toHaveLength(0);
  });

  it("null → null → push edilmez", () => {
    const { rerender } = renderHook(
      ({ ae }: { ae: ActiveExportView }) => useExportCompletionToast(ae),
      { initialProps: { ae: null as ActiveExportView } },
    );
    rerender({ ae: null as ActiveExportView });
    expect(useSelectionStudioToasts.getState().toasts).toHaveLength(0);
  });
});
