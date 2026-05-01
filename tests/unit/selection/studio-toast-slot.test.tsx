// Phase 7 Task 39 — StudioToastSlot testleri.
//
// Sözleşme (plan Task 39):
//   - 0 toast → null render (DOM'da slot yok).
//   - 1+ toast → fixed bottom-right konumlu container içinde Toast primitive.
//   - Click toast → dismiss (store'dan kaldırılır).
//   - Auto-dismiss 5sn (vi.useFakeTimers).
//
// Toast primitive role tone'a göre: success/info → role="status",
// error → role="alert" (Phase 6 baseline; primitive değiştirilmez).

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { StudioToastSlot } from "@/features/selection/components/StudioToastSlot";
import { useSelectionStudioToasts } from "@/features/selection/stores/toast-store";

function reset() {
  useSelectionStudioToasts.setState({ toasts: [] });
}

beforeEach(() => reset());
afterEach(() => {
  vi.useRealTimers();
  reset();
});

describe("StudioToastSlot — empty state", () => {
  it("0 toast → null render", () => {
    const { container } = render(<StudioToastSlot />);
    expect(container.firstChild).toBeNull();
  });
});

describe("StudioToastSlot — render toasts", () => {
  it("1 success toast → role='status' Toast görünür", () => {
    render(<StudioToastSlot />);
    act(() => {
      useSelectionStudioToasts
        .getState()
        .push({ tone: "success", message: "Background remove tamamlandı" });
    });
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByText("Background remove tamamlandı"),
    ).toBeInTheDocument();
  });

  it("error toast → role='alert' Toast görünür", () => {
    render(<StudioToastSlot />);
    act(() => {
      useSelectionStudioToasts
        .getState()
        .push({ tone: "error", message: "Export başarısız" });
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Export başarısız")).toBeInTheDocument();
  });

  it("birden fazla toast → hepsi görünür", () => {
    render(<StudioToastSlot />);
    act(() => {
      const push = useSelectionStudioToasts.getState().push;
      push({ tone: "success", message: "A tamam" });
      push({ tone: "info", message: "B bilgi" });
    });
    expect(screen.getByText("A tamam")).toBeInTheDocument();
    expect(screen.getByText("B bilgi")).toBeInTheDocument();
  });

  it("container fixed bottom-right + z-50 token sınıfları içerir", () => {
    render(<StudioToastSlot />);
    act(() => {
      useSelectionStudioToasts
        .getState()
        .push({ tone: "info", message: "x" });
    });
    // Container: en yakın "fixed" wrapper
    const toast = screen.getByText("x");
    const container = toast.closest("div.fixed");
    expect(container).not.toBeNull();
    expect(container!.className).toContain("fixed");
    expect(container!.className).toContain("bottom-4");
    expect(container!.className).toContain("right-4");
    expect(container!.className).toContain("z-50");
  });
});

describe("StudioToastSlot — click dismiss", () => {
  it("Toast'a tıklayınca store'dan kaldırılır", () => {
    render(<StudioToastSlot />);
    act(() => {
      useSelectionStudioToasts
        .getState()
        .push({ tone: "info", message: "Tıkla beni" });
    });
    const dismissBtn = screen.getByRole("button", {
      name: /Bildirimi kapat: Tıkla beni/,
    });
    fireEvent.click(dismissBtn);
    expect(useSelectionStudioToasts.getState().toasts).toHaveLength(0);
  });
});

describe("StudioToastSlot — auto-dismiss 5sn", () => {
  it("5sn sonra toast otomatik kalkar", () => {
    vi.useFakeTimers();
    render(<StudioToastSlot />);
    act(() => {
      useSelectionStudioToasts
        .getState()
        .push({ tone: "info", message: "auto-dismiss" });
    });
    expect(screen.getByText("auto-dismiss")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(useSelectionStudioToasts.getState().toasts).toHaveLength(0);
  });

  it("5sn dolmadan toast kalkmaz", () => {
    vi.useFakeTimers();
    render(<StudioToastSlot />);
    act(() => {
      useSelectionStudioToasts
        .getState()
        .push({ tone: "info", message: "yet-here" });
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(useSelectionStudioToasts.getState().toasts).toHaveLength(1);
  });
});
