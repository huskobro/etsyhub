/**
 * admin-rollout-bar.test.tsx
 *
 * Yerel RolloutBar bileşeni — T-26 spec doğrulaması.
 *
 * Senaryolar:
 *   1. percent=50 → role="progressbar", aria-valuenow="50", width %50
 *   2. percent=100 → bg-success uygulanır (doldurulmuş)
 *   3. percent=0 → label "0%"
 *   4. percent=-10 → clamp 0
 *   5. percent=120 → clamp 100
 *   6. aria-label forward edilir
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RolloutBar } from "@/features/admin/feature-flags/_shared/rollout-bar";

describe("RolloutBar (yerel)", () => {
  it("percent=50 → role='progressbar', aria-valuenow='50', görsel %50 width", () => {
    const { container } = render(<RolloutBar percent={50} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");

    // inline style ile genişlik uygulanmış olmalı
    const fill = container.querySelector("[style*='width']") as HTMLElement | null;
    expect(fill).not.toBeNull();
    expect(fill!.style.width).toBe("50%");

    // label
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("percent=100 → bg-success class doldurulmuş stilde uygulanır", () => {
    const { container } = render(<RolloutBar percent={100} />);
    const fill = container.querySelector("[style*='width']") as HTMLElement | null;
    expect(fill).not.toBeNull();
    expect(fill!.className).toContain("bg-success");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("percent=0 → label '0%' görünür", () => {
    render(<RolloutBar percent={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
  });

  it("percent=-10 → clamp 0", () => {
    const { container } = render(<RolloutBar percent={-10} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    const fill = container.querySelector("[style*='width']") as HTMLElement | null;
    expect(fill!.style.width).toBe("0%");
  });

  it("percent=120 → clamp 100", () => {
    const { container } = render(<RolloutBar percent={120} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    const fill = container.querySelector("[style*='width']") as HTMLElement | null;
    expect(fill!.style.width).toBe("100%");
  });

  it("aria-label forward edilir", () => {
    render(<RolloutBar percent={42} aria-label="Rollout yüzdesi wall_art" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-label", "Rollout yüzdesi wall_art");
  });
});
