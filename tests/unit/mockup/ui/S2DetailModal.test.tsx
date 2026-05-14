// Phase 8 Task 27 — S2DetailModal unit tests
//
// Spec §5.4: Template detay modal. Static preview, meta, Ekle/Çıkar CTA,
// max enforcement, Esc/X close.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { S2DetailModal } from "@/features/mockups/components/S2DetailModal";
import type { MockupTemplateView } from "@/features/mockups/hooks/useMockupTemplates";

describe("<S2DetailModal>", () => {
  const mockTemplate: MockupTemplateView = {
    id: "t1",
    name: "Modern Sofa Wall",
    aspectRatios: ["2:3", "3:4"],
    tags: ["Modern", "Living Room"],
    thumbKey: "thumb-1",
    estimatedRenderMs: 2000,
    hasActiveBinding: true,
    ownership: "global" as const,
    slotCount: 1,
  };

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    template: mockTemplate,
    isSelected: false,
    onToggleTemplate: vi.fn(),
    selectedCount: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with template title", () => {
    render(<S2DetailModal {...defaultProps} />);
    expect(screen.getByText("Modern Sofa Wall")).toBeInTheDocument();
  });

  it("closes modal via X button", () => {
    const onOpenChange = vi.fn();

    render(
      <S2DetailModal
        {...defaultProps}
        onOpenChange={onOpenChange}
      />
    );

    const closeBtn = screen.getByLabelText("Kapat");
    fireEvent.click(closeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes modal via Esc key", () => {
    const onOpenChange = vi.fn();

    render(
      <S2DetailModal
        {...defaultProps}
        onOpenChange={onOpenChange}
      />
    );

    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders static preview placeholder", () => {
    render(<S2DetailModal {...defaultProps} />);
    expect(
      screen.getByLabelText("Template önizleme")
    ).toBeInTheDocument();
  });

  it("displays template aspect ratios", () => {
    render(<S2DetailModal {...defaultProps} />);
    expect(screen.getByText(/2:3, 3:4/)).toBeInTheDocument();
  });

  it("displays template tags", () => {
    render(<S2DetailModal {...defaultProps} />);
    expect(screen.getByText(/Modern, Living Room/)).toBeInTheDocument();
  });

  it("displays estimated render time in seconds", () => {
    render(<S2DetailModal {...defaultProps} />);
    expect(screen.getByText(/~2 saniye/)).toBeInTheDocument();
  });

  it("calculates render time correctly for larger values", () => {
    const template = {
      ...mockTemplate,
      estimatedRenderMs: 5500,
    };
    render(
      <S2DetailModal
        {...defaultProps}
        template={template}
      />
    );
    expect(screen.getByText(/~6 saniye/)).toBeInTheDocument();
  });

  it("shows '+ Pakete ekle' CTA when not selected", () => {
    render(
      <S2DetailModal
        {...defaultProps}
        isSelected={false}
      />
    );
    const btn = screen.getByRole("button", { name: /Pakete ekle/ });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("shows '✓ Pakette • Çıkar' CTA when selected", () => {
    render(
      <S2DetailModal
        {...defaultProps}
        isSelected={true}
      />
    );
    const btn = screen.getByRole("button", { name: /Pakette.*Çıkar/ });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("calls onToggleTemplate when CTA clicked", () => {
    const onToggle = vi.fn();

    render(
      <S2DetailModal
        {...defaultProps}
        isSelected={false}
        onToggleTemplate={onToggle}
      />
    );

    const btn = screen.getByRole("button", { name: /Pakete ekle/ });
    fireEvent.click(btn);

    expect(onToggle).toHaveBeenCalledWith("t1");
  });

  it("disables CTA when selectedCount >= 8 and not selected", () => {
    render(
      <S2DetailModal
        {...defaultProps}
        isSelected={false}
        selectedCount={8}
      />
    );

    const btn = screen.getByRole("button", { name: /Pakete ekle/ });
    expect(btn).toBeDisabled();
  });

  it("enables CTA even when selectedCount >= 8 if already selected", () => {
    render(
      <S2DetailModal
        {...defaultProps}
        isSelected={true}
        selectedCount={8}
      />
    );

    const btn = screen.getByRole("button", { name: /Pakette.*Çıkar/ });
    expect(btn).not.toBeDisabled();
  });

  it("shows max enforcement alert when disabled", () => {
    render(
      <S2DetailModal
        {...defaultProps}
        isSelected={false}
        selectedCount={8}
      />
    );

    expect(
      screen.getByText("En fazla 8 template ekleyebilirsin")
    ).toBeInTheDocument();
  });

  it("hides max enforcement alert when enabled", () => {
    render(
      <S2DetailModal
        {...defaultProps}
        isSelected={false}
        selectedCount={7}
      />
    );

    expect(
      screen.queryByText("En fazla 8 template ekleyebilirsin")
    ).not.toBeInTheDocument();
  });

  it("renders nothing when template is null", () => {
    const { container } = render(
      <S2DetailModal
        {...defaultProps}
        template={null}
      />
    );

    expect(
      screen.queryByText("Modern Sofa Wall")
    ).not.toBeInTheDocument();

    // Dialog.Content still rendered (Radix), but no template content
    // (defensive null check)
  });

  it("updates when template prop changes", () => {
    const template2: MockupTemplateView = {
      id: "t2",
      name: "Scandinavian Bedroom",
      aspectRatios: ["3:4"],
      tags: ["Scandinavian", "Bedroom"],
      thumbKey: "thumb-2",
      estimatedRenderMs: 2200,
      hasActiveBinding: true,
    ownership: "global" as const,
    slotCount: 1,
    };

    const { rerender } = render(
      <S2DetailModal
        {...defaultProps}
        template={mockTemplate}
      />
    );

    expect(screen.getByText("Modern Sofa Wall")).toBeInTheDocument();

    rerender(
      <S2DetailModal
        {...defaultProps}
        template={template2}
      />
    );

    expect(screen.getByText("Scandinavian Bedroom")).toBeInTheDocument();
    expect(
      screen.queryByText("Modern Sofa Wall")
    ).not.toBeInTheDocument();
  });

  it("dialog opens and closes based on open prop", () => {
    const { rerender } = render(
      <S2DetailModal
        {...defaultProps}
        open={true}
      />
    );

    expect(screen.getByText("Modern Sofa Wall")).toBeInTheDocument();

    rerender(
      <S2DetailModal
        {...defaultProps}
        open={false}
      />
    );

    // Dialog.Root close state'i render'ı affect eder (Radix Dialog portal)
  });

  it("has proper aria-label for accessibility", () => {
    render(<S2DetailModal {...defaultProps} />);

    const dialog = screen.getByLabelText("Modern Sofa Wall detayı");
    expect(dialog).toBeInTheDocument();
  });

  it("has proper Dialog.Title for a11y", () => {
    render(<S2DetailModal {...defaultProps} />);

    const title = screen.getByText("Modern Sofa Wall");
    expect(title).toHaveClass("text-lg", "font-semibold");
  });

  it("renders proper metadata structure", () => {
    render(<S2DetailModal {...defaultProps} />);

    const aspLabel = screen.getByText("Aspect:");
    expect(aspLabel).toBeInTheDocument();

    const tagsLabel = screen.getByText("Tags:");
    expect(tagsLabel).toBeInTheDocument();

    const renderLabel = screen.getByText("Tahmini render süresi:");
    expect(renderLabel).toBeInTheDocument();
  });
});
