// Phase 8 Task 25 — PackPreviewCard unit test.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PackPreviewCard } from "@/features/mockups/components/PackPreviewCard";
import type { SelectionSetDetailView } from "@/features/selection/queries";
import type { MockupTemplateView } from "@/features/mockups/hooks/useMockupTemplates";

const mockSet: SelectionSetDetailView = {
  id: "set-1",
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
      selectionSetId: "set-1",
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
      sourceAsset: null,
      editedAsset: null,
      mjOrigin: null,
    },
  ],
  activeExport: null,
};

const mockTemplates: MockupTemplateView[] = [
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
];

describe("<PackPreviewCard>", () => {
  const defaultProps = {
    set: mockSet,
    isQuickPack: true,
    selectedTemplateIds: ["t1", "t2"],
    allTemplates: mockTemplates,
    isDirty: false,
    onCustomizeClick: vi.fn(),
    onToggleTemplate: vi.fn(),
  };

  it("displays Quick Pack badge", () => {
    render(<PackPreviewCard {...defaultProps} />);
    expect(screen.getByTestId("pack-badge")).toHaveTextContent(/Quick pack/);
  });

  it("displays Custom Pack badge", () => {
    render(
      <PackPreviewCard
        {...defaultProps}
        isQuickPack={false}
      />
    );
    expect(screen.getByTestId("pack-badge")).toHaveTextContent(/Custom pack/);
  });

  it("shows selected template count", () => {
    render(<PackPreviewCard {...defaultProps} />);
    expect(screen.getByText(/2 images to render/)).toBeInTheDocument();
  });

  it("shows customized badge when isDirty", () => {
    render(
      <PackPreviewCard
        {...defaultProps}
        isDirty={true}
      />
    );
    expect(screen.getByText("Customized")).toBeInTheDocument();
  });

  it("displays empty state when no templates selected", () => {
    render(
      <PackPreviewCard
        {...defaultProps}
        selectedTemplateIds={[]}
      />
    );
    expect(screen.getByText(/Seçilmiş mockup şablonu yok/)).toBeInTheDocument();
  });

  it("shows customize button for custom pack", () => {
    render(
      <PackPreviewCard
        {...defaultProps}
        isQuickPack={false}
      />
    );
    expect(screen.getByText(/Şablonları Özelleştir/)).toBeInTheDocument();
  });

  it("hides customize button for quick pack", () => {
    const { queryByText } = render(
      <PackPreviewCard
        {...defaultProps}
        isQuickPack={true}
      />
    );
    expect(queryByText(/Şablonları Özelleştir/)).not.toBeInTheDocument();
  });

  it("lists selected templates", () => {
    render(<PackPreviewCard {...defaultProps} />);
    expect(screen.getByText("Modern Sofa Wall")).toBeInTheDocument();
    expect(screen.getByText("Boho Canvas")).toBeInTheDocument();
  });
});
