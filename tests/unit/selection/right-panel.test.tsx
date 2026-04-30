// Phase 7 Task 27 — RightPanel testleri.
//
// Sözleşme (plan Task 27 + spec Section 3.2):
//   - Boş items → "Varyant seçilmedi" header subtitle + filmstrip yönlendirme.
//   - Aktif item draft set → variant number padded ("01"), AiQualityPanel,
//     bottom action butonları render.
//   - Read-only set (status !== "draft") → bottom action butonları YOK.
//   - "Reddet" click → PATCH mutation status="rejected".
//   - "Seçime ekle" click → PATCH mutation status="selected".
//   - Item zaten selected → "Seçimden çıkar" + primary variant.
//   - Item zaten rejected → "Reddi geri al" label.
//   - Mutation pending → bottom butonlar disabled.
//
// Phase 6 emsali: tests/unit/selection/create-set-modal.test.tsx —
// QueryClientProvider wrapper + fetch mock.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { SelectionItemView } from "@/features/selection/queries";

vi.mock("@/components/ui/asset-image", () => ({
  AssetImage: ({ assetId, alt }: { assetId: string | null; alt: string }) => (
    <div data-testid="asset-image" data-asset-id={assetId ?? ""} aria-label={alt}>
      asset:{assetId ?? "none"}
    </div>
  ),
}));

import { RightPanel } from "@/features/selection/components/RightPanel";
import { useStudioStore } from "@/features/selection/stores/studio-store";

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
  useStudioStore.setState({
    activeItemId: null,
    multiSelectIds: new Set<string>(),
    filter: "all",
    currentSetId: null,
  });
  // global fetch reset (testler arası izolasyon)
  vi.stubGlobal("fetch", vi.fn());
});

describe("RightPanel — boş items", () => {
  it("items boş → 'Varyant seçilmedi' subtitle + 'Filmstrip'ten...' mesaj", () => {
    wrapper(<RightPanel setId="set-1" items={[]} setStatus="draft" />);
    expect(screen.getByText(/varyant seçilmedi/i)).toBeInTheDocument();
    expect(
      screen.getByText(/filmstrip'ten bir varyant seçin/i),
    ).toBeInTheDocument();
  });
});

describe("RightPanel — aktif item draft set", () => {
  it("activeItemId yoksa items[0] kullanılır; variant numarası '01' formatlı", () => {
    const items = [makeItem({ id: "i1" }), makeItem({ id: "i2" })];
    wrapper(<RightPanel setId="set-1" items={items} setStatus="draft" />);
    // İlk item default → "Varyant 01 düzenleniyor"
    expect(screen.getByText(/varyant 01 düzenleniyor/i)).toBeInTheDocument();
  });

  it("activeItemId set → o item'ın 1-based padded numarası gösterilir", () => {
    const items = [
      makeItem({ id: "i1" }),
      makeItem({ id: "i2" }),
      makeItem({ id: "i3" }),
    ];
    useStudioStore.setState({ activeItemId: "i3" });
    wrapper(<RightPanel setId="set-1" items={items} setStatus="draft" />);
    expect(screen.getByText(/varyant 03 düzenleniyor/i)).toBeInTheDocument();
  });

  it("AiQualityPanel render edilir (review yok → muted hint)", () => {
    const items = [makeItem({ id: "i1", review: null })];
    wrapper(<RightPanel setId="set-1" items={items} setStatus="draft" />);
    // AI Kalite başlık (tam metin — hint paragrafıyla karışmasın)
    expect(screen.getByText("AI Kalite")).toBeInTheDocument();
    expect(
      screen.getByText(/bu varyant için ai kalite analizi yapılmamış/i),
    ).toBeInTheDocument();
  });

  it("draft → bottom action butonları 'Reddet' + 'Seçime ekle' render", () => {
    const items = [makeItem({ id: "i1" })];
    wrapper(<RightPanel setId="set-1" items={items} setStatus="draft" />);
    expect(screen.getByRole("button", { name: /^reddet$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^seçime ekle$/i }),
    ).toBeInTheDocument();
  });
});

describe("RightPanel — read-only", () => {
  it("ready set → bottom action butonları YOK", () => {
    const items = [makeItem({ id: "i1" })];
    wrapper(<RightPanel setId="set-1" items={items} setStatus="ready" />);
    expect(
      screen.queryByRole("button", { name: /^reddet$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^seçime ekle$/i }),
    ).not.toBeInTheDocument();
  });

  it("archived set → bottom action butonları YOK", () => {
    const items = [makeItem({ id: "i1" })];
    wrapper(<RightPanel setId="set-1" items={items} setStatus="archived" />);
    expect(
      screen.queryByRole("button", { name: /^reddet$/i }),
    ).not.toBeInTheDocument();
  });
});

describe("RightPanel — status mutation", () => {
  it("'Seçime ekle' click → PATCH /items/i1 status='selected'", async () => {
    const items = [makeItem({ id: "i1", status: "pending" })];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          item: { ...items[0], status: "selected" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(<RightPanel setId="set-1" items={items} setStatus="draft" />);
    fireEvent.click(screen.getByRole("button", { name: /^seçime ekle$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/selection/sets/set-1/items/i1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ status: "selected" });
  });

  it("'Reddet' click → PATCH status='rejected'", async () => {
    const items = [makeItem({ id: "i1", status: "pending" })];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ item: { ...items[0], status: "rejected" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(<RightPanel setId="set-1" items={items} setStatus="draft" />);
    fireEvent.click(screen.getByRole("button", { name: /^reddet$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body as string)).toEqual({ status: "rejected" });
  });

  it("item zaten selected → 'Seçimden çıkar' label render + click pending'e döner", async () => {
    const items = [makeItem({ id: "i1", status: "selected" })];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ item: { ...items[0], status: "pending" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(<RightPanel setId="set-1" items={items} setStatus="draft" />);
    const btn = screen.getByRole("button", { name: /seçimden çıkar/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body as string)).toEqual({ status: "pending" });
  });

  it("item zaten rejected → 'Reddi geri al' label render", () => {
    const items = [makeItem({ id: "i1", status: "rejected" })];
    wrapper(<RightPanel setId="set-1" items={items} setStatus="draft" />);
    expect(
      screen.getByRole("button", { name: /reddi geri al/i }),
    ).toBeInTheDocument();
  });
});

describe("RightPanel — mutation pending state", () => {
  it("mutation pending → her iki bottom buton disabled", async () => {
    const items = [makeItem({ id: "i1", status: "pending" })];
    let resolveFn: ((v: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveFn = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    wrapper(<RightPanel setId="set-1" items={items} setStatus="draft" />);
    const selectBtn = screen.getByRole("button", { name: /^seçime ekle$/i });
    fireEvent.click(selectBtn);

    await waitFor(() => {
      expect(selectBtn).toBeDisabled();
      expect(screen.getByRole("button", { name: /^reddet$/i })).toBeDisabled();
    });

    // Cleanup — resolve pending promise (test leak'sız)
    resolveFn?.(
      new Response(JSON.stringify({ item: items[0] }), { status: 200 }),
    );
  });
});
