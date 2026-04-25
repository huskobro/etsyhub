/**
 * add-competitor-dialog.test.tsx
 *
 * T-40 spec doğrulaması · AddCompetitorDialog a11y davranışları.
 *
 * Sözleşme: docs/design/implementation-notes/cp9-stabilization-wave.md (T-40)
 *
 * Eklenen davranışlar:
 * - Escape → onClose
 * - Initial focus → ilk input (mağaza adı/URL)
 * - Tab boundary → modal dışına kaçamaz
 * - Backdrop click → onClose
 * - Dialog içi click → onClose çağrılmaz
 *
 * Mevcut form mantığı (mutation, onSuccess/onError) DOKUNULMAZ.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import {
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/features/competitors/mutations/use-create-competitor", () => ({
  useCreateCompetitor: vi.fn(),
}));

import { AddCompetitorDialog } from "@/features/competitors/components/add-competitor-dialog";
import { useCreateCompetitor } from "@/features/competitors/mutations/use-create-competitor";

const mockedUseCreate = vi.mocked(useCreateCompetitor);

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function setMutationMock(overrides: { mutate?: ReturnType<typeof vi.fn> } = {}) {
  const mutate = overrides.mutate ?? vi.fn();
  mockedUseCreate.mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useCreateCompetitor>);
  return { mutate };
}

beforeEach(() => {
  vi.clearAllMocks();
  setMutationMock();
});

describe("AddCompetitorDialog — a11y modal yapısı (KORUNDU)", () => {
  it("role=dialog + aria-modal=true + aria-labelledby render eder", () => {
    wrapper(<AddCompetitorDialog onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "add-competitor-title");
  });
});

describe("AddCompetitorDialog — T-40 a11y davranışları", () => {
  it("Escape tuşu basıldığında onClose çağrılır", () => {
    const onClose = vi.fn();
    wrapper(<AddCompetitorDialog onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dialog açıldığında initial focus ilk input (Mağaza adı veya URL) olur", () => {
    wrapper(<AddCompetitorDialog onClose={vi.fn()} />);
    const input = screen.getByLabelText(/Mağaza adı veya URL/i);
    expect(document.activeElement).toBe(input);
  });

  it("backdrop (overlay) tıklamasında onClose çağrılır; dialog içi tıklamada çağrılmaz", () => {
    const onClose = vi.fn();
    wrapper(<AddCompetitorDialog onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    // Dialog içi tıklama → onClose ÇAĞRILMAZ
    const heading = within(dialog).getByText("Rakip Mağaza Ekle");
    fireEvent.click(heading);
    expect(onClose).not.toHaveBeenCalled();

    // Backdrop (overlay = dialog'un kendisi) tıklama → onClose çağrılır
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Tab boundary — son focusable element'te Tab basınca ilk focusable'a wrap eder", () => {
    wrapper(<AddCompetitorDialog onClose={vi.fn()} />);
    const closeBtn = screen.getByRole("button", { name: /^Kapat$/i });
    // Submit butonu shopIdentifier 2 karakterden az olduğu için disabled —
    // disabled element focusable listesinden filtrelenir. Son focusable ise
    // "Vazgeç" butonudur.
    const cancelBtn = screen.getByRole("button", { name: /^Vazgeç$/i });
    cancelBtn.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeBtn);
  });

  it("Tab boundary — ilk focusable element'te Shift+Tab son focusable'a wrap eder", () => {
    wrapper(<AddCompetitorDialog onClose={vi.fn()} />);
    const closeBtn = screen.getByRole("button", { name: /^Kapat$/i });
    const cancelBtn = screen.getByRole("button", { name: /^Vazgeç$/i });
    closeBtn.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cancelBtn);
  });
});

describe("AddCompetitorDialog — mevcut form mantığı (DOKUNULMAZ)", () => {
  it("input doldurulup submit basıldığında mutation tetiklenir", () => {
    const { mutate } = setMutationMock();
    wrapper(<AddCompetitorDialog onClose={vi.fn()} />);
    const input = screen.getByLabelText(/Mağaza adı veya URL/i);
    fireEvent.change(input, { target: { value: "TestShop" } });
    fireEvent.click(screen.getByRole("button", { name: /Rakibi Ekle/i }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]?.[0]).toEqual({
      shopIdentifier: "TestShop",
      platform: "ETSY",
      autoScanEnabled: false,
    });
  });
});
