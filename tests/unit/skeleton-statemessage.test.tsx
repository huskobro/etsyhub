import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Skeleton,
  SkeletonCardGrid,
  SkeletonTable,
} from "@/components/ui/Skeleton";
import { StateMessage } from "@/components/ui/StateMessage";

describe("Skeleton primitive", () => {
  it("default → bg-surface-3 + animate-ehPulse + aria-hidden (shimmer YOK)", () => {
    const { container } = render(<Skeleton data-testid="sk" />);
    const el = container.querySelector('[data-testid="sk"]')!;
    expect(el.className).toMatch(/bg-surface-3/);
    expect(el.className).toMatch(/animate-ehPulse/);
    // shimmer/gradient yasak — bg-gradient / animate-pulse (tailwind default) asla uygulanmamalı
    expect(el.className).not.toMatch(/bg-gradient/);
    expect(el.className).not.toMatch(/\banimate-pulse\b/);
    expect(el).toHaveAttribute("aria-hidden");
  });

  it("shape=line → h-3 w-full rounded-sm", () => {
    const { container } = render(<Skeleton shape="line" data-testid="sk" />);
    const el = container.querySelector('[data-testid="sk"]')!;
    expect(el.className).toMatch(/\bh-3\b/);
    expect(el.className).toMatch(/\bw-full\b/);
    expect(el.className).toMatch(/rounded-sm/);
  });

  it("shape=circle → h-8 w-8 rounded-full", () => {
    const { container } = render(<Skeleton shape="circle" data-testid="sk" />);
    const el = container.querySelector('[data-testid="sk"]')!;
    expect(el.className).toMatch(/\bh-8\b/);
    expect(el.className).toMatch(/\bw-8\b/);
    expect(el.className).toMatch(/rounded-full/);
  });

  it("className eklenebilir + shape sınıfları ile birleşir", () => {
    const { container } = render(
      <Skeleton shape="text" className="w-1/2" data-testid="sk" />,
    );
    const el = container.querySelector('[data-testid="sk"]')!;
    expect(el.className).toMatch(/\bw-1\/2\b/);
    expect(el.className).toMatch(/\bh-4\b/);
  });
});

describe("SkeletonCardGrid defaults", () => {
  it("spec default → 6 sabit kart (shimmer/random sayı YOK)", () => {
    const { container } = render(<SkeletonCardGrid />);
    // Her kart kendi iskelet kutusudur — kart = grid item, doğrudan child
    const grid = screen.getByRole("status", { name: "Yükleniyor" });
    expect(grid.children.length).toBe(6);
    // Grid container class
    expect(grid.className).toMatch(/\bgrid\b/);
    expect(grid.className).toMatch(/grid-cols-2/);
    // Her kart içinde aspect-card thumbnail skeleton var
    const aspectCards = container.querySelectorAll(".aspect-card");
    expect(aspectCards.length).toBe(6);
  });

  it("count override edilebilir ama default kilitli", () => {
    const { rerender } = render(<SkeletonCardGrid count={3} />);
    expect(
      screen.getByRole("status", { name: "Yükleniyor" }).children.length,
    ).toBe(3);
    rerender(<SkeletonCardGrid />);
    expect(
      screen.getByRole("status", { name: "Yükleniyor" }).children.length,
    ).toBe(6);
  });
});

describe("SkeletonTable defaults", () => {
  it("spec default → 5 sabit satır", () => {
    render(<SkeletonTable />);
    const table = screen.getByRole("status", { name: "Yükleniyor" });
    expect(table.children.length).toBe(5);
  });

  it("default 4 kolon + row h-12 (admin density)", () => {
    render(<SkeletonTable />);
    const table = screen.getByRole("status", { name: "Yükleniyor" });
    const firstRow = table.children[0] as HTMLElement;
    expect(firstRow.className).toMatch(/\bh-12\b/);
    // 4 skeleton cell
    expect(firstRow.children.length).toBe(4);
  });

  it("rows/columns override edilebilir", () => {
    render(<SkeletonTable rows={3} columns={6} />);
    const table = screen.getByRole("status", { name: "Yükleniyor" });
    expect(table.children.length).toBe(3);
    expect((table.children[0] as HTMLElement).children.length).toBe(6);
  });
});

