// Phase 7 Task 34 — BulkHardDeleteDialog TDD test sözleşmesi.
//
// Spec Section 2.2 (TypingConfirmation server-side enforcement) + Section 7.2
// (POST /items/bulk-delete endpoint) + plan Task 34.
//
// Sözleşme:
//   - open=false → modal DOM'da yok.
//   - open=true → başlık "Kalıcı çıkar" + N varyant açıklaması +
//     TypingConfirmation primitive (phrase="SİL") + İptal butonu.
//   - Confirm disabled — yanlış input ("sil", "SIL" ASCII, " SİL " whitespace,
//     boş) için confirm butonu disabled.
//   - Confirm enabled — exact "SİL" (Türkçe büyük İ) → buton enabled.
//   - Submit success → POST /api/selection/sets/{setId}/items/bulk-delete
//     body { itemIds, confirmation: "SİL" } → invalidateQueries +
//     clearMultiSelect + onOpenChange(false).
//   - Submit pending → tüm interactive elements disabled (confirm, input,
//     İptal).
//   - Submit 400 (invalid sentinel — server-side reject) → inline alert
//     görünür, modal açık kalır.
//   - Submit 409 (ready set state guard) → inline alert.
//   - İptal click → onOpenChange(false), mutation pending değilse.
//   - Mutation pending iken İptal butonu disabled.
//   - Modal reopens (open false → true) → errorMessage clear (useEffect).
//
// Phase 6 emsali: tests/unit/bulk-delete-dialog.test.tsx + Phase 7 Task 24
// create-set-modal.test.tsx (Radix Portal + matchMedia mock).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { BulkHardDeleteDialog } from "@/features/selection/components/BulkHardDeleteDialog";
import { useStudioStore } from "@/features/selection/stores/studio-store";
import { selectionSetQueryKey } from "@/features/selection/queries";

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
  // Store reset — testler arası izolasyon (clearMultiSelect doğrulamak için)
  useStudioStore.setState({
    activeItemId: null,
    multiSelectIds: new Set<string>(),
    filter: "all",
    currentSetId: null,
  });
  vi.stubGlobal("fetch", vi.fn());
});

function wrap(ui: ReactElement, client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    ),
  };
}

// ────────────────────────────────────────────────────────────
// Render gating
// ────────────────────────────────────────────────────────────

describe("BulkHardDeleteDialog — render gating", () => {
  it("open=false → modal DOM'da yok", () => {
    wrap(
      <BulkHardDeleteDialog
        setId="set-1"
        itemIds={["i1", "i2"]}
        open={false}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/kalıcı çıkar/i)).not.toBeInTheDocument();
  });

  it("open=true → başlık 'Kalıcı çıkar' + N varyant açıklaması + TypingConfirmation input + İptal", () => {
    wrap(
      <BulkHardDeleteDialog
        setId="set-1"
        itemIds={["i1", "i2", "i3"]}
        open
        onOpenChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /kalıcı çıkar/i }),
    ).toBeInTheDocument();
    // count açıklaması "3 reddedilen varyant"
    expect(screen.getByText(/3 reddedilen varyant/i)).toBeInTheDocument();
    expect(screen.getByTestId("typing-confirmation-input")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^İptal$/ }),
    ).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// Confirm disabled (yanlış input)
// ────────────────────────────────────────────────────────────

describe("BulkHardDeleteDialog — confirm disabled (yanlış input)", () => {
  it("input boş → confirm disabled", () => {
    wrap(
      <BulkHardDeleteDialog
        setId="set-1"
        itemIds={["i1"]}
        open
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("typing-confirmation-confirm")).toBeDisabled();
  });

  it("input 'sil' (küçük) → confirm disabled", () => {
    wrap(
      <BulkHardDeleteDialog
        setId="set-1"
        itemIds={["i1"]}
        open
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("typing-confirmation-input"), {
      target: { value: "sil" },
    });
    expect(screen.getByTestId("typing-confirmation-confirm")).toBeDisabled();
  });

  it("input 'SIL' (ASCII, büyük I) → confirm disabled", () => {
    wrap(
      <BulkHardDeleteDialog
        setId="set-1"
        itemIds={["i1"]}
        open
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("typing-confirmation-input"), {
      target: { value: "SIL" },
    });
    expect(screen.getByTestId("typing-confirmation-confirm")).toBeDisabled();
  });

  it("input ' SİL ' (whitespace) → confirm disabled (trim YOK)", () => {
    wrap(
      <BulkHardDeleteDialog
        setId="set-1"
        itemIds={["i1"]}
        open
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("typing-confirmation-input"), {
      target: { value: " SİL " },
    });
    expect(screen.getByTestId("typing-confirmation-confirm")).toBeDisabled();
  });
});

// ────────────────────────────────────────────────────────────
// Confirm enabled (exact "SİL")
// ────────────────────────────────────────────────────────────

describe("BulkHardDeleteDialog — confirm enabled", () => {
  it("input exact 'SİL' (Türkçe büyük İ) → confirm enabled", () => {
    wrap(
      <BulkHardDeleteDialog
        setId="set-1"
        itemIds={["i1"]}
        open
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("typing-confirmation-input"), {
      target: { value: "SİL" },
    });
    expect(screen.getByTestId("typing-confirmation-confirm")).not.toBeDisabled();
  });
});

// ────────────────────────────────────────────────────────────
// Submit success → fetch + invalidate + clearMultiSelect + close
// ────────────────────────────────────────────────────────────

