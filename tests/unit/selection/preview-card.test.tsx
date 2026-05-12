// Phase 7 Task 26 — PreviewCard testleri.
//
// Sözleşme (plan Task 26 + spec Section 3.2):
//   - Boş items → "Henüz varyant yok" mesajı render.
//   - items var + activeItemId null → ilk item gösterilir (default).
//   - activeItemId set → o item gösterilir, varyant numarası "X / N" formatlı.
//   - Önceki/Sonraki butonları aktif item'ı değiştirir (store mutate).
//   - İlk item'da Önceki disabled; son item'da Sonraki disabled.
//   - AssetImage assetId resolution: editedAssetId ?? sourceAssetId.
//
// Phase 6 emsali: tests/unit/selection/studio-shell.test.tsx — query mock +
// store reset paterni.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

// AssetImage mock — signed-url fetch avoidance + thumb placeholder
vi.mock("@/components/ui/asset-image", () => ({
  AssetImage: ({ assetId, alt }: { assetId: string | null; alt: string }) => (
    <div data-testid="asset-image" data-asset-id={assetId ?? ""} aria-label={alt}>
      asset:{assetId ?? "none"}
    </div>
  ),
}));

import { PreviewCard } from "@/features/selection/components/PreviewCard";
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
  } as SelectionItemView;
}

beforeEach(() => {
  useStudioStore.setState({
    activeItemId: null,
    multiSelectIds: new Set<string>(),
    filter: "all",
    currentSetId: null,
  });
});

describe("PreviewCard — empty state", () => {
  it("items boş → 'No variants yet' render", () => {
    wrapper(<PreviewCard items={[]} />);
    expect(screen.getByText(/no variants yet/i)).toBeInTheDocument();
  });
});

describe("PreviewCard — default active (activeItemId null)", () => {
  it("activeItemId null + items var → ilk item gösterilir, '01 / N' badge", () => {
    const items = [
      makeItem({ id: "i1", position: 0, sourceAssetId: "a1" }),
      makeItem({ id: "i2", position: 1, sourceAssetId: "a2" }),
      makeItem({ id: "i3", position: 2, sourceAssetId: "a3" }),
    ];
    wrapper(<PreviewCard items={items} />);

    // Badge formatı: "Varyant 01 / 03"
    expect(screen.getByText(/Variant 01 \/ 03/)).toBeInTheDocument();
    // Asset image i1 → a1
    const img = screen.getByTestId("asset-image");
    expect(img.getAttribute("data-asset-id")).toBe("a1");
  });
});

describe("PreviewCard — explicit activeItemId", () => {
  it("activeItemId='i3' → 'Varyant 03 / 12'", () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      makeItem({ id: `i${i + 1}`, position: i, sourceAssetId: `a${i + 1}` }),
    );
    useStudioStore.setState({ activeItemId: "i3" });
    wrapper(<PreviewCard items={items} />);

    expect(screen.getByText(/Variant 03 \/ 12/)).toBeInTheDocument();
    const img = screen.getByTestId("asset-image");
    expect(img.getAttribute("data-asset-id")).toBe("a3");
  });

  it("editedAssetId varsa o kullanılır (sourceAssetId değil)", () => {
    const items = [
      makeItem({
        id: "i1",
        sourceAssetId: "src-1",
        editedAssetId: "edited-1",
      }),
    ];
    wrapper(<PreviewCard items={items} />);
    const img = screen.getByTestId("asset-image");
    expect(img.getAttribute("data-asset-id")).toBe("edited-1");
  });
});

describe("PreviewCard — prev/next nav", () => {
  it("Sonraki click → activeItemId artar", () => {
    const items = [
      makeItem({ id: "i1", position: 0 }),
      makeItem({ id: "i2", position: 1 }),
      makeItem({ id: "i3", position: 2 }),
    ];
    useStudioStore.setState({ activeItemId: "i1" });
    wrapper(<PreviewCard items={items} />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(useStudioStore.getState().activeItemId).toBe("i2");
  });

  it("Önceki click → activeItemId azalır", () => {
    const items = [
      makeItem({ id: "i1", position: 0 }),
      makeItem({ id: "i2", position: 1 }),
      makeItem({ id: "i3", position: 2 }),
    ];
    useStudioStore.setState({ activeItemId: "i3" });
    wrapper(<PreviewCard items={items} />);

    fireEvent.click(screen.getByRole("button", { name: /previous/i }));
    expect(useStudioStore.getState().activeItemId).toBe("i2");
  });

  it("ilk item'da Önceki disabled", () => {
    const items = [
      makeItem({ id: "i1" }),
      makeItem({ id: "i2" }),
    ];
    useStudioStore.setState({ activeItemId: "i1" });
    wrapper(<PreviewCard items={items} />);

    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
  });

  it("son item'da Sonraki disabled", () => {
    const items = [
      makeItem({ id: "i1" }),
      makeItem({ id: "i2" }),
    ];
    useStudioStore.setState({ activeItemId: "i2" });
    wrapper(<PreviewCard items={items} />);

    expect(screen.getByRole("button", { name: /previous/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });
});
