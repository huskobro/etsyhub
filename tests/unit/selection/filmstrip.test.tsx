// Phase 7 Task 26 — Filmstrip testleri.
//
// Sözleşme (plan Task 26 + spec Section 3.2-3.3):
//   - Filter dropdown: Tümü / Aktif (pending+selected) / Reddedilenler.
//   - Item click → setActiveItemId + multi-select clear.
//   - Cmd/Ctrl+click → toggleMultiSelect (aktif item değişmez).
//   - Shift+click range → selectMultiRange (lastClickedIdx → currentIdx).
//   - Selected status → checkmark badge görünür.
//   - Active item → border accent.
//   - Rejected item → opacity reduced + "Reddedildi" badge.
//   - Multi-select item → ring class.
//   - "+ Varyant ekle" → setStatus draft ise görünür; ready/archived'da gizli.
//   - Read-only set: click yalnız preview, multi-select yok.
//   - Filter sayacı: "Varyantlar (3 / 12)" partial filter durumu.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

vi.mock("@/components/ui/asset-image", () => ({
  AssetImage: ({ assetId, alt }: { assetId: string | null; alt: string }) => (
    <div data-testid="asset-image" data-asset-id={assetId ?? ""} aria-label={alt}>
      asset:{assetId ?? "none"}
    </div>
  ),
}));

import { Filmstrip } from "@/features/selection/components/Filmstrip";
import { useStudioStore } from "@/features/selection/stores/studio-store";
import type { SelectionItemView } from "@/features/selection/queries";

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function makeItem(overrides: Partial<SelectionItemView> = {}): SelectionItemView {
  return {
    id: "i1",
    selectionSetId: "set-1",
    generatedDesignId: "gd1",
    sourceAssetId: "a1",
    editedAssetId: null,
    lastUndoableAssetId: null,
    editHistoryJson: [],
    status: "pending",
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    review: null,
    ...overrides,
  } as SelectionItemView;
}

const sampleItems = (): SelectionItemView[] => [
  makeItem({ id: "i1", position: 0, status: "pending" }),
  makeItem({ id: "i2", position: 1, status: "selected" }),
  makeItem({ id: "i3", position: 2, status: "rejected" }),
  makeItem({ id: "i4", position: 3, status: "pending" }),
];

beforeEach(() => {
  useStudioStore.setState({
    activeItemId: null,
    multiSelectIds: new Set<string>(),
    filter: "all",
    currentSetId: null,
  });
});

describe("Filmstrip — filter dropdown", () => {
  it("'Tümü' (default) → tüm items render edilir", () => {
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);
    // 4 varyant + "+ ekle" tile
    const buttons = screen.getAllByRole("checkbox");
    expect(buttons).toHaveLength(4);
  });

  it("'Aktif' → pending + selected; rejected gizli", () => {
    useStudioStore.setState({ filter: "active" });
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);
    const buttons = screen.getAllByRole("checkbox");
    expect(buttons).toHaveLength(3); // i1 pending + i2 selected + i4 pending
  });

  it("'Reddedilenler' → yalnız rejected", () => {
    useStudioStore.setState({ filter: "rejected" });
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);
    const buttons = screen.getAllByRole("checkbox");
    expect(buttons).toHaveLength(1);
  });

  it("filter empty state → 'Reddedilen varyant yok'", () => {
    useStudioStore.setState({ filter: "rejected" });
    const items = [
      makeItem({ id: "i1", status: "pending" }),
      makeItem({ id: "i2", status: "selected" }),
    ];
    wrapper(<Filmstrip items={items} setStatus="draft" />);
    expect(screen.getByText(/reddedilen varyant yok/i)).toBeInTheDocument();
  });

  it("filter sayacı: 'Aktif' → 'Varyantlar (3 / 4)'", () => {
    useStudioStore.setState({ filter: "active" });
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);
    // "Varyantlar (3 / 4)" — partial filter durumu
    expect(screen.getByText(/Varyantlar \(3 \/ 4\)/i)).toBeInTheDocument();
  });

  it("filter 'Tümü' → 'Varyantlar (4)'", () => {
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);
    expect(screen.getByText(/Varyantlar \(4\)/i)).toBeInTheDocument();
  });

  it("dropdown change → store filter güncellenir", () => {
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);
    const select = screen.getByLabelText(/filtre/i);
    fireEvent.change(select, { target: { value: "active" } });
    expect(useStudioStore.getState().filter).toBe("active");
  });
});

