// Phase 8 Task 24 — SetSummaryCard unit test.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SetSummaryCard } from "@/features/mockups/components/SetSummaryCard";
import type { SelectionSetDetailView } from "@/features/selection/queries";

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
    },
    {
      id: "item-2",
      selectionSetId: "set-1",
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
      sourceAsset: null,
      editedAsset: null,
    },
  ],
  activeExport: null,
};

describe("<SetSummaryCard>", () => {
  it("renders set name and item count", () => {
    render(
      <SetSummaryCard
        set={mockSet}
        isQuickPack={true}
        selectedCount={2}
      />
    );

    expect(screen.getByText("Test Set")).toBeInTheDocument();
    expect(screen.getByText(/2 tasarım seçili/)).toBeInTheDocument();
  });

  it("shows status badge (ready)", () => {
    render(
      <SetSummaryCard
        set={mockSet}
        isQuickPack={true}
        selectedCount={2}
      />
    );

    expect(screen.getByText("Hazır")).toBeInTheDocument();
  });

  it("shows Quick Pack label", () => {
    render(
      <SetSummaryCard
        set={mockSet}
        isQuickPack={true}
        selectedCount={2}
      />
    );

    expect(screen.getByText("Quick Pack")).toBeInTheDocument();
  });

  it("shows Custom Pack label when not quick pack", () => {
    render(
      <SetSummaryCard
        set={mockSet}
        isQuickPack={false}
        selectedCount={1}
      />
    );

    expect(screen.getByText("Özel Seçim")).toBeInTheDocument();
  });

  it("displays selected mockup count", () => {
    render(
      <SetSummaryCard
        set={mockSet}
        isQuickPack={true}
        selectedCount={6}
      />
    );

    expect(screen.getByText("6 mockup")).toBeInTheDocument();
  });

  it("handles draft status", () => {
    const draftSet = { ...mockSet, status: "draft" as const };
    render(
      <SetSummaryCard
        set={draftSet}
        isQuickPack={true}
        selectedCount={2}
      />
    );

    expect(screen.getByText("Taslak")).toBeInTheDocument();
  });

  it("handles archived status", () => {
    const archivedSet = { ...mockSet, status: "archived" as const };
    render(
      <SetSummaryCard
        set={archivedSet}
        isQuickPack={true}
        selectedCount={2}
      />
    );

    expect(screen.getByText("Arşivlendi")).toBeInTheDocument();
  });
});