describe("StateMessage primitive", () => {
  it("default tone=neutral → icon box surface-2 + text-text-muted, role=status", () => {
    render(
      <StateMessage
        icon={<span data-testid="icon" />}
        title="Henüz içerik yok"
      />,
    );
    const root = screen.getByRole("status");
    expect(root.textContent).toContain("Henüz içerik yok");
    const iconBox = screen.getByTestId("icon").parentElement!;
    expect(iconBox.className).toMatch(/bg-surface-2/);
    expect(iconBox.className).toMatch(/text-text-muted/);
    expect(iconBox.className).toMatch(/\bh-10\b/);
    expect(iconBox.className).toMatch(/\bw-10\b/);
    expect(iconBox.className).toMatch(/rounded-md/);
    expect(iconBox).toHaveAttribute("aria-hidden");
  });

  it("tone matrix — neutral/warning/error doğru icon bg + text", () => {
    const cases = [
      { tone: "neutral" as const, bg: /bg-surface-2/, text: /text-text-muted/ },
      {
        tone: "warning" as const,
        bg: /bg-warning-soft/,
        text: /text-warning/,
      },
      { tone: "error" as const, bg: /bg-danger-soft/, text: /text-danger/ },
    ];
    for (const c of cases) {
      const { unmount } = render(
        <StateMessage
          tone={c.tone}
          icon={<span data-testid={`ic-${c.tone}`} />}
          title="t"
        />,
      );
      const iconBox = screen.getByTestId(`ic-${c.tone}`).parentElement!;
      expect(iconBox.className).toMatch(c.bg);
      expect(iconBox.className).toMatch(c.text);
      unmount();
    }
  });

  it("tone=error → role=alert + aria-live=assertive", () => {
    render(<StateMessage tone="error" title="Kırıldı" />);
    const root = screen.getByRole("alert");
    expect(root).toHaveAttribute("aria-live", "assertive");
  });

  it("tone=neutral/warning → role=status + aria-live=polite", () => {
    const { rerender } = render(<StateMessage tone="neutral" title="x" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    rerender(<StateMessage tone="warning" title="x" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("body max-w-state-body + text-sm muted (spec 360 kilit)", () => {
    render(<StateMessage title="t" body="açıklama" />);
    const body = screen.getByText("açıklama");
    expect(body.className).toMatch(/max-w-state-body/);
    expect(body.className).toMatch(/\btext-sm\b/);
    expect(body.className).toMatch(/text-text-muted/);
  });

  it("body/action/icon yoksa DOM'da yer tutmaz", () => {
    render(<StateMessage title="Sadece başlık" />);
    expect(screen.queryByText("açıklama")).toBeNull();
    // tek text: title; icon yoksa aria-hidden kutu da yok
    const root = screen.getByRole("status");
    expect(root.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
  });

  it("action render edilir (CTA)", () => {
    render(
      <StateMessage
        title="t"
        action={<button data-testid="cta">CTA</button>}
      />,
    );
    expect(screen.getByTestId("cta")).toBeInTheDocument();
  });

  it("title 15/600 (text-md + font-semibold)", () => {
    render(<StateMessage title="Başlık" />);
    const title = screen.getByText("Başlık");
    expect(title.className).toMatch(/text-md/);
    expect(title.className).toMatch(/font-semibold/);
    expect(title.className).toMatch(/text-text\b/);
  });

  it("dış kapsayıcı py-12 px-6 (spec 48/24)", () => {
    render(<StateMessage title="x" />);
    const root = screen.getByRole("status");
    expect(root.className).toMatch(/\bpy-12\b/);
    expect(root.className).toMatch(/\bpx-6\b/);
    expect(root.className).toMatch(/text-center/);
  });
});
