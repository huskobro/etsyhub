// Phase 7 Task 35 — FinalizeModal TDD test sözleşmesi.
//
// Spec Section 2.5 (finalize akışı) + plan Task 35.
//
// Sözleşme:
//   - open=false → modal DOM'da yok.
//   - open=true → başlık "Set'i finalize et" + breakdown grid (selected /
//     pending / rejected) + 3 sayı + dürüst handoff açıklaması + İptal +
//     "Finalize et" butonları.
//   - Gate fail (selectedCount === 0) → uyarı mesajı görünür ("En az 1
//     'Seçime ekle' yapılmış varyant gerekli") + Finalize buton disabled.
//   - Gate ok (selectedCount >= 1) → uyarı yok + Finalize buton enabled.
//   - Breakdown sayıları items array'inden doğru hesaplanır (status'a göre).
//   - Submit success → POST /api/selection/sets/{setId}/finalize +
//     invalidate selectionSetQueryKey + onOpenChange(false).
//   - Submit pending → İptal + Finalize buton disabled (label "Finalize
//     ediliyor...").
//   - Submit 409 (FinalizeGateError) → inline alert görünür, modal açık
//     kalır.
//   - İptal click → onOpenChange(false), pending değilse.
//   - Modal reopens (open false → true) → errorMessage clear (useEffect).
//
// Phase 6 emsali: tests/unit/bulk-delete-dialog.test.tsx + Phase 7 Task 24
// create-set-modal.test.tsx (Radix Portal + matchMedia mock).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { FinalizeModal } from "@/features/selection/components/FinalizeModal";
import { selectionSetQueryKey } from "@/features/selection/queries";
import type { SelectionItemView } from "@/features/selection/queries";

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
  vi.stubGlobal("fetch", vi.fn());
});

function makeItem(
  id: string,
  status: "pending" | "selected" | "rejected",
  position: number,
): SelectionItemView {
  return {
    id,
    selectionSetId: "set-1",
    generatedDesignId: `gd-${id}`,
    sourceAssetId: `a-${id}`,
    editedAssetId: null,
    lastUndoableAssetId: null,
    editHistoryJson: [],
    status,
    position,
    createdAt: new Date(),
    updatedAt: new Date(),
    review: null,
  } as unknown as SelectionItemView;
}

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

