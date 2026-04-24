import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Badge, Tag } from "@/components/ui/Badge";
import { Chip } from "@/components/ui/Chip";

describe("Badge primitive", () => {
  it("default → tone=neutral · mono · tracking-meta · normal-case · radius sm · 20h", () => {
    render(<Badge>Clipart</Badge>);
    const el = screen.getByText("Clipart");
    expect(el.className).toMatch(/font-mono/);
    expect(el.className).toMatch(/tracking-meta/);
    expect(el.className).toMatch(/normal-case/);
    expect(el.className).toMatch(/rounded-sm/);
    expect(el.className).toMatch(/\bh-5\b/);
    expect(el.className).toMatch(/bg-surface-2/);
    expect(el.className).toMatch(/text-text-muted/);
  });

  it("tone matrix — neutral/accent/success/warning/danger/info doğru bg/text", () => {
    const cases = [
      { tone: "neutral" as const, bg: /bg-surface-2/, text: /text-text-muted/ },
      { tone: "accent" as const, bg: /bg-accent-soft/, text: /text-accent-text/ },
      { tone: "success" as const, bg: /bg-success-soft/, text: /text-success/ },
      { tone: "warning" as const, bg: /bg-warning-soft/, text: /text-warning/ },
      { tone: "danger" as const, bg: /bg-danger-soft/, text: /text-danger/ },
      { tone: "info" as const, bg: /bg-info-soft/, text: /text-info/ },
    ];
    for (const c of cases) {
      const { unmount } = render(<Badge tone={c.tone}>{c.tone}</Badge>);
      const el = screen.getByText(c.tone);
      expect(el.className).toMatch(c.bg);
      expect(el.className).toMatch(c.text);
      unmount();
    }
  });

  it("title-case kilidi — uppercase/capitalize utility eklenmez, children olduğu gibi render edilir", () => {
    render(<Badge>iPhone case</Badge>);
    const el = screen.getByText("iPhone case");
    expect(el.className).not.toMatch(/\buppercase\b/);
    expect(el.className).not.toMatch(/\bcapitalize\b/);
    expect(el.textContent).toBe("iPhone case");
  });

  it("dot slot açıkken aria-hidden leading dot render eder", () => {
    const { container } = render(<Badge tone="success" dot>Yayında</Badge>);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    expect(dot!.className).toMatch(/rounded-full/);
    expect(dot!.className).toMatch(/bg-current/);
  });

  it("dot kapalıyken dot render edilmez", () => {
    const { container } = render(<Badge tone="success">Yayında</Badge>);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("ref HTMLSpanElement olarak forward edilir", () => {
    let got: HTMLSpanElement | null = null;
    render(
      <Badge
        ref={(el) => {
          got = el;
        }}
      >
        x
      </Badge>,
    );
    expect(got).toBeInstanceOf(HTMLSpanElement);
  });
});

describe("Tag alias", () => {
  it("Tag = Badge tone=neutral — surface-2 + text-muted", () => {
    render(<Tag>Clipart</Tag>);
    const el = screen.getByText("Clipart");
    expect(el.className).toMatch(/bg-surface-2/);
    expect(el.className).toMatch(/text-text-muted/);
    expect(el.className).toMatch(/font-mono/);
  });
});

describe("Chip primitive", () => {
  it("default (inactive) — bg-surface + text-text + border-border, aria-pressed=false", () => {
    render(<Chip>Wall art</Chip>);
    const btn = screen.getByRole("button", { name: "Wall art" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveAttribute("type", "button");
    expect(btn.className).toMatch(/bg-surface\b/);
    expect(btn.className).toMatch(/text-text\b/);
    expect(btn.className).toMatch(/border-border\b/);
    expect(btn.className).toMatch(/h-control-sm/);
  });

  it("active=true → bg-accent-soft + text-accent-text + border-transparent + aria-pressed=true", () => {
    render(<Chip active>Nursery</Chip>);
    const btn = screen.getByRole("button", { name: "Nursery" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn.className).toMatch(/bg-accent-soft/);
    expect(btn.className).toMatch(/text-accent-text/);
    expect(btn.className).toMatch(/border-transparent/);
  });

  it("onToggle tıklanınca çağrılır", () => {
    const onToggle = vi.fn();
    render(<Chip onToggle={onToggle}>x</Chip>);
    fireEvent.click(screen.getByRole("button", { name: "x" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("onRemove verildiğinde kaldır slotu render olur ve tıklanınca onToggle tetiklenmez", () => {
    const onToggle = vi.fn();
    const onRemove = vi.fn();
    render(
      <Chip active onToggle={onToggle} onRemove={onRemove}>
        Halloween
      </Chip>,
    );
    const removeSlot = screen.getByLabelText("Kaldır");
    fireEvent.click(removeSlot);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("onRemove yokken kaldır slotu render edilmez + simetrik padding px-2.5 uygulanır", () => {
    render(<Chip>Minimal</Chip>);
    expect(screen.queryByLabelText("Kaldır")).toBeNull();
    const btn = screen.getByRole("button", { name: "Minimal" });
    expect(btn.className).toMatch(/px-2\.5/);
  });

  it("onRemove varken asimetrik padding pl-2.5 pr-1 uygulanır", () => {
    render(
      <Chip onRemove={() => void 0}>
        Boho
      </Chip>,
    );
    const btn = screen.getByRole("button", { name: "Boho" });
    expect(btn.className).toMatch(/pl-2\.5/);
    expect(btn.className).toMatch(/pr-1/);
  });

  it("disabled → button disabled + opacity-50 + cursor-not-allowed", () => {
    render(<Chip disabled>x</Chip>);
    const btn = screen.getByRole("button", { name: "x" });
    expect(btn).toBeDisabled();
    expect(btn.className).toMatch(/disabled:opacity-50/);
    expect(btn.className).toMatch(/disabled:cursor-not-allowed/);
  });

  it("focus-visible ring accent + offset-bg uygulanır", () => {
    render(<Chip>x</Chip>);
    const btn = screen.getByRole("button", { name: "x" });
    expect(btn.className).toMatch(/focus-visible:ring-2/);
    expect(btn.className).toMatch(/focus-visible:ring-accent/);
    expect(btn.className).toMatch(/focus-visible:ring-offset-bg/);
  });

  it("ref HTMLButtonElement olarak forward edilir", () => {
    let got: HTMLButtonElement | null = null;
    render(
      <Chip
        ref={(el) => {
          got = el;
        }}
      >
        x
      </Chip>,
    );
    expect(got).toBeInstanceOf(HTMLButtonElement);
  });
});
