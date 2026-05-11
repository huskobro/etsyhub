// Phase 7 Task 25 — Selection Studio shell (StudioShell) testleri.
//
// Senaryolar (plan Task 25):
//   1. Loading state → role=status iskeleti render edilir.
//   2. Error state → "Set yüklenemedi" StateMessage; raw error UI'a sızabilir
//      ama empty test için sadece title varlığını kontrol ederiz.
//   3. Draft set → set adı + "Draft" badge + 3 üst aksiyon butonu (İndir,
//      Set'i finalize et, kebap menüsü) ENABLED.
//   4. Ready set → "Ready" badge + readonly banner + Finalize butonu
//      DISABLED.
//   5. Archived set → "Archived" badge + readonly banner.
//   6. Üç bölgeli layout → sol/sağ placeholder içerikleri DOM'da bulunur
//      (Task 26-30 yer tutucusu).
//   7. setId değişince store currentSetId güncellenir (rerender).
//
// Phase 6 emsali: tests/unit/selection/selection-index-page.test.tsx — query
// hook mock paterni. Burada `useSelectionSet` mock'lanır.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/selection/sets/test",
  useSearchParams: () => new URLSearchParams(""),
}));

// Task 26 — AssetImage signed-url fetch'i şel test'inde de mock'lanır
// (PreviewCard + Filmstrip child'ları AssetImage çağırır). Test odağı shell
// yapısı; image fetch'leri jsdom'da gereksiz network trafiği üretmesin.
vi.mock("@/components/ui/asset-image", () => ({
  AssetImage: ({ assetId, alt }: { assetId: string | null; alt: string }) => (
    <div data-testid="asset-image" data-asset-id={assetId ?? ""} aria-label={alt}>
      asset:{assetId ?? "none"}
    </div>
  ),
}));

const mockUseSelectionSet = vi.fn();
vi.mock("@/features/selection/queries", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/selection/queries")
  >("@/features/selection/queries");
  return {
    ...actual,
    useSelectionSet: (setId: string | null | undefined) =>
      mockUseSelectionSet(setId),
  };
});

import { StudioShell } from "@/features/selection/components/StudioShell";
import { useStudioStore } from "@/features/selection/stores/studio-store";

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function makeSet(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "set-1",
    userId: "u1",
    name: "Test set",
    status: "draft",
    sourceMetadata: null,
    finalizedAt: null,
    archivedAt: null,
    lastExportedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: "i1",
        selectionSetId: "set-1",
        generatedDesignId: "gd1",
        sourceAssetId: "a1",
        editedAssetId: null,
        lastUndoableAssetId: null,
        editHistoryJson: [],
        status: "pending",
        position: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        review: null,
      },
    ],
    activeExport: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockUseSelectionSet.mockReset();
  // Store reset — testler arası izolasyon
  useStudioStore.setState({
    activeItemId: null,
    multiSelectIds: new Set<string>(),
    filter: "all",
    currentSetId: null,
  });
});

describe("StudioShell — loading state", () => {
  it("loading: role=status iskelet render", () => {
    mockUseSelectionSet.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    wrapper(<StudioShell setId="set-1" />);
    const statuses = screen.queryAllByRole("status");
    // SkeletonCardGrid/SkeletonTable role=status; atomic Skeleton vermez —
    // shell loading'i kendi role=status wrapper ile sarar.
    expect(statuses.length).toBeGreaterThan(0);
  });
});

describe("StudioShell — error state", () => {
  it("error: 'Set yüklenemedi' StateMessage render", () => {
    mockUseSelectionSet.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("internal boom xyz"),
    });
    wrapper(<StudioShell setId="set-1" />);
    expect(screen.getByText(/set yüklenemedi/i)).toBeInTheDocument();
  });

  it("data null + error null: shell yine error path'e düşer (defensive)", () => {
    mockUseSelectionSet.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    wrapper(<StudioShell setId="set-1" />);
    expect(screen.getByText(/set yüklenemedi/i)).toBeInTheDocument();
  });
});

