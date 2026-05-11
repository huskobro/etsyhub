// Phase 6 Dalga B polish (A4) — BulkDeleteDialog UI testleri.
//
// Kontratlar:
//   - TypingConfirmation entegrasyonu — phrase "SİL" yazılana kadar
//     confirm butonu disabled (yıkıcı işlem koruması).
//   - "SİL" yazınca confirm enabled; click ⇒ POST /bulk action=delete.
//   - Vazgeç butonu onClose çağırır.
//   - UX bug fix doğrulaması: "Onaylamak için aşağıya … yazın:" cümlesi
//     SADECE BIR KEZ render olur (önceden BulkDeleteDialog message prop
//     ile aynı cümleyi tekrar gönderiyordu → çift cümle UX bug).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

import { BulkDeleteDialog } from "@/app/(app)/review/_components/BulkDeleteDialog";

function renderDialog(props: {
  ids: string[];
  onClose?: ReturnType<typeof vi.fn>;
  onSuccess?: ReturnType<typeof vi.fn>;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BulkDeleteDialog
        ids={props.ids}
        open
        onClose={props.onClose ?? vi.fn()}
        onSuccess={props.onSuccess ?? vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("BulkDeleteDialog", () => {
  it("phrase yazılmadan Sil butonu disabled", () => {
    renderDialog({ ids: ["a", "b"] });
    const confirmBtn = screen.getByTestId("typing-confirmation-confirm");
    expect(confirmBtn).toBeDisabled();
  });

  it("'DELETE' yazınca enabled; click ⇒ POST /bulk action=delete scope=local", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        requested: 2,
        deleted: 2,
        skippedNotFound: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onSuccess = vi.fn();

    renderDialog({ ids: ["a", "b"], onSuccess });
    const input = screen.getByTestId("typing-confirmation-input");
    fireEvent.change(input, { target: { value: "DELETE" } });

    const confirmBtn = screen.getByTestId("typing-confirmation-confirm");
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const call = fetchMock.mock.calls[0]!;
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toBe("/api/review/decisions/bulk");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      action: "delete",
      scope: "local",
      ids: ["a", "b"],
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(onSuccess.mock.calls[0]![0]).toMatchObject({ deleted: 2 });
  });

  it("Vazgeç butonu onClose çağırır", () => {
    const onClose = vi.fn();
    renderDialog({ ids: ["a"], onClose });
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("UX bug fix: 'Type ... below to confirm' cümlesi sadece BIR kez render olur", () => {
    renderDialog({ ids: ["a"] });
    // Regex eski (BulkDeleteDialog message prop ile geçen) cümlenin
    // tekrarını tespit eder; tek match olmalı.
    const matches = screen.getAllByText(/below to confirm/i);
    expect(matches).toHaveLength(1);
  });
});
