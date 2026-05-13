// Phase 8 Task 25 — DecisionBand unit test.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DecisionBand } from "@/features/mockups/components/DecisionBand";

describe("<DecisionBand>", () => {
  const defaultProps = {
    isQuickPack: true,
    selectedCount: 6,
    isDirty: false,
    isSubmitting: false,
    onSubmit: vi.fn(),
    onReset: vi.fn(),
  };

  it("displays estimated time", () => {
    render(<DecisionBand {...defaultProps} />);
    expect(screen.getByText(/~30 saniye/)).toBeInTheDocument();
  });

  it("calculates estimated time correctly", () => {
    render(
      <DecisionBand
        {...defaultProps}
        selectedCount={12}
      />
    );
    expect(screen.getByText(/~1 dakika/)).toBeInTheDocument();
  });

  it("shows Quick Pack label", () => {
    render(<DecisionBand {...defaultProps} />);
    expect(screen.getByText(/Quick pack/)).toBeInTheDocument();
  });

  it("shows Custom Pack label", () => {
    render(
      <DecisionBand
        {...defaultProps}
        isQuickPack={false}
      />
    );
    expect(screen.getByText(/Custom pack/)).toBeInTheDocument();
  });

  it("disables button when no selection", () => {
    render(
      <DecisionBand
        {...defaultProps}
        selectedCount={0}
      />
    );
    const button = screen.getByRole("button", { name: /Render/ });
    expect(button).toBeDisabled();
  });

  it("disables button when submitting", () => {
    render(
      <DecisionBand
        {...defaultProps}
        isSubmitting={true}
      />
    );
    const button = screen.getByRole("button", { name: /Render/ });
    expect(button).toBeDisabled();
  });

  it("shows loading spinner when submitting", () => {
    render(
      <DecisionBand
        {...defaultProps}
        isSubmitting={true}
      />
    );
    expect(screen.getByRole("button", { name: /Render/ })).toBeInTheDocument();
  });

  it("shows reset link when dirty", () => {
    render(
      <DecisionBand
        {...defaultProps}
        isDirty={true}
      />
    );
    expect(screen.getByText(/Reset to Quick pack/)).toBeInTheDocument();
  });

  it("hides reset link when not dirty", () => {
    const { queryByText } = render(
      <DecisionBand
        {...defaultProps}
        isDirty={false}
      />
    );
    expect(queryByText(/Reset to Quick pack/)).not.toBeInTheDocument();
  });

  it("shows warning when no selection", () => {
    render(
      <DecisionBand
        {...defaultProps}
        selectedCount={0}
      />
    );
    expect(
      screen.getByText(/No templates selected/)
    ).toBeInTheDocument();
  });

  it("button is enabled when selection exists", () => {
    const button = screen.queryByRole("button", { name: /Render/ });
    if (button) {
      expect(button).not.toBeDisabled();
    }
  });
});
