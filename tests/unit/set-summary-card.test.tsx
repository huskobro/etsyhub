import { render, screen } from "@testing-library/react";
import { SetSummaryCard } from "@/features/mockups/components/SetSummaryCard";

describe("SetSummaryCard", () => {
  it("renders set name and ID", () => {
    render(
      <SetSummaryCard
        setId="test-set-1"
        setName="Test Set"
        assetCount={5}
        avgQualityScore={85}
      />
    );

    expect(screen.getByText("Test Set")).toBeInTheDocument();
    expect(screen.getByText("test-set-1")).toBeInTheDocument();
  });

  it("displays asset count correctly", () => {
    render(
      <SetSummaryCard
        setId="test-set-1"
        setName="Test"
        assetCount={12}
        avgQualityScore={90}
      />
    );

    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shows quality score with appropriate color", () => {
    const { rerender } = render(
      <SetSummaryCard
        setId="test-set-1"
        setName="Test"
        assetCount={5}
        avgQualityScore={95}
      />
    );

    // Yüksek kalite (yeşil)
    expect(screen.getByText("95")).toHaveClass("text-green-700");

    rerender(
      <SetSummaryCard
        setId="test-set-1"
        setName="Test"
        assetCount={5}
        avgQualityScore={75}
      />
    );

    // Orta kalite (turuncu)
    expect(screen.getByText("75")).toHaveClass("text-amber-700");
  });

  it("renders collections", () => {
    render(
      <SetSummaryCard
        setId="test-set-1"
        setName="Test"
        assetCount={5}
        avgQualityScore={85}
        collections={[
          { id: "col-1", name: "Christmas" },
          { id: "col-2", name: "Wall Art" },
        ]}
      />
    );

    expect(screen.getByText("Christmas")).toBeInTheDocument();
    expect(screen.getByText("Wall Art")).toBeInTheDocument();
  });

  it("has correct test ID for integration", () => {
    render(
      <SetSummaryCard
        setId="test-set-1"
        setName="Test"
        assetCount={5}
        avgQualityScore={85}
      />
    );

    expect(screen.getByTestId("set-summary-card")).toBeInTheDocument();
  });
});
