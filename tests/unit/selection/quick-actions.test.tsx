// Phase 7 Task 28 — QuickActions testleri.
//
// Sözleşme (plan Task 28 + spec Section 3.2 + Section 5):
//   - 4 buton sırayla render: Background remove, Upscale 2× (Yakında),
//     Crop · oran seçimi, Transparent PNG kontrolü.
//   - Upscale disabled — `disabled` attr + "Yakında" rozeti + title attr.
//   - Crop dropdown — tıklayınca 4 ratio listesi açılır (2:3 / 4:5 / 1:1 / 3:4).
//   - Crop ratio seçimi → POST /edit { op: "crop", params: { ratio } }.
//   - Transparent check → POST /edit { op: "transparent-check" }.
//   - Mutation pending → tıklanan buton loading spinner; diğer instant butonlar
//     disabled.
//   - Mutation success → invalidateQueries; transparent-check response'tan
//     summary okunup inline result render edilir (5 saniye).
//   - Mutation error → inline error mesaj 5 saniye gösterilir.
//   - Read-only set → instant butonlar disabled (Upscale zaten disabled).
//   - Background remove placeholder → onClick mevcut ama Task 29'a hazır
//     (no-op davranışı; test'te yalnız buton render kontrolü).
//
// Phase 6 emsali: tests/unit/selection/right-panel.test.tsx —
// QueryClientProvider wrapper + fetch mock; userEvent yerine fireEvent.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { SelectionItemView } from "@/features/selection/queries";

import { QuickActions } from "@/features/selection/components/QuickActions";

// Task 29 — HeavyActionButton ayrı test'te (heavy-action-button.test.tsx).
// QuickActions test izolasyonu: HeavyActionButton'u mock'la, yalnız
// "Background remove" label + isReadOnly disable kontratı (placeholder
// davranışı) doğrula. QuickActions kendi instant edit mutation'ını
// test eder; heavy mutation kapsam dışı.
vi.mock("@/features/selection/components/HeavyActionButton", () => ({
  HeavyActionButton: ({ isReadOnly }: { isReadOnly: boolean }) => (
    <button
      type="button"
      disabled={isReadOnly}
      aria-label="Background remove"
    >
      Background remove
    </button>
  ),
}));

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
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
    status: "pending",
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    review: null,
    ...overrides,
  } as unknown as SelectionItemView;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("QuickActions — render", () => {
  it("4 buton sırayla render edilir (Background remove, Upscale 2×, Crop, Transparent)", () => {
    wrapper(
      <QuickActions
        setId="set-1"
        item={makeItem()}
        setStatus="draft"
      />,
    );
    // Section başlığı
    expect(screen.getByText(/^hızlı işlem$/i)).toBeInTheDocument();
    // 4 buton (background remove + upscale + crop + transparent)
    expect(screen.getByRole("button", { name: /background remove/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upscale 2/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^crop · oran seçimi$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /transparent png kontrolü/i }),
    ).toBeInTheDocument();
  });
});

describe("QuickActions — Upscale disabled", () => {
  it("Upscale 2× butonu disabled + 'Yakında' rozeti + title attr", () => {
    wrapper(
      <QuickActions
        setId="set-1"
        item={makeItem()}
        setStatus="draft"
      />,
    );
    const btn = screen.getByRole("button", { name: /upscale 2/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", expect.stringMatching(/yakında/i));
    // Yakında rozeti aynı buton içinde
    expect(btn.textContent ?? "").toMatch(/yakında/i);
  });
});

describe("QuickActions — Crop dropdown", () => {
  it("Crop tıklayınca 4 ratio listesi görünür", () => {
    wrapper(
      <QuickActions
        setId="set-1"
        item={makeItem()}
        setStatus="draft"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^crop · oran seçimi$/i }));
    expect(screen.getByRole("menuitem", { name: /2:3 portrait/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /4:5 portrait/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /1:1 square/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /3:4 landscape/i })).toBeInTheDocument();
  });

  it("Ratio seçimi → POST /edit { op: 'crop', params: { ratio: '4:5' } }", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          item: { ...makeItem(), editHistoryJson: [{ op: "crop", at: "x", params: { ratio: "4:5" } }] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <QuickActions
        setId="set-1"
        item={makeItem({ id: "item-x" })}
        setStatus="draft"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^crop · oran seçimi$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /4:5 portrait/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/selection/sets/set-1/items/item-x/edit");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      op: "crop",
      params: { ratio: "4:5" },
    });
  });
});

