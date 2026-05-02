import { vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DecisionBand } from "@/features/mockups/components/DecisionBand";

describe("DecisionBand — 9-state coverage", () => {
  // State: empty
  it("renders empty state with disabled button", () => {
    render(
      <DecisionBand
        state="empty"
        packSize={0}
        estimatedSeconds={30}
      />
    );

    expect(screen.getByTestId("decision-state-empty")).toBeInTheDocument();
    expect(screen.getByTestId("render-button-empty")).toBeDisabled();
    expect(screen.getByText("Şablon Seçin")).toBeInTheDocument();
  });

  // State: incompatible
  it("renders incompatible state with override option", () => {
    render(
      <DecisionBand
        state="incompatible"
        packSize={2}
        estimatedSeconds={30}
      />
    );

    expect(screen.getByTestId("decision-state-incompatible")).toBeInTheDocument();
    expect(screen.getByText("Yine de Render Et")).toBeInTheDocument();
  });

  // State: rendering
  it("renders rendering state with spinner and cancel button", () => {
    const onCancel = vi.fn();
    render(
      <DecisionBand
        state="rendering"
        packSize={2}
        estimatedSeconds={25}
        onCancel={onCancel}
      />
    );

    expect(screen.getByTestId("decision-state-rendering")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-button")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("cancel-button"));
    expect(onCancel).toHaveBeenCalled();
  });

  // State: error
  it("renders error state with retry option", () => {
    render(
      <DecisionBand
        state="error"
        packSize={2}
        errorMessage="Network error"
      />
    );

    expect(screen.getByTestId("decision-state-error")).toBeInTheDocument();
    expect(screen.getByText("Yeniden Dene")).toBeInTheDocument();
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });

  // State: success
  it("renders success state", () => {
    render(
      <DecisionBand
        state="success"
        packSize={2}
      />
    );

    expect(screen.getByTestId("decision-state-success")).toBeInTheDocument();
    expect(screen.getByTestId("render-button-success")).toBeDisabled();
  });

  // State: locked
  it("renders locked state when another job is running", () => {
    render(
      <DecisionBand
        state="locked"
        packSize={2}
      />
    );

    expect(screen.getByTestId("decision-state-locked")).toBeInTheDocument();
    expect(screen.getByTestId("render-button-locked")).toBeDisabled();
  });

  // State: retry
  it("renders retry state with spinner", () => {
    render(
      <DecisionBand
        state="retry"
        packSize={2}
        estimatedSeconds={20}
      />
    );

    expect(screen.getByTestId("decision-state-retry")).toBeInTheDocument();
    expect(screen.getByText(/Yeniden Deneniyor/)).toBeInTheDocument();
  });

  // State: override
  it("renders override state for incompatible set override", () => {
    render(
      <DecisionBand
        state="override"
        packSize={2}
      />
    );

    expect(screen.getByTestId("decision-state-override")).toBeInTheDocument();
    expect(screen.getByText("Evet, Render Et")).toBeInTheDocument();
  });

  // State: ready (default)
  it("renders ready state with enabled button", () => {
    const onRender = vi.fn();
    render(
      <DecisionBand
        state="ready"
        packSize={3}
        isQuickPack={true}
        onRender={onRender}
      />
    );

    expect(screen.getByTestId("decision-state-ready")).toBeInTheDocument();
    const button = screen.getByTestId("render-button-ready");
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onRender).toHaveBeenCalled();
  });

  it("shows dirty state warning", () => {
    render(
      <DecisionBand
        state="ready"
        packSize={2}
        isDirty={true}
      />
    );

    expect(screen.getByText(/Değişiklikler kaydedilmedi/)).toBeInTheDocument();
  });

  it("displays estimated time correctly", () => {
    render(
      <DecisionBand
        state="ready"
        packSize={2}
        estimatedSeconds={45}
      />
    );

    expect(screen.getByText("Tahmini süre: ~45s")).toBeInTheDocument();
  });

  it("shows pack info in button text", () => {
    render(
      <DecisionBand
        state="ready"
        packSize={5}
        isQuickPack={false}
      />
    );

    expect(screen.getByText(/5 × Custom/)).toBeInTheDocument();
  });
});