describe("BulkHardDeleteDialog — submit success", () => {
  it("confirm click → POST /items/bulk-delete + invalidate + clearMultiSelect + onOpenChange(false)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ deletedCount: 2 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Multi-select state'i dolu — clearMultiSelect doğrulanır
    useStudioStore.setState({
      multiSelectIds: new Set(["i1", "i2"]),
      filter: "rejected",
    });

    const onOpenChange = vi.fn();
    const { queryClient } = wrap(
      <BulkHardDeleteDialog
        setId="set-A"
        itemIds={["i1", "i2"]}
        open
        onOpenChange={onOpenChange}
      />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    fireEvent.change(screen.getByTestId("typing-confirmation-input"), {
      target: { value: "SİL" },
    });
    fireEvent.click(screen.getByTestId("typing-confirmation-confirm"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/selection/sets/set-A/items/bulk-delete");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ itemIds: ["i1", "i2"], confirmation: "SİL" });

    // invalidateQueries (set detail key)
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: selectionSetQueryKey("set-A"),
      });
    });
    // clearMultiSelect
    await waitFor(() => {
      expect(useStudioStore.getState().multiSelectIds.size).toBe(0);
    });
    // onOpenChange(false)
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

// ────────────────────────────────────────────────────────────
// Submit pending → all interactive elements disabled
// ────────────────────────────────────────────────────────────

describe("BulkHardDeleteDialog — pending state", () => {
  it("submit pending → confirm + İptal disabled", async () => {
    let resolveFn: ((v: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveFn = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    wrap(
      <BulkHardDeleteDialog
        setId="set-1"
        itemIds={["i1"]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("typing-confirmation-input"), {
      target: { value: "SİL" },
    });
    fireEvent.click(screen.getByTestId("typing-confirmation-confirm"));

    await waitFor(() => {
      expect(screen.getByTestId("typing-confirmation-confirm")).toBeDisabled();
      expect(screen.getByRole("button", { name: /^İptal$/ })).toBeDisabled();
    });

    // Cleanup
    resolveFn?.(
      new Response(JSON.stringify({ deletedCount: 1 }), { status: 200 }),
    );
  });
});

// ────────────────────────────────────────────────────────────
// Submit error states (400 + 409)
// ────────────────────────────────────────────────────────────

describe("BulkHardDeleteDialog — submit error", () => {
  it("400 (invalid sentinel) → inline alert + modal açık kalır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: "confirmation: gerekli sentinel 'SİL' eksik" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const onOpenChange = vi.fn();
    wrap(
      <BulkHardDeleteDialog
        setId="set-1"
        itemIds={["i1"]}
        open
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.change(screen.getByTestId("typing-confirmation-input"), {
      target: { value: "SİL" },
    });
    fireEvent.click(screen.getByTestId("typing-confirmation-confirm"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert").textContent).toContain("sentinel");
    // Modal açık kalır (onOpenChange(false) çağrılmamış)
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("409 (ready set state guard) → inline alert", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: "Set finalize edildi, mutation reddedildi" }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrap(
      <BulkHardDeleteDialog
        setId="set-1"
        itemIds={["i1"]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("typing-confirmation-input"), {
      target: { value: "SİL" },
    });
    fireEvent.click(screen.getByTestId("typing-confirmation-confirm"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "Set finalize edildi",
    );
  });
});

// ────────────────────────────────────────────────────────────
// İptal button
// ────────────────────────────────────────────────────────────

describe("BulkHardDeleteDialog — İptal button", () => {
  it("İptal click → onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    wrap(
      <BulkHardDeleteDialog
        setId="set-1"
        itemIds={["i1"]}
        open
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^İptal$/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("mutation pending iken İptal disabled", async () => {
    let resolveFn: ((v: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveFn = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    wrap(
      <BulkHardDeleteDialog
        setId="set-1"
        itemIds={["i1"]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("typing-confirmation-input"), {
      target: { value: "SİL" },
    });
    fireEvent.click(screen.getByTestId("typing-confirmation-confirm"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^İptal$/ })).toBeDisabled();
    });

    resolveFn?.(
      new Response(JSON.stringify({ deletedCount: 1 }), { status: 200 }),
    );
  });
});

// ────────────────────────────────────────────────────────────
// Modal reopens → errorMessage clear (useEffect cleanup)
// ────────────────────────────────────────────────────────────

describe("BulkHardDeleteDialog — modal reopens", () => {
  it("open false → true → errorMessage temizlenir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "geçici hata" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <QueryClientProvider client={client}>
        <BulkHardDeleteDialog
          setId="set-1"
          itemIds={["i1"]}
          open
          onOpenChange={onOpenChange}
        />
      </QueryClientProvider>,
    );

    // Hata oluştur
    fireEvent.change(screen.getByTestId("typing-confirmation-input"), {
      target: { value: "SİL" },
    });
    fireEvent.click(screen.getByTestId("typing-confirmation-confirm"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Modal kapat
    rerender(
      <QueryClientProvider client={client}>
        <BulkHardDeleteDialog
          setId="set-1"
          itemIds={["i1"]}
          open={false}
          onOpenChange={onOpenChange}
        />
      </QueryClientProvider>,
    );

    // Modal yeniden aç
    rerender(
      <QueryClientProvider client={client}>
        <BulkHardDeleteDialog
          setId="set-1"
          itemIds={["i1"]}
          open
          onOpenChange={onOpenChange}
        />
      </QueryClientProvider>,
    );

    // Açıldığında alert sıfırlanmış olmalı
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
