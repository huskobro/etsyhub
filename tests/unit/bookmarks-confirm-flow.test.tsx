/**
 * bookmarks-confirm-flow.test.tsx
 *
 * Bookmark arşivleme işleminin ConfirmDialog + useConfirm akışından geçtiğini
 * doğrular. Fixture gerçek useConfirm hook'unu kullanır — böylece hook API'si
 * değişirse test suite kırılır.
 *
 * Senaryolar:
 *   1. Arşivle butonuna tıkla → mutate ÇAĞRILMAMALI, dialog açılmalı
 *   2. Dialog'da "Arşivle" butonuna tıkla → mutate ÇAĞRILMALI
 *   3. Dialog'da "Vazgeç" butonuna tıkla → mutate ÇAĞRILMAMALI
 *   4. mutation hata fırlatırsa → dialog açık kalır, errorMessage görünür,
 *      buton label "Tekrar dene" olur
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { confirmPresets } from "@/components/ui/confirm-presets";
import { useConfirm } from "@/components/ui/use-confirm";

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

/**
 * Test fixture: Bookmark kartı rolünü oynayan minimal component.
 * Gerçek useConfirm hook'unu birebir kullanır — production pattern ile aynı.
 */
function BookmarkArchiveFixture({
  onMutate,
  bookmarkTitle = "Test Bookmark",
}: {
  onMutate: () => void | Promise<void>;
  bookmarkTitle?: string;
}) {
  const { confirm, close, run, state } = useConfirm();

  return (
    <>
      <button
        type="button"
        onClick={() =>
          confirm(confirmPresets.archiveBookmark(bookmarkTitle || null), () =>
            onMutate(),
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
          onConfirm={run}
          busy={state.busy}
          errorMessage={state.errorMessage}
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

  it("mutate hata fırlatırsa → dialog açık kalır, errorMessage + 'Tekrar dene' görünür", async () => {
    const mutate = vi.fn().mockRejectedValueOnce(new Error("Sunucu 500 verdi"));
    render(<BookmarkArchiveFixture onMutate={mutate} bookmarkTitle="Hatalı Kart" />);

    // Dialog'u aç
    act(() => {
      fireEvent.click(screen.getByTestId("archive-btn"));
    });

    let dialog = screen.getByRole("dialog");
    // Confirm — mutation throw edecek
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Arşivle" }));
    });

    // Dialog hâlâ açık olmalı
    dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Hata mesajı görünür olmalı (role="alert")
    const alert = within(dialog).getByRole("alert");
    expect(alert).toHaveTextContent("Sunucu 500 verdi");

    // Confirm butonu "Tekrar dene" etiketine dönmeli
    expect(within(dialog).getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();

    // mutate bir kez çağrılmış olmalı
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
