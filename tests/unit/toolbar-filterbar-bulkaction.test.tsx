import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Toolbar, ToolbarDivider } from "@/components/ui/Toolbar";
import { FilterBar } from "@/components/ui/FilterBar";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { Chip } from "@/components/ui/Chip";

describe("Toolbar primitive", () => {
  it("default → role=toolbar · flex flex-wrap items-center gap-2 · border YOK (PageShell slot bandı veriyor)", () => {
    const { container } = render(<Toolbar>x</Toolbar>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute("role", "toolbar");
    expect(el.className).toMatch(/\bflex\b/);
    expect(el.className).toMatch(/flex-wrap/);
    expect(el.className).toMatch(/items-center/);
    expect(el.className).toMatch(/gap-2/);
    // border toolbar'a ait değil — standalone false default
    expect(el.className).not.toMatch(/border-border-subtle/);
    expect(el.className).not.toMatch(/rounded-md/);
  });

  it("standalone=true → rounded-md border border-border-subtle + px-3 py-2", () => {
    const { container } = render(<Toolbar standalone>x</Toolbar>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/rounded-md/);
    expect(el.className).toMatch(/border-border-subtle/);
    expect(el.className).toMatch(/bg-surface\b/);
    expect(el.className).toMatch(/\bpx-3\b/);
    expect(el.className).toMatch(/\bpy-2\b/);
  });

  it("leading + children → aralarına ToolbarDivider otomatik yerleşir", () => {
    const { container } = render(
      <Toolbar leading={<span data-testid="lead">L</span>}>
        <span data-testid="mid">M</span>
      </Toolbar>,
    );
    const divider = container.querySelector('span[aria-hidden].bg-border');
    expect(divider).toBeInTheDocument();
    expect(divider!.className).toMatch(/h-5/);
    expect(divider!.className).toMatch(/w-px/);
  });

  it("leading yok → ToolbarDivider otomatik yerleşmez", () => {
    const { container } = render(
      <Toolbar>
        <span>M</span>
      </Toolbar>,
    );
    const divider = container.querySelector('span[aria-hidden].bg-border');
    expect(divider).toBeNull();
  });

  it("trailing → ml-auto flex items-center gap-2 ile sağa yapışır", () => {
    render(
      <Toolbar trailing={<button data-testid="act">A</button>}>x</Toolbar>,
    );
    const trailingHost = screen.getByTestId("act").parentElement!;
    expect(trailingHost.className).toMatch(/ml-auto/);
    expect(trailingHost.className).toMatch(/\bflex\b/);
    expect(trailingHost.className).toMatch(/items-center/);
    expect(trailingHost.className).toMatch(/gap-2/);
  });

  it("ToolbarDivider export edildi → standalone kullanılabilir", () => {
    const { container } = render(<ToolbarDivider />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden");
    expect(el.className).toMatch(/h-5/);
    expect(el.className).toMatch(/w-px/);
    expect(el.className).toMatch(/bg-border/);
  });
});

describe("FilterBar primitive", () => {
  it("default → role=group · aria-label=Filtreler · flex flex-wrap items-center gap-2", () => {
    const { container } = render(
      <FilterBar>
        <Chip active>Tümü · 84</Chip>
        <Chip>Wall art · 31</Chip>
      </FilterBar>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute("role", "group");
    expect(el).toHaveAttribute("aria-label", "Filtreler");
    expect(el.className).toMatch(/\bflex\b/);
    expect(el.className).toMatch(/flex-wrap/);
    expect(el.className).toMatch(/gap-2/);
  });

  it("ariaLabel override → aria-label özelleşir", () => {
    const { container } = render(
      <FilterBar ariaLabel="Koleksiyon filtreleri">x</FilterBar>,
    );
    expect(container.firstChild).toHaveAttribute(
      "aria-label",
      "Koleksiyon filtreleri",
    );
  });

  it("clearLabel + onClearAll verilmişse sağda Temizle butonu render eder", () => {
    const onClearAll = vi.fn();
    render(
      <FilterBar clearLabel="Temizle" onClearAll={onClearAll}>
        <Chip>X</Chip>
      </FilterBar>,
    );
    const btn = screen.getByRole("button", { name: "Temizle" });
    expect(btn.className).toMatch(/font-mono/);
    expect(btn.className).toMatch(/text-text-subtle/);
    fireEvent.click(btn);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("clearLabel yoksa Temizle butonu render edilmez", () => {
    render(<FilterBar><Chip>X</Chip></FilterBar>);
    expect(screen.queryByRole("button", { name: "Temizle" })).toBeNull();
  });

  it("clearSlot override → özel slot render edilir; default buton yok", () => {
    render(
      <FilterBar clearSlot={<button data-testid="custom-clear">TMZ</button>}>
        <Chip>X</Chip>
      </FilterBar>,
    );
    expect(screen.getByTestId("custom-clear")).toBeInTheDocument();
    // default buton yok
    expect(screen.queryByRole("button", { name: "Temizle" })).toBeNull();
  });
});

describe("BulkActionBar primitive", () => {
  it("selectedCount=0 → null döner (DOM'da render etmez)", () => {
    const { container } = render(
      <BulkActionBar selectedCount={0} actions={<button>A</button>} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("selectedCount>0 → accent-soft bg · border-transparent · rounded-md · role=region · aria-label=Toplu aksiyon", () => {
    const { container } = render(
      <BulkActionBar selectedCount={3} actions={<button>A</button>} />,
    );
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute("role", "region");
    expect(el).toHaveAttribute("aria-label", "Toplu aksiyon");
    expect(el).toHaveAttribute("data-selected-count", "3");
    expect(el.className).toMatch(/bg-accent-soft/);
    expect(el.className).toMatch(/border-transparent/);
    expect(el.className).toMatch(/rounded-md/);
  });

  it("default label → '{count} öğe seçildi' şablonu", () => {
    render(<BulkActionBar selectedCount={5} actions={<button>A</button>} />);
    expect(screen.getByText("5 öğe seçildi")).toBeInTheDocument();
  });

  it("label override → özel cümle render edilir", () => {
    render(
      <BulkActionBar
        selectedCount={3}
        label="3 bookmark seçildi"
        actions={<button>A</button>}
      />,
    );
    expect(screen.getByText("3 bookmark seçildi")).toBeInTheDocument();
  });

  it("sol check chip → h-4 w-4 bg-accent text-accent-foreground + svg", () => {
    const { container } = render(
      <BulkActionBar selectedCount={1} />,
    );
    const chip = container.querySelector("span[aria-hidden].bg-accent")!;
    expect(chip).toBeInTheDocument();
    expect(chip.className).toMatch(/h-4/);
    expect(chip.className).toMatch(/w-4/);
    expect(chip.className).toMatch(/rounded-sm/);
    expect(chip.className).toMatch(/text-accent-foreground/);
    expect(chip.querySelector("svg")).toBeInTheDocument();
  });

  it("actions slot → ml-auto flex items-center gap-1.5", () => {
    render(
      <BulkActionBar
        selectedCount={1}
        actions={<button data-testid="arc">Arşivle</button>}
      />,
    );
    const actionsHost = screen.getByTestId("arc").parentElement!;
    expect(actionsHost.className).toMatch(/ml-auto/);
    expect(actionsHost.className).toMatch(/\bflex\b/);
    expect(actionsHost.className).toMatch(/gap-1\.5/);
  });

  it("onDismiss verilmişse X butonu render olur · aria-label=Seçimi temizle · çalışır", () => {
    const onDismiss = vi.fn();
    render(
      <BulkActionBar
        selectedCount={2}
        actions={<button>A</button>}
        onDismiss={onDismiss}
      />,
    );
    const x = screen.getByRole("button", { name: "Seçimi temizle" });
    expect(x).toBeInTheDocument();
    expect(x.className).toMatch(/focus-visible:ring-accent/);
    fireEvent.click(x);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("onDismiss yoksa X butonu render edilmez", () => {
    render(
      <BulkActionBar selectedCount={1} actions={<button>A</button>} />,
    );
    expect(screen.queryByRole("button", { name: "Seçimi temizle" })).toBeNull();
  });

  it("sticky=true → sticky top-0 z-10 sınıfları eklenir", () => {
    const { container } = render(
      <BulkActionBar selectedCount={1} sticky actions={<button>A</button>} />,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/sticky/);
    expect(el.className).toMatch(/top-0/);
    expect(el.className).toMatch(/z-10/);
  });

  it("sticky=false default → sticky sınıfları YOK", () => {
    const { container } = render(
      <BulkActionBar selectedCount={1} actions={<button>A</button>} />,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).not.toMatch(/\bsticky\b/);
    expect(el.className).not.toMatch(/\btop-0\b/);
  });

  it("actions yok + onDismiss var → X butonu ml-auto ile sağa yapışır", () => {
    render(
      <BulkActionBar selectedCount={1} onDismiss={() => {}} />,
    );
    const x = screen.getByRole("button", { name: "Seçimi temizle" });
    expect(x.className).toMatch(/ml-auto/);
  });
});
