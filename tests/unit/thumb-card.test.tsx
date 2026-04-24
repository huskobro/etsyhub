import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Thumb, type ThumbKind } from "@/components/ui/Thumb";
import { Card, StatCardBody, AssetCardMeta } from "@/components/ui/Card";

describe("Thumb primitive", () => {
  it("default → kind=neutral + aspect=card + rounded-sm + relative overflow-hidden", () => {
    const { container } = render(<Thumb data-testid="t" />);
    const el = container.querySelector('[data-testid="t"]')!;
    expect(el).toHaveAttribute("data-kind", "neutral");
    expect(el.className).toMatch(/thumb-bg-neutral/);
    expect(el.className).toMatch(/aspect-card/);
    expect(el.className).toMatch(/rounded-sm/);
    expect(el.className).toMatch(/overflow-hidden/);
    expect(el.className).toMatch(/\brelative\b/);
  });

  it("kind matrix — 9 fallback preset class doğru uygulanır", () => {
    const kinds: ThumbKind[] = [
      "boho",
      "christmas",
      "nursery",
      "poster",
      "clipart",
      "sticker",
      "abstract",
      "landscape",
      "neutral",
    ];
    for (const k of kinds) {
      const { container, unmount } = render(<Thumb kind={k} data-testid="t" />);
      const el = container.querySelector('[data-testid="t"]')!;
      expect(el.className).toMatch(new RegExp(`thumb-bg-${k}\\b`));
      expect(el).toHaveAttribute("data-kind", k);
      unmount();
    }
  });

  it("aspect matrix — card/portrait/square", () => {
    const cases: Array<{ a: "card" | "portrait" | "square"; cls: RegExp }> = [
      { a: "card", cls: /aspect-card/ },
      { a: "portrait", cls: /aspect-portrait/ },
      { a: "square", cls: /aspect-square/ },
    ];
    for (const c of cases) {
      const { container, unmount } = render(
        <Thumb aspect={c.a} data-testid="t" />,
      );
      const el = container.querySelector('[data-testid="t"]')!;
      expect(el.className).toMatch(c.cls);
      unmount();
    }
  });

  it("selected=true → ring-2 ring-accent + ring-offset-2 + data-selected", () => {
    const { container } = render(<Thumb selected data-testid="t" />);
    const el = container.querySelector('[data-testid="t"]')!;
    expect(el.className).toMatch(/ring-2/);
    expect(el.className).toMatch(/ring-accent\b/);
    expect(el.className).toMatch(/ring-offset-2/);
    expect(el).toHaveAttribute("data-selected");
  });

  it("hoverable=true → transition-transform + group-hover:scale-subtle (yalnızca yüzey)", () => {
    const { container } = render(<Thumb hoverable data-testid="t" />);
    const el = container.querySelector('[data-testid="t"]')!;
    expect(el.className).toMatch(/transition-transform/);
    expect(el.className).toMatch(/group-hover:scale-subtle/);
  });

  it("hoverable=false default → scale class uygulanmaz (scale sıçraması yasak)", () => {
    const { container } = render(<Thumb data-testid="t" />);
    const el = container.querySelector('[data-testid="t"]')!;
    expect(el.className).not.toMatch(/group-hover:scale/);
    expect(el.className).not.toMatch(/transition-transform/);
  });

  it("label verildiğinde src yokken mono text-subtle placeholder render eder", () => {
    render(<Thumb label="Önizleme yok" />);
    const el = screen.getByText("Önizleme yok");
    expect(el.className).toMatch(/font-mono/);
    expect(el.className).toMatch(/text-text-subtle/);
  });

  it("overlay slot sağ üst köşeye yerleşir", () => {
    render(<Thumb overlay={<span data-testid="ov">●</span>} />);
    const ov = screen.getByTestId("ov");
    expect(ov.parentElement!.className).toMatch(/right-2/);
    expect(ov.parentElement!.className).toMatch(/top-2/);
  });
});

