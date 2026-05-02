// Phase 8 Task 23 — S3ApplyView default render test.
//
// Spec §5.2 default Quick Pack senaryosu. T23 minimum coverage:
// rozet "★ Quick Pack" görünür + CTA "Render et (Quick Pack)" enabled.
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
      categoryId: "canvas",
      // selection set detail view shape — Task 14 extractVariants buradan okur
      variants: [
        { id: "v1", aspectRatio: "2:3" },
        { id: "v2", aspectRatio: "2:3" },
      ],
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
    incompatibleTemplateIds: [],
    incompatibleReason: undefined,
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

  it("default render: Quick Pack rozet + CTA enabled", () => {
    render(<S3ApplyView setId="test-set" />, { wrapper });

    // Quick Pack rozet görünür
    expect(screen.getByTestId("pack-badge")).toHaveTextContent(/Quick Pack/);

    // CTA enabled (default render senaryosu) — DecisionBand button'ı testid ile bul
    const cta = screen.getByTestId("render-button-ready");
    expect(cta).toBeEnabled();

    // Pack preview kart görünür
    expect(screen.getByTestId("pack-preview-card")).toBeInTheDocument();
  });
});