describe("QuickActions — Transparent check", () => {
  it("Transparent tıklayınca → POST /edit { op: 'transparent-check' }", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          item: {
            ...makeItem(),
            editHistoryJson: [
              {
                op: "transparent-check",
                at: "x",
                result: {
                  ok: true,
                  signals: {
                    hasAlphaChannel: true,
                    alphaCoveragePercent: 12,
                    edgeContaminationPercent: 0.2,
                  },
                  summary: "Temiz transparent PNG",
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <QuickActions
        setId="set-1"
        item={makeItem({ id: "item-y" })}
        setStatus="draft"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /transparent png kontrolü/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/selection/sets/set-1/items/item-y/edit");
    expect(JSON.parse(init.body as string)).toEqual({ op: "transparent-check" });
  });

  it("Success sonrası inline result görünür (response.item.editHistoryJson son entry summary)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          item: {
            ...makeItem(),
            editHistoryJson: [
              {
                op: "transparent-check",
                at: "x",
                result: {
                  ok: true,
                  signals: {
                    hasAlphaChannel: true,
                    alphaCoveragePercent: 12,
                    edgeContaminationPercent: 0.2,
                  },
                  summary: "Temiz transparent PNG",
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <QuickActions setId="set-1" item={makeItem()} setStatus="draft" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /transparent png kontrolü/i }));

    await waitFor(() => {
      expect(screen.getByText(/temiz transparent png/i)).toBeInTheDocument();
    });
  });

  it("Inline result 5 saniye sonra kaybolur (timeout cleanup)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          item: {
            ...makeItem(),
            editHistoryJson: [
              {
                op: "transparent-check",
                at: "x",
                result: {
                  ok: true,
                  signals: {
                    hasAlphaChannel: true,
                    alphaCoveragePercent: 12,
                    edgeContaminationPercent: 0.2,
                  },
                  summary: "Temiz transparent PNG",
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <QuickActions setId="set-1" item={makeItem()} setStatus="draft" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /transparent png kontrolü/i }));

    // Result görünür hale geldi mi?
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
    expect(screen.getByRole("status").textContent).toContain(
      "Temiz transparent PNG",
    );

    // 5 saniye fade — real timer (5.5sn timeout). React Query async flow
    // tamamlandı; useEffect setTimeout cleanup gerçekten 5sn'de çalışıyor mu
    // doğrulaması (cleanup leak'siz olduğunu garanti eder).
    await waitFor(
      () => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      },
      { timeout: 5500 },
    );
  }, 10000);
});

describe("QuickActions — pending state", () => {
  it("mutation pending → tıklanan buton disabled, diğer instant butonlar disabled", async () => {
    let resolveFn: ((v: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveFn = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <QuickActions setId="set-1" item={makeItem()} setStatus="draft" />,
    );
    const transparentBtn = screen.getByRole("button", {
      name: /transparent png kontrolü/i,
    });
    fireEvent.click(transparentBtn);

    await waitFor(() => {
      expect(transparentBtn).toBeDisabled();
      // Crop & background remove de disabled olmalı (single mutation in-flight)
      expect(
        screen.getByRole("button", { name: /^crop · oran seçimi$/i }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /background remove/i }),
      ).toBeDisabled();
    });

    // Cleanup — pending promise resolve
    resolveFn?.(
      new Response(
        JSON.stringify({
          item: {
            ...makeItem(),
            editHistoryJson: [
              {
                op: "transparent-check",
                at: "x",
                result: {
                  ok: true,
                  signals: {
                    hasAlphaChannel: true,
                    alphaCoveragePercent: 0,
                    edgeContaminationPercent: 0,
                  },
                  summary: "Temiz transparent PNG",
                },
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
  });
});

describe("QuickActions — error state", () => {
  it("mutation fail → inline error mesaj görünür", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "İşlem başarısız" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <QuickActions setId="set-1" item={makeItem()} setStatus="draft" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /transparent png kontrolü/i }));

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    // Türkçe `İ` (U+0130) JavaScript regex `/i` flag'i ile lowercase'e
    // çevrilmiyor (Unicode case folding U+0069 + U+0307); explicit string.
    expect(screen.getByRole("alert").textContent).toContain("İşlem başarısız");
  });
});

describe("QuickActions — read-only set", () => {
  it("ready set → tüm instant butonlar disabled", () => {
    wrapper(
      <QuickActions setId="set-1" item={makeItem()} setStatus="ready" />,
    );
    expect(
      screen.getByRole("button", { name: /background remove/i }),
    ).toBeDisabled();
    // Upscale zaten disabled
    expect(screen.getByRole("button", { name: /upscale 2/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /^crop · oran seçimi$/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /transparent png kontrolü/i }),
    ).toBeDisabled();
  });

  it("archived set → tüm instant butonlar disabled", () => {
    wrapper(
      <QuickActions setId="set-1" item={makeItem()} setStatus="archived" />,
    );
    expect(
      screen.getByRole("button", { name: /^crop · oran seçimi$/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /transparent png kontrolü/i }),
    ).toBeDisabled();
  });
});

describe("QuickActions — Background remove placeholder", () => {
  it("Background remove butonu render edilir (Task 29 placeholder)", () => {
    wrapper(
      <QuickActions setId="set-1" item={makeItem()} setStatus="draft" />,
    );
    const btn = screen.getByRole("button", { name: /background remove/i });
    expect(btn).toBeInTheDocument();
    // Draft set'te disabled değil; ancak Task 29 bağlanana kadar onClick no-op.
    expect(btn).not.toBeDisabled();
  });
});