describe("Card primitive — variant matrisi", () => {
  it("default → variant=stat + bg-surface + border-border + rounded-md + shadow-card", () => {
    render(<Card data-testid="c">x</Card>);
    const el = screen.getByTestId("c");
    expect(el).toHaveAttribute("data-variant", "stat");
    expect(el.className).toMatch(/bg-surface\b/);
    expect(el.className).toMatch(/border-border\b/);
    expect(el.className).toMatch(/rounded-md/);
    expect(el.className).toMatch(/shadow-card\b/);
    expect(el.className).toMatch(/\bp-4\b/);
  });

  it("variant=asset → p-0 + overflow-hidden (padding 0, full-bleed yüzey)", () => {
    render(
      <Card variant="asset" data-testid="c">
        x
      </Card>,
    );
    const el = screen.getByTestId("c");
    expect(el.className).toMatch(/\bp-0\b/);
    expect(el.className).toMatch(/overflow-hidden/);
  });

  it("variant=list → flex items-center gap-3 p-3 (yatay sıra)", () => {
    render(
      <Card variant="list" data-testid="c">
        x
      </Card>,
    );
    const el = screen.getByTestId("c");
    expect(el.className).toMatch(/\bflex\b/);
    expect(el.className).toMatch(/items-center/);
    expect(el.className).toMatch(/gap-3/);
    expect(el.className).toMatch(/\bp-3\b/);
  });

  it("interactive=true → hover:border-border-strong + hover:shadow-card-hover (hover discipline)", () => {
    render(
      <Card interactive data-testid="c">
        x
      </Card>,
    );
    const el = screen.getByTestId("c");
    expect(el.className).toMatch(/hover:border-border-strong/);
    expect(el.className).toMatch(/hover:shadow-card-hover/);
    expect(el.className).toMatch(/\bgroup\b/);
    expect(el.className).toMatch(/cursor-pointer/);
    // Kart kutusu scale etmez — sadece Thumb group-hover:scale-subtle alır
    expect(el.className).not.toMatch(/hover:scale/);
    expect(el.className).not.toMatch(/group-hover:scale/);
  });

  it("interactive=true → focus-visible ring accent + keyboard erişilebilir", () => {
    render(
      <Card interactive data-testid="c">
        x
      </Card>,
    );
    const el = screen.getByTestId("c");
    expect(el.className).toMatch(/focus-visible:ring-2/);
    expect(el.className).toMatch(/focus-visible:ring-accent/);
    // Div default ise role=button + tabIndex=0 verilir
    expect(el).toHaveAttribute("role", "button");
    expect(el).toHaveAttribute("tabindex", "0");
  });

  it("interactive=false → hover sınıfları YOK + role/tabIndex yok", () => {
    render(<Card data-testid="c">x</Card>);
    const el = screen.getByTestId("c");
    expect(el.className).not.toMatch(/hover:border-border-strong/);
    expect(el.className).not.toMatch(/hover:shadow-card-hover/);
    expect(el).not.toHaveAttribute("role");
    expect(el).not.toHaveAttribute("tabindex");
  });

  it("selected + list → bg-accent-soft + border-transparent (satır tonu)", () => {
    render(
      <Card variant="list" selected data-testid="c">
        x
      </Card>,
    );
    const el = screen.getByTestId("c");
    expect(el.className).toMatch(/bg-accent-soft/);
    expect(el.className).toMatch(/border-transparent/);
  });

  it("selected + asset → ring-2 ring-accent (outer ring) — bg değişmez", () => {
    render(
      <Card variant="asset" selected data-testid="c">
        x
      </Card>,
    );
    const el = screen.getByTestId("c");
    expect(el.className).toMatch(/ring-2/);
    expect(el.className).toMatch(/ring-accent\b/);
    // asset seçili iken accent-soft bg uygulanmamalı (thumb yüzeyi dokunulmaz)
    expect(el.className).not.toMatch(/bg-accent-soft/);
  });

  it("selected + stat → bg-accent-soft + border-transparent", () => {
    render(
      <Card variant="stat" selected data-testid="c">
        x
      </Card>,
    );
    const el = screen.getByTestId("c");
    expect(el.className).toMatch(/bg-accent-soft/);
    expect(el.className).toMatch(/border-transparent/);
  });

  it("onClick tetiklenir", () => {
    const onClick = vi.fn();
    render(
      <Card interactive onClick={onClick} data-testid="c">
        x
      </Card>,
    );
    fireEvent.click(screen.getByTestId("c"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("as prop ile semantic element override edilir", () => {
    render(
      <Card as="article" data-testid="c">
        x
      </Card>,
    );
    const el = screen.getByTestId("c");
    expect(el.tagName).toBe("ARTICLE");
  });

  it("glass / gradient / pill radius YASAK — sınıflar arasında olmamalı", () => {
    render(<Card data-testid="c">x</Card>);
    const el = screen.getByTestId("c");
    expect(el.className).not.toMatch(/backdrop-blur/);
    expect(el.className).not.toMatch(/bg-gradient/);
    expect(el.className).not.toMatch(/rounded-full\b/);
  });
});

describe("StatCardBody helper", () => {
  it("label mono + tracking-meta + text-muted · value 3xl font-semibold", () => {
    render(<StatCardBody label="Yayın" value="248" />);
    const label = screen.getByText("Yayın");
    const value = screen.getByText("248");
    expect(label.className).toMatch(/font-mono/);
    expect(label.className).toMatch(/tracking-meta/);
    expect(label.className).toMatch(/text-text-muted/);
    expect(value.className).toMatch(/text-3xl/);
    expect(value.className).toMatch(/font-semibold/);
  });

  it("trend slot render edilir", () => {
    render(
      <StatCardBody
        label="x"
        value="1"
        trend={<span data-testid="trend">↑</span>}
      />,
    );
    expect(screen.getByTestId("trend")).toBeInTheDocument();
  });
});

describe("AssetCardMeta helper", () => {
  it("p-3 (spec 12px meta pad) + space-y-1", () => {
    render(<AssetCardMeta data-testid="m">x</AssetCardMeta>);
    const el = screen.getByTestId("m");
    expect(el.className).toMatch(/\bp-3\b/);
    expect(el.className).toMatch(/space-y-1/);
  });
});
