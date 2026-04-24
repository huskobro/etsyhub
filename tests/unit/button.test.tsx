import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/Button";

describe("Button primitive", () => {
  it("default variant secondary + size md, button tipi button", () => {
    render(<Button>Ekle</Button>);
    const btn = screen.getByRole("button", { name: "Ekle" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn.className).toMatch(/bg-surface/);
    expect(btn.className).toMatch(/border-border\b/);
    expect(btn.className).toMatch(/h-control-md/);
  });

  it("variant primary → accent bg + accent-foreground", () => {
    render(<Button variant="primary">Yeni</Button>);
    const btn = screen.getByRole("button", { name: "Yeni" });
    expect(btn.className).toMatch(/bg-accent\b/);
    expect(btn.className).toMatch(/text-accent-foreground/);
    expect(btn.className).toMatch(/hover:bg-accent-hover/);
  });

  it("variant destructive → danger text, surface bg (fill DEĞİL)", () => {
    render(<Button variant="destructive">Sil</Button>);
    const btn = screen.getByRole("button", { name: "Sil" });
    expect(btn.className).toMatch(/text-danger\b/);
    expect(btn.className).toMatch(/bg-surface\b/);
    expect(btn.className).not.toMatch(/bg-danger\b(?!-)/);
  });

  it.each([
    ["sm", "h-control-sm"],
    ["md", "h-control-md"],
    ["lg", "h-control-lg"],
  ] as const)("size %s → height class %s", (size, cls) => {
    render(<Button size={size}>Buton</Button>);
    const btn = screen.getByRole("button", { name: "Buton" });
    expect(btn.className).toMatch(new RegExp(cls));
  });

  it("icon-only (children yok) → kare ölçü (p-0 + width class)", () => {
    render(<Button aria-label="daha fazla" icon={<span data-testid="icn" />} />);
    const btn = screen.getByRole("button", { name: "daha fazla" });
    expect(btn.className).toMatch(/\bp-0\b/);
    expect(btn.className).toMatch(/w-control-md/);
    expect(btn.className).not.toMatch(/px-/);
    expect(screen.getByTestId("icn")).toBeInTheDocument();
  });

  it("icon-only sm ve lg ayrı kare ölçü", () => {
    const { rerender } = render(
      <Button size="sm" aria-label="s" icon={<span />} />,
    );
    expect(screen.getByRole("button", { name: "s" }).className).toMatch(/w-control-sm/);
    rerender(<Button size="lg" aria-label="l" icon={<span />} />);
    expect(screen.getByRole("button", { name: "l" }).className).toMatch(/w-control-lg/);
  });

  it("text varsa icon-only değil → padding class var, width yok", () => {
    render(<Button icon={<span />}>Ekle</Button>);
    const btn = screen.getByRole("button", { name: "Ekle" });
    expect(btn.className).toMatch(/px-/);
    expect(btn.className).not.toMatch(/\bw-control-md\b/);
  });

  it("loading → spinner gösterir, icon'u gizler, aria-busy=true, disabled", () => {
    render(
      <Button loading icon={<span data-testid="icn" />}>
        Kaydet
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Kaydet" });
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
    expect(screen.queryByTestId("icn")).toBeNull();
    expect(btn.querySelector(".animate-spin")).not.toBeNull();
  });

  it("disabled → tıklama tetiklenmez", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Kaydet
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading iconRight'ı da gizler", () => {
    render(
      <Button loading iconRight={<span data-testid="right" />}>
        İleri
      </Button>,
    );
    expect(screen.queryByTestId("right")).toBeNull();
  });

  it("focus-visible accent ring class'ı taşır", () => {
    render(<Button>Odak</Button>);
    const btn = screen.getByRole("button", { name: "Odak" });
    expect(btn.className).toMatch(/focus-visible:ring-2/);
    expect(btn.className).toMatch(/focus-visible:ring-accent\b/);
    expect(btn.className).toMatch(/focus-visible:ring-offset-2/);
  });

  it("custom className merge — tailwind-merge çakışmayı çözer", () => {
    render(<Button className="bg-surface-2">Özel</Button>);
    const btn = screen.getByRole("button", { name: "Özel" });
    expect(btn.className).toMatch(/bg-surface-2/);
    expect(btn.className).not.toMatch(/bg-surface\b(?!-)/);
  });

  it("ref forward edilir", () => {
    let got: HTMLButtonElement | null = null;
    render(
      <Button
        ref={(el) => {
          got = el;
        }}
      >
        Ref
      </Button>,
    );
    expect(got).toBeInstanceOf(HTMLButtonElement);
  });
});
