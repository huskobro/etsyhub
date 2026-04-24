/**
 * bookmarks-confirm-flow.test.tsx
 *
 * Bookmark arşivleme işleminin ConfirmDialog üzerinden geçtiğini doğrular.
 * Senaryo:
 *   1. Arşivle butonuna tıkla → mutate ÇAĞRILMAMALI, dialog açılmalı
 *   2. Dialog'da "Arşivle" butonuna tıkla → mutate ÇAĞRILMALI
 *   3. Dialog'da "Vazgeç" butonuna tıkla → mutate ÇAĞRILMAMALI
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { useState, useCallback } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { confirmPresets } from "@/components/ui/confirm-presets";
import type { ConfirmPresetValue } from "@/components/ui/confirm-presets";

// --- matchMedia mock (Radix Portal / dialog için gerekli) ---
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

type ConfirmState = {
  open: boolean;
  preset: ConfirmPresetValue | null;
  onConfirm: (() => void | Promise<void>) | null;
};

/**
 * Test fixture: Bookmark kartı rolünü oynayan minimal component.
 * Gerçek BookmarksPage'deki useConfirm pattern'ini birebir taklit eder.
 */
function BookmarkArchiveFixture({
  onMutate,
  bookmarkTitle = "Test Bookmark",
}: {
  onMutate: () => void;
  bookmarkTitle?: string;
}) {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    preset: null,
    onConfirm: null,
  });

  const confirm = useCallback(
    (preset: ConfirmPresetValue, cb: () => void | Promise<void>) => {
      setState({ open: true, preset, onConfirm: cb });
    },
    [],
  );

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() =>
          confirm(
            confirmPresets.archiveBookmark(bookmarkTitle || null),
            () => onMutate(),
          )
        }
        data-testid="archive-btn"
      >
        Arşivle
      </button>

      {state.preset ? (
        <ConfirmDialog
          open={state.open}
          onOpenChange={(o) => {
            if (!o) close();
          }}
          {...state.preset}
          onConfirm={async () => {
            await state.onConfirm?.();
            close();
          }}
          busy={false}
        />
      ) : null}
    </>
  );
}

describe("BookmarkArchiveFixture — confirm flow", () => {
  it("Arşivle butonuna click → dialog açılır, mutate henüz çağrılmaz", () => {
    const mutate = vi.fn();
    render(<BookmarkArchiveFixture onMutate={mutate} bookmarkTitle="Kahve Posteri" />);

    act(() => {
      fireEvent.click(screen.getByTestId("archive-btn"));
    });

    // dialog title görünmeli
    expect(screen.getByText("Bookmark'ı arşivle")).toBeInTheDocument();
    // bookmark title preset description'da görünmeli
    expect(screen.getByText(/"Kahve Posteri"/)).toBeInTheDocument();
    // mutate henüz çağrılmamış
    expect(mutate).not.toHaveBeenCalled();
  });

  it("Dialog açık iken 'Arşivle' confirm butonuna click → mutate çağrılır", async () => {
    const mutate = vi.fn();
    render(<BookmarkArchiveFixture onMutate={mutate} bookmarkTitle="Çiçek Baskı" />);

    act(() => {
      fireEvent.click(screen.getByTestId("archive-btn"));
    });

    const dialog = screen.getByRole("dialog");
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Arşivle" }));
    });

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("Dialog açık iken 'Vazgeç' butonuna click → mutate çağrılmaz", () => {
    const mutate = vi.fn();
    render(<BookmarkArchiveFixture onMutate={mutate} />);

    act(() => {
      fireEvent.click(screen.getByTestId("archive-btn"));
    });

    const dialog = screen.getByRole("dialog");
    act(() => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Vazgeç" }));
    });

    expect(mutate).not.toHaveBeenCalled();
  });

  it("bookmarkTitle boş string → fallback description render edilir", () => {
    const mutate = vi.fn();
    render(<BookmarkArchiveFixture onMutate={mutate} bookmarkTitle="" />);

    act(() => {
      fireEvent.click(screen.getByTestId("archive-btn"));
    });

    expect(screen.getByText("Bookmark'ı arşivle")).toBeInTheDocument();
    // title null/boş olduğunda fallback description
    expect(
      screen.getByText(/Bu bookmark arşivlenecek/),
    ).toBeInTheDocument();
  });
});