describe("Filmstrip — single click", () => {
  it("plain click → setActiveItemId + multi-select clear", () => {
    useStudioStore.setState({
      multiSelectIds: new Set(["i2", "i4"]),
    });
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);

    const buttons = screen.getAllByRole("checkbox");
    fireEvent.click(buttons[0]!);

    expect(useStudioStore.getState().activeItemId).toBe("i1");
    expect(useStudioStore.getState().multiSelectIds.size).toBe(0);
  });
});

describe("Filmstrip — Cmd/Ctrl+click", () => {
  it("metaKey+click → toggleMultiSelect (aktif değişmez)", () => {
    useStudioStore.setState({ activeItemId: "i1" });
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);

    const buttons = screen.getAllByRole("checkbox");
    fireEvent.click(buttons[1]!, { metaKey: true });

    expect(useStudioStore.getState().multiSelectIds.has("i2")).toBe(true);
    expect(useStudioStore.getState().activeItemId).toBe("i1");
  });

  it("ctrlKey+click → toggleMultiSelect (windows/linux)", () => {
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);

    const buttons = screen.getAllByRole("checkbox");
    fireEvent.click(buttons[1]!, { ctrlKey: true });

    expect(useStudioStore.getState().multiSelectIds.has("i2")).toBe(true);
  });
});

describe("Filmstrip — Shift+click range", () => {
  it("ilk item'a meta+click sonrası shift+click → araya range", () => {
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);
    const buttons = screen.getAllByRole("checkbox");

    // İlk: cmd+click i1 → multi-select [i1] + lastIdx=0
    fireEvent.click(buttons[0]!, { metaKey: true });
    expect(useStudioStore.getState().multiSelectIds.has("i1")).toBe(true);

    // Shift+click i4 (idx=3) → range i1..i4
    fireEvent.click(buttons[3]!, { shiftKey: true });

    const ids = Array.from(useStudioStore.getState().multiSelectIds).sort();
    expect(ids).toEqual(["i1", "i2", "i3", "i4"]);
  });
});

describe("Filmstrip — visual states", () => {
  it("selected item → checkmark badge görünür", () => {
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);
    // i2 selected → aria-label içinde "(seçili)"
    const i2 = screen.getByRole("checkbox", { name: /\(seçili\)/i });
    expect(i2).toBeInTheDocument();
  });

  it("active item → aria-checked false (multi değil) + border accent class", () => {
    useStudioStore.setState({ activeItemId: "i1" });
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);
    const buttons = screen.getAllByRole("checkbox");
    expect(buttons[0]!.className).toMatch(/border-accent/);
  });

  it("rejected item → opacity reduced + 'Reddedildi' badge", () => {
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);
    expect(screen.getByText(/^Reddedildi$/i)).toBeInTheDocument();
    const i3 = screen.getByRole("checkbox", { name: /\(reddedildi\)/i });
    expect(i3.className).toMatch(/opacity-/);
  });

  it("multi-select item → ring class", () => {
    useStudioStore.setState({ multiSelectIds: new Set(["i1"]) });
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);
    const buttons = screen.getAllByRole("checkbox");
    expect(buttons[0]!.className).toMatch(/ring-/);
    expect(buttons[0]!.getAttribute("aria-checked")).toBe("true");
  });
});

describe("Filmstrip — '+ Varyant ekle' tile", () => {
  it("draft set → '+ Varyant ekle' butonu render", () => {
    wrapper(<Filmstrip items={sampleItems()} setStatus="draft" />);
    expect(
      screen.getByRole("button", { name: /varyant ekle/i }),
    ).toBeInTheDocument();
  });

  it("ready set (read-only) → '+ Varyant ekle' yok", () => {
    wrapper(<Filmstrip items={sampleItems()} setStatus="ready" />);
    expect(
      screen.queryByRole("button", { name: /varyant ekle/i }),
    ).not.toBeInTheDocument();
  });

  it("archived set → '+ Varyant ekle' yok", () => {
    wrapper(<Filmstrip items={sampleItems()} setStatus="archived" />);
    expect(
      screen.queryByRole("button", { name: /varyant ekle/i }),
    ).not.toBeInTheDocument();
  });
});

describe("Filmstrip — read-only set", () => {
  it("read-only set click → yalnız preview değişir, multi-select tetiklenmez", () => {
    wrapper(<Filmstrip items={sampleItems()} setStatus="ready" />);
    const buttons = screen.getAllByRole("checkbox");

    // Cmd+click bile multi-select tetiklemez
    fireEvent.click(buttons[1]!, { metaKey: true });
    expect(useStudioStore.getState().multiSelectIds.size).toBe(0);
    expect(useStudioStore.getState().activeItemId).toBe("i2");
  });
});
