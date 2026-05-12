// Phase 8 Task 23 — S3ApplyView default render test.
//
// Spec §5.2 default Quick pack senaryosu. T23 minimum coverage:
// rozet "★ Quick pack" görünür + CTA "Render et (Quick pack)" enabled.
// 9-state coverage Task 25'e ait.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { S3ApplyView } from "@/features/mockups/components/S3ApplyView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/selection/sets/test-set/mockup/apply",
}));

// Hook mock'ları — minimal stable shape döner
vi.mock("@/features/selection/queries", () => ({
  useSelectionSet: () => ({
    data: {
      id: "test-set",
      name: "Test Set",
      status: "ready",
      userId: "user-1",
      sourceMetadata: null,
      lastExportedAt: null,
      finalizedAt: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: "item-1",
          selectionSetId: "test-set",
          generatedDesignId: "design-1",
          sourceAssetId: "asset-1",
          editedAssetId: null,
          lastUndoableAssetId: "asset-1",
          activeHeavyJobId: null,
          editHistoryJson: "{}",
          status: "selected",
          position: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          review: null,
        },
        {
          id: "item-2",
          selectionSetId: "test-set",
          generatedDesignId: "design-2",
          sourceAssetId: "asset-2",
          editedAssetId: null,
          lastUndoableAssetId: "asset-2",
          activeHeavyJobId: null,
          editHistoryJson: "{}",
          status: "selected",
          position: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          review: null,
        },
      ],
      activeExport: null,
    },
    isLoading: false,
  }),
}));

vi.mock("@/features/mockups/hooks/useMockupTemplates", () => ({
  useMockupTemplates: () => ({
    data: [
      {
        id: "t1",
        name: "Modern Sofa Wall",
        aspectRatios: ["2:3"],
        tags: ["modern"],
        thumbKey: "thumb-1",
        estimatedRenderMs: 3000,
        hasActiveBinding: true,
      },
      {
        id: "t2",
        name: "Boho Canvas",
        aspectRatios: ["2:3"],
        tags: ["boho"],
        thumbKey: "thumb-2",
        estimatedRenderMs: 3000,
        hasActiveBinding: true,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/features/mockups/hooks/useMockupPackState", () => ({
  useMockupPackState: () => ({
    selectedTemplateIds: ["t1", "t2"],
    defaultTemplateIds: ["t1", "t2"],
    isDirty: false,
    isCustom: false,
    toggleTemplate: vi.fn(),
    resetToQuickPack: vi.fn(),
  }),
}));

vi.mock("@/features/mockups/hooks/useMockupOverlayState", () => ({
  useMockupOverlayState: () => ({
    isCustomizeOpen: false,
    modalTemplateId: null,
    openCustomizeDrawer: vi.fn(),
    closeCustomize: vi.fn(),
    openTemplateModal: vi.fn(),
    closeTemplateModal: vi.fn(),
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("<S3ApplyView>", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("default render: Quick pack rozet + CTA enabled", () => {
    render(<S3ApplyView setId="test-set" />, { wrapper });

    // Quick pack rozet görünür
    expect(screen.getByTestId("pack-badge")).toHaveTextContent(/Quick pack/);

    // CTA enabled (default render senaryosu)
    const cta = screen.getByRole("button", { name: /Render/ });
    expect(cta).toBeEnabled();

    // Seçili görsel sayısı gösterilir
    expect(screen.getByText(/2 images to render/)).toBeInTheDocument();
  });

  it("renders SetSummaryCard with set info", () => {
    render(<S3ApplyView setId="test-set" />, { wrapper });

    // SetSummaryCard heading'i
    expect(screen.getByRole("heading")).toHaveTextContent("Test Set");
    expect(screen.getByText(/2 designs selected/)).toBeInTheDocument();
  });

  it("renders PackPreviewCard with selected templates", () => {
    render(<S3ApplyView setId="test-set" />, { wrapper });

    expect(screen.getByText(/2 images to render/)).toBeInTheDocument();
    expect(screen.getByText("Modern Sofa Wall")).toBeInTheDocument();
    expect(screen.getByText("Boho Canvas")).toBeInTheDocument();
  });

  it("renders DecisionBand with submit button", () => {
    render(<S3ApplyView setId="test-set" />, { wrapper });

    const button = screen.getByRole("button", { name: /Render/ });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it("shows header breadcrumb navigation", () => {
    render(<S3ApplyView setId="test-set" />, { wrapper });

    expect(screen.getByText("Mockup Studio")).toBeInTheDocument();
    // "Test Set" appears multiple times (header + SetSummaryCard),
    // so use getByRole instead
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});
