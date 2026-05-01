// Phase 7 Task 39 — useHeavyEditCompletionToast testleri.
//
// Sözleşme (plan Task 39):
//   - Initial render (processing false) → push edilmez.
//   - Transition processing → idle, history success → success toast push.
//   - Transition processing → idle, history failed (last entry failed:true)
//     → error toast push (mesajda failed reason yer alır).
//   - Hâlâ processing iken (transition yok) → push edilmez.
//   - Item null → push edilmez (state korunur).
//
// Pattern: renderHook + rerender ile prop değişimi.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHeavyEditCompletionToast } from "@/features/selection/hooks/useHeavyEditCompletionToast";
import { useSelectionStudioToasts } from "@/features/selection/stores/toast-store";
import type { SelectionItemView } from "@/features/selection/queries";

function reset() {
  useSelectionStudioToasts.setState({ toasts: [] });
}

function makeItem(overrides: Partial<SelectionItemView> = {}): SelectionItemView {
  return {
    id: "i1",
    selectionSetId: "set-1",
    generatedDesignId: "gd1",
    sourceAssetId: "src-1",
    editedAssetId: null,
    lastUndoableAssetId: null,
    editHistoryJson: [],
    activeHeavyJobId: null,
    status: "pending",
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    review: null,
    ...overrides,
  } as unknown as SelectionItemView;
}

beforeEach(() => reset());
afterEach(() => reset());

describe("useHeavyEditCompletionToast — initial render", () => {
  it("processing false → push edilmez", () => {
    renderHook(() => useHeavyEditCompletionToast(makeItem()));
    expect(useSelectionStudioToasts.getState().toasts).toHaveLength(0);
  });

  it("ilk render processing TRUE → push edilmez (transition gerekli)", () => {
    renderHook(() =>
      useHeavyEditCompletionToast(
        makeItem({ activeHeavyJobId: "job-1" }),
      ),
    );
    expect(useSelectionStudioToasts.getState().toasts).toHaveLength(0);
  });

  it("item null → push edilmez", () => {
    renderHook(() => useHeavyEditCompletionToast(null));
    expect(useSelectionStudioToasts.getState().toasts).toHaveLength(0);
  });
});

describe("useHeavyEditCompletionToast — completion transitions", () => {
  it("processing → idle + history success entry → success toast", () => {
    const { rerender } = renderHook(
      ({ item }: { item: SelectionItemView | null }) =>
        useHeavyEditCompletionToast(item),
      {
        initialProps: {
          item: makeItem({ activeHeavyJobId: "job-1" }),
        },
      },
    );
    expect(useSelectionStudioToasts.getState().toasts).toHaveLength(0);

    rerender({
      item: makeItem({
        activeHeavyJobId: null,
        editHistoryJson: [
          { op: "background-remove" } as unknown as never,
        ],
      }),
    });

    const toasts = useSelectionStudioToasts.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.tone).toBe("success");
    expect(toasts[0]!.message).toContain("Background remove");
    expect(toasts[0]!.source).toBe("heavy-edit");
  });

  it("processing → idle + history failed entry → error toast (reason)", () => {
    const { rerender } = renderHook(
      ({ item }: { item: SelectionItemView | null }) =>
        useHeavyEditCompletionToast(item),
      {
        initialProps: {
          item: makeItem({ activeHeavyJobId: "job-1" }),
        },
      },
    );

    rerender({
      item: makeItem({
        activeHeavyJobId: null,
        editHistoryJson: [
          {
            op: "background-remove",
            failed: true,
            reason: "Provider timeout",
          } as unknown as never,
        ],
      }),
    });

    const toasts = useSelectionStudioToasts.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.tone).toBe("error");
    expect(toasts[0]!.message).toContain("Provider timeout");
    expect(toasts[0]!.source).toBe("heavy-edit");
  });

  it("processing → idle + history failed (no reason) → error toast (default reason)", () => {
    const { rerender } = renderHook(
      ({ item }: { item: SelectionItemView | null }) =>
        useHeavyEditCompletionToast(item),
      {
        initialProps: {
          item: makeItem({ activeHeavyJobId: "job-1" }),
        },
      },
    );
    rerender({
      item: makeItem({
        activeHeavyJobId: null,
        editHistoryJson: [
          { op: "background-remove", failed: true } as unknown as never,
        ],
      }),
    });
    const toasts = useSelectionStudioToasts.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.tone).toBe("error");
    expect(toasts[0]!.message).toMatch(/bilinmeyen hata/i);
  });
});

describe("useHeavyEditCompletionToast — no transition", () => {
  it("processing→processing → push edilmez", () => {
    const { rerender } = renderHook(
      ({ item }: { item: SelectionItemView | null }) =>
        useHeavyEditCompletionToast(item),
      {
        initialProps: {
          item: makeItem({ activeHeavyJobId: "job-1" }),
        },
      },
    );
    rerender({
      item: makeItem({ activeHeavyJobId: "job-2" }),
    });
    expect(useSelectionStudioToasts.getState().toasts).toHaveLength(0);
  });

  it("idle → idle → push edilmez", () => {
    const { rerender } = renderHook(
      ({ item }: { item: SelectionItemView | null }) =>
        useHeavyEditCompletionToast(item),
      { initialProps: { item: makeItem() } },
    );
    rerender({ item: makeItem({ position: 2 }) });
    expect(useSelectionStudioToasts.getState().toasts).toHaveLength(0);
  });
});