describe("StudioShell — draft set", () => {
  it("set adı + Draft badge + İndir/kebab ENABLED + Finalize gate (1+ selected)", () => {
    // Task 35 gate: 1+ selected → Finalize enabled. Item status = "selected"
    // verilerek Finalize gate'i doğrulanır.
    mockUseSelectionSet.mockReturnValue({
      data: makeSet({
        name: "Boho wall art",
        status: "draft",
        items: [
          {
            id: "i1",
            selectionSetId: "set-1",
            generatedDesignId: "gd1",
            sourceAssetId: "a1",
            editedAssetId: null,
            lastUndoableAssetId: null,
            editHistoryJson: [],
            status: "selected",
            position: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            review: null,
          },
        ],
      }),
      isLoading: false,
      error: null,
    });
    wrapper(<StudioShell setId="set-1" />);
    expect(screen.getByText("Boho wall art")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();

    const indirBtn = screen.getByRole("button", { name: /Download \(ZIP\)/i });
    const finalizeBtn = screen.getByRole("button", {
      name: /set'i finalize et/i,
    });
    const kebabBtn = screen.getByRole("button", { name: /set seçenekleri/i });

    expect(indirBtn).not.toBeDisabled();
    expect(finalizeBtn).not.toBeDisabled();
    expect(kebabBtn).not.toBeDisabled();
  });

  it("Task 35 — 0 selected (sadece pending) → Finalize DISABLED + tooltip görünür", () => {
    // makeSet default'u: 1 pending item, 0 selected → gate fail.
    mockUseSelectionSet.mockReturnValue({
      data: makeSet({ status: "draft" }),
      isLoading: false,
      error: null,
    });
    wrapper(<StudioShell setId="set-1" />);
    const finalizeBtn = screen.getByRole("button", {
      name: /set'i finalize et/i,
    });
    expect(finalizeBtn).toBeDisabled();
    // Native title attribute: "En az 1 'Seçime ekle' yapılmış varyant gerekli"
    expect(finalizeBtn.getAttribute("title")).toMatch(
      /en az 1.*seçime ekle.*varyant gerekli/i,
    );
  });

  it("Task 35 — 1+ selected → Finalize ENABLED + tooltip yok", () => {
    mockUseSelectionSet.mockReturnValue({
      data: makeSet({
        status: "draft",
        items: [
          {
            id: "i1",
            selectionSetId: "set-1",
            generatedDesignId: "gd1",
            sourceAssetId: "a1",
            editedAssetId: null,
            lastUndoableAssetId: null,
            editHistoryJson: [],
            status: "selected",
            position: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            review: null,
          },
        ],
      }),
      isLoading: false,
      error: null,
    });
    wrapper(<StudioShell setId="set-1" />);
    const finalizeBtn = screen.getByRole("button", {
      name: /set'i finalize et/i,
    });
    expect(finalizeBtn).not.toBeDisabled();
    expect(finalizeBtn.getAttribute("title")).toBeNull();
  });

  it("varyant sayısı + selected count subtitle'da gösterilir", () => {
    mockUseSelectionSet.mockReturnValue({
      data: makeSet({
        items: Array.from({ length: 5 }, (_, i) => ({
          id: `i${i}`,
          selectionSetId: "set-1",
          generatedDesignId: `gd${i}`,
          sourceAssetId: `a${i}`,
          editedAssetId: null,
          lastUndoableAssetId: null,
          editHistoryJson: [],
          // i=1 ve i=3 selected → 2 seçili
          status: i === 1 || i === 3 ? "selected" : "pending",
          position: i,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          review: null,
        })),
      }),
      isLoading: false,
      error: null,
    });
    wrapper(<StudioShell setId="set-1" />);
    expect(screen.getByText(/5 varyant.*2 seçili/i)).toBeInTheDocument();
  });
});

describe("StudioShell — ready / archived (read-only)", () => {
  it("ready: Ready badge + readonly banner + Finalize DISABLED", () => {
    mockUseSelectionSet.mockReturnValue({
      data: makeSet({ status: "ready" }),
      isLoading: false,
      error: null,
    });
    wrapper(<StudioShell setId="set-1" />);
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText(/finalize edildi/i)).toBeInTheDocument();
    const finalizeBtn = screen.getByRole("button", {
      name: /set'i finalize et/i,
    });
    expect(finalizeBtn).toBeDisabled();
  });

  it("archived: Archived badge + readonly banner + ArchiveAction null (kebap yok)", () => {
    // Task 37 — archived set'te ArchiveAction null döner; üst bar kebap
    // butonu (Set seçenekleri) DOM'a gelmez. Spec Section 4.3: archived
    // → archived geçişi yok, action gizlenir.
    mockUseSelectionSet.mockReturnValue({
      data: makeSet({ status: "archived" }),
      isLoading: false,
      error: null,
    });
    wrapper(<StudioShell setId="set-1" />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText(/finalize edildi/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /set seçenekleri/i }),
    ).not.toBeInTheDocument();
  });
});

describe("StudioShell — üç bölgeli layout (Task 26 + Task 27)", () => {
  it("sol canvas: PreviewCard + Filmstrip + sağ panel (RightPanel) render", () => {
    mockUseSelectionSet.mockReturnValue({
      data: makeSet(),
      isLoading: false,
      error: null,
    });
    wrapper(<StudioShell setId="set-1" />);
    // PreviewCard varyant badge'i
    expect(screen.getByText(/Varyant 01 \/ 01/)).toBeInTheDocument();
    // Filmstrip counter
    expect(screen.getByText(/Varyantlar \(1\)/)).toBeInTheDocument();
    // Sağ panel (Task 27 RightPanel) — Edit header + AI Kalite başlığı
    expect(screen.getByText(/varyant 01 düzenleniyor/i)).toBeInTheDocument();
    expect(screen.getByText("AI Kalite")).toBeInTheDocument();
  });
});

describe("StudioShell — store reset on setId change", () => {
  it("setId render edilince store currentSetId güncellenir", () => {
    mockUseSelectionSet.mockReturnValue({
      data: makeSet({ id: "set-1" }),
      isLoading: false,
      error: null,
    });
    const { rerender } = wrapper(<StudioShell setId="set-1" />);
    expect(useStudioStore.getState().currentSetId).toBe("set-1");

    // Yeni setId
    mockUseSelectionSet.mockReturnValue({
      data: makeSet({ id: "set-2" }),
      isLoading: false,
      error: null,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    rerender(
      <QueryClientProvider client={client}>
        <StudioShell setId="set-2" />
      </QueryClientProvider>,
    );
    expect(useStudioStore.getState().currentSetId).toBe("set-2");
  });
});
