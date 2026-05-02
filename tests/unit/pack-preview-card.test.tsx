import { vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PackPreviewCard } from "@/features/mockups/components/PackPreviewCard";

describe("PackPreviewCard", () => {
  const mockTemplates = [
    { id: "t1", name: "Canvas Classic", category: "canvas" },
    { id: "t2", name: "Frame Modern", category: "frame" },
    { id: "t3", name: "Print Minimal", category: "print" },
  ];

  it("renders Quick Pack badge", () => {
    render(
      <PackPreviewCard
        isQuickPack={true}
        selectedTemplateIds={["t1"]}
        templates={mockTemplates}
      />
    );

    expect(screen.getByTestId("pack-badge")).toHaveTextContent("Quick Pack");
  });

  it("renders Custom Pack badge when not quick", () => {
    render(
      <PackPreviewCard
        isQuickPack={false}
        selectedTemplateIds={["t1"]}
        templates={mockTemplates}
      />
    );

    expect(screen.getByTestId("pack-badge")).toHaveTextContent("Custom Pack");
  });

  it("shows EmptyPackState when no templates selected", () => {
    render(
      <PackPreviewCard
        isQuickPack={true}
        selectedTemplateIds={[]}
        templates={mockTemplates}
      />
    );

    expect(screen.getByTestId("empty-pack-state")).toBeInTheDocument();
    expect(screen.getByText("Template seçimi yapılmadı")).toBeInTheDocument();
  });

  it("displays selected templates as chips", () => {
    render(
      <PackPreviewCard
        isQuickPack={true}
        selectedTemplateIds={["t1", "t2"]}
        templates={mockTemplates}
      />
    );

    expect(screen.getByTestId("template-chip-t1")).toBeInTheDocument();
    expect(screen.getByTestId("template-chip-t2")).toBeInTheDocument();
  });

  it("shows incompatible warning when set", () => {
    render(
      <PackPreviewCard
        isQuickPack={true}
        selectedTemplateIds={["t1"]}
        templates={mockTemplates}
        incompatibleTemplateIds={["t2"]}
        incompatibleReason="Boyut uyumsuzluğu"
      />
    );

    expect(screen.getByTestId("incompatible-set-band")).toBeInTheDocument();
    expect(screen.getByText("Boyut uyumsuzluğu")).toBeInTheDocument();
  });

  it("calls onOpenCustomize when customize button clicked", () => {
    const onOpenCustomize = vi.fn();
    render(
      <PackPreviewCard
        isQuickPack={false}
        selectedTemplateIds={["t1"]}
        templates={mockTemplates}
        onOpenCustomize={onOpenCustomize}
      />
    );

    fireEvent.click(screen.getByTestId("open-customize-button"));
    expect(onOpenCustomize).toHaveBeenCalledTimes(1);
  });

  it("calls onTemplateSelect when template chip clicked", () => {
    const onTemplateSelect = vi.fn();
    render(
      <PackPreviewCard
        isQuickPack={true}
        selectedTemplateIds={["t1"]}
        templates={mockTemplates}
        onTemplateSelect={onTemplateSelect}
      />
    );

    fireEvent.click(screen.getByTestId("template-chip-t1"));
    expect(onTemplateSelect).toHaveBeenCalledWith("t1", false);
  });
});