describe("FinalizeModal — render gating", () => {
  it("open=false → modal DOM'da yok", () => {
    wrap(
      <FinalizeModal
        setId="set-1"
        items={[makeItem("i1", "selected", 0)]}
        open={false}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/set'i finalize et/i)).not.toBeInTheDocument();
  });

  it("open=true → başlık + breakdown grid (3 cell testid) + butonlar", () => {
    const items = [
      makeItem("i1", "selected", 0),
      makeItem("i2", "selected", 1),
      makeItem("i3", "pending", 2),
      makeItem("i4", "rejected", 3),
    ];
    wrap(
      <FinalizeModal
        setId="set-1"
        items={items}
        open
        onOpenChange={vi.fn()}
      />,
    );
    // Başlık (Dialog.Title)
    expect(
      screen.getByRole("heading", { name: /set'i finalize et/i }),
    ).toBeInTheDocument();
    // Breakdown cells (testid net ayrım — label kelimeleri açıklama
    // metninde de geçiyor, getByText ambigous olur).
    expect(
      screen.getByTestId("finalize-breakdown-selected"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("finalize-breakdown-pending"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("finalize-breakdown-rejected"),
    ).toBeInTheDocument();
    // Butonlar
    expect(screen.getByRole("button", { name: /^İptal$/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Finalize et$/i }),
    ).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// Gate UX
// ────────────────────────────────────────────────────────────

describe("FinalizeModal — gate fail (0 selected)", () => {
  it("uyarı mesajı görünür + Finalize buton disabled", () => {
    const items = [
      makeItem("i1", "pending", 0),
      makeItem("i2", "rejected", 1),
    ];
    wrap(
      <FinalizeModal
        setId="set-1"
        items={items}
        open
        onOpenChange={vi.fn()}
      />,
    );
    // Uyarı text — role="status" ile aranır (alert değil — gate fail
    // kullanıcı eylemi sonucu bir hata değil; ön koşul mesajı).
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByText(/en az 1.*seçime ekle.*varyant gerekli/i),
    ).toBeInTheDocument();
    // Finalize buton disabled
    expect(
      screen.getByRole("button", { name: /^Finalize et$/i }),
    ).toBeDisabled();
  });

  it("items boş → Finalize disabled + uyarı görünür", () => {
    wrap(
      <FinalizeModal setId="set-1" items={[]} open onOpenChange={vi.fn()} />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Finalize et$/i }),
    ).toBeDisabled();
  });
});

describe("FinalizeModal — gate ok (1+ selected)", () => {
  it("uyarı yok + Finalize buton enabled", () => {
    const items = [
      makeItem("i1", "selected", 0),
      makeItem("i2", "pending", 1),
    ];
    wrap(
      <FinalizeModal
        setId="set-1"
        items={items}
        open
        onOpenChange={vi.fn()}
      />,
    );
    // Uyarı yok (gate fail role=status mesajı yok)
    expect(
      screen.queryByText(/en az 1.*seçime ekle.*varyant gerekli/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Finalize et$/i }),
    ).not.toBeDisabled();
  });
});

// ────────────────────────────────────────────────────────────
// Breakdown sayıları
// ────────────────────────────────────────────────────────────

describe("FinalizeModal — breakdown sayıları", () => {
  it("items array'inden doğru hesaplanır (3 selected / 2 pending / 1 rejected)", () => {
    const items = [
      makeItem("i1", "selected", 0),
      makeItem("i2", "selected", 1),
      makeItem("i3", "selected", 2),
      makeItem("i4", "pending", 3),
      makeItem("i5", "pending", 4),
      makeItem("i6", "rejected", 5),
    ];
    wrap(
      <FinalizeModal
        setId="set-1"
        items={items}
        open
        onOpenChange={vi.fn()}
      />,
    );
    // testid bazlı kontrol — açıklama metniyle çakışma yok.
    expect(
      screen.getByTestId("finalize-breakdown-selected").textContent,
    ).toContain("3");
    expect(
      screen.getByTestId("finalize-breakdown-pending").textContent,
    ).toContain("2");
    expect(
      screen.getByTestId("finalize-breakdown-rejected").textContent,
    ).toContain("1");
  });
});

// ────────────────────────────────────────────────────────────
// Submit success
// ────────────────────────────────────────────────────────────

describe("FinalizeModal — submit success", () => {
  it("Finalize click → POST /finalize + invalidate + onOpenChange(false)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          set: { id: "set-A", status: "ready", finalizedAt: new Date() },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const onOpenChange = vi.fn();
    const items = [makeItem("i1", "selected", 0)];
    const { queryClient } = wrap(
      <FinalizeModal
        setId="set-A"
        items={items}
        open
        onOpenChange={onOpenChange}
      />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    fireEvent.click(screen.getByRole("button", { name: /^Finalize et$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/selection/sets/set-A/finalize");
    expect((init as RequestInit).method).toBe("POST");

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: selectionSetQueryKey("set-A"),
      });
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

// ────────────────────────────────────────────────────────────
// Submit pending
// ────────────────────────────────────────────────────────────

describe("FinalizeModal — pending state", () => {
  it("submit pending → tüm interactive butonlar disabled + label değişir", async () => {
    let resolveFn: ((v: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveFn = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    wrap(
      <FinalizeModal
        setId="set-1"
        items={[makeItem("i1", "selected", 0)]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Finalize et$/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /finalize ediliyor/i }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: /^İptal$/ })).toBeDisabled();
    });

    // Cleanup
    resolveFn?.(
      new Response(
        JSON.stringify({ set: { id: "set-1", status: "ready" } }),
        { status: 200 },
      ),
    );
  });
});

// ────────────────────────────────────────────────────────────
// Submit error (409 FinalizeGateError)
// ────────────────────────────────────────────────────────────

describe("FinalizeModal — submit error", () => {
  it("409 FinalizeGateError → inline alert + modal açık kalır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Set finalize edilemiyor: en az 1 'selected' varyant gerekli",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const onOpenChange = vi.fn();
    wrap(
      <FinalizeModal
        setId="set-1"
        items={[makeItem("i1", "selected", 0)]}
        open
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Finalize et$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "en az 1",
    );
    // Modal açık kalır (onOpenChange(false) çağrılmamış)
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("network error / 500 → generic mesaj inline alert", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrap(
      <FinalizeModal
        setId="set-1"
        items={[makeItem("i1", "selected", 0)]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Finalize et$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
// İptal button
// ────────────────────────────────────────────────────────────

describe("FinalizeModal — İptal button", () => {
  it("İptal click → onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    wrap(
      <FinalizeModal
        setId="set-1"
        items={[makeItem("i1", "selected", 0)]}
        open
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^İptal$/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ────────────────────────────────────────────────────────────
// Modal reopens → errorMessage clear
// ────────────────────────────────────────────────────────────

describe("FinalizeModal — modal reopens", () => {
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
    const items = [makeItem("i1", "selected", 0)];

    const { rerender } = render(
      <QueryClientProvider client={client}>
        <FinalizeModal
          setId="set-1"
          items={items}
          open
          onOpenChange={onOpenChange}
        />
      </QueryClientProvider>,
    );

    // Hata oluştur
    fireEvent.click(screen.getByRole("button", { name: /^Finalize et$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Modal kapat
    rerender(
      <QueryClientProvider client={client}>
        <FinalizeModal
          setId="set-1"
          items={items}
          open={false}
          onOpenChange={onOpenChange}
        />
      </QueryClientProvider>,
    );

    // Modal yeniden aç
    rerender(
      <QueryClientProvider client={client}>
        <FinalizeModal
          setId="set-1"
          items={items}
          open
          onOpenChange={onOpenChange}
        />
      </QueryClientProvider>,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
