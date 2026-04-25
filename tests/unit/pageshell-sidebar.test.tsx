import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavItem } from "@/components/ui/NavItem";
import {
  Sidebar,
  SidebarGroup,
  SidebarBrand,
} from "@/components/ui/Sidebar";
import { PageShell } from "@/components/ui/PageShell";

describe("NavItem primitive", () => {
  it("default (inactive, href verili) → Link render · muted metin · active bar yok", () => {
    const { container } = render(
      <NavItem href="/dashboard" label="Panel" />,
    );
    const link = container.querySelector('a[href="/dashboard"]')!;
    expect(link).toBeInTheDocument();
    expect(link.className).toMatch(/text-text-muted/);
    expect(link).not.toHaveAttribute("data-active");
    expect(link).not.toHaveAttribute("aria-current");
    // Active bar span olmamalı
    expect(container.querySelector("span[aria-hidden].bg-accent")).toBeNull();
  });

  it("active=true → bar span + data-active + aria-current=page + surface bg + shadow-card", () => {
    const { container } = render(
      <NavItem href="/bookmarks" label="Bookmark" active />,
    );
    const link = container.querySelector('a[href="/bookmarks"]')!;
    expect(link).toHaveAttribute("data-active");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.className).toMatch(/bg-surface\b/);
    expect(link.className).toMatch(/text-text\b/);
    expect(link.className).toMatch(/font-medium/);
    expect(link.className).toMatch(/shadow-card/);
    // Active bar absolute span (left-0, w-0.5, bg-accent)
    const bar = container.querySelector("span[aria-hidden].bg-accent")!;
    expect(bar).toBeInTheDocument();
    expect(bar.className).toMatch(/absolute/);
    expect(bar.className).toMatch(/left-0/);
    expect(bar.className).toMatch(/w-0\.5/);
  });

  it("disabled=true → span render · tıklanamaz · opak zayıf · aria-disabled", () => {
    const { container } = render(
      <NavItem href="/variations" label="Üret" disabled />,
    );
    // href var ama disabled → <a> DEĞİL <span> render olmalı
    const a = container.querySelector("a");
    expect(a).toBeNull();
    const span = container.querySelector("span[data-disabled]")!;
    expect(span).toBeInTheDocument();
    expect(span).toHaveAttribute("aria-disabled");
    expect(span.className).toMatch(/cursor-not-allowed/);
    expect(span.className).toMatch(/opacity-50/);
  });

  it("href yok → span render (button semantiği parent'a bırakılmış)", () => {
    const { container } = render(<NavItem label="Store switcher" />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("span")).toBeInTheDocument();
  });

  it("badge slot → mono · text-xs · text-subtle", () => {
    render(<NavItem href="/x" label="Bookmark" badge="84" />);
    const badge = screen.getByText("84");
    expect(badge.className).toMatch(/font-mono/);
    expect(badge.className).toMatch(/text-xs/);
    expect(badge.className).toMatch(/text-text-subtle/);
  });

  it("icon ComponentType render edilir → h-4 w-4 + active iken accent rengi", () => {
    const Icon = ({ className, ...rest }: { className?: string }) => (
      <svg className={className} data-testid="icon" {...rest} />
    );
    const { rerender } = render(
      <NavItem href="/x" label="L" icon={Icon} />,
    );
    const inactiveIcon = screen.getByTestId("icon");
    expect(inactiveIcon.getAttribute("class")).toMatch(/h-4/);
    expect(inactiveIcon.getAttribute("class")).toMatch(/w-4/);
    expect(inactiveIcon.getAttribute("class")).toMatch(/text-text-muted/);

    rerender(<NavItem href="/x" label="L" icon={Icon} active />);
    const activeIcon = screen.getByTestId("icon");
    expect(activeIcon.getAttribute("class")).toMatch(/text-accent\b/);
  });

  it("label truncate → uzun isimler ellipsis alır", () => {
    render(<NavItem href="/x" label="Çok uzun bir nav item adı burada" />);
    const labelEl = screen.getByText(/Çok uzun bir nav item/);
    expect(labelEl.className).toMatch(/truncate/);
  });
});

describe("Sidebar primitive", () => {
  it("default → aside · w-sidebar · h-screen · surface-2 bg · border-r border-border · role=navigation", () => {
    const { container } = render(
      <Sidebar>
        <div>child</div>
      </Sidebar>,
    );
    const aside = container.querySelector("aside")!;
    expect(aside).toBeInTheDocument();
    expect(aside).toHaveAttribute("role", "navigation");
    expect(aside).toHaveAttribute("aria-label", "Ana gezinme");
    expect(aside.className).toMatch(/h-screen/);
    expect(aside.className).toMatch(/w-sidebar/);
    expect(aside.className).toMatch(/bg-surface-2/);
    expect(aside.className).toMatch(/border-r/);
    expect(aside.className).toMatch(/border-border\b/);
  });

  it("brand slot → h-header satırı + border-bottom-subtle + px-4", () => {
    const { container } = render(
      <Sidebar brand={<span data-testid="brand">B</span>}>x</Sidebar>,
    );
    const brandHost = screen.getByTestId("brand").parentElement!;
    expect(brandHost.className).toMatch(/h-header/);
    expect(brandHost.className).toMatch(/border-b/);
    expect(brandHost.className).toMatch(/border-border-subtle/);
    expect(brandHost.className).toMatch(/\bpx-4\b/);
    // container sanity — brand slot var, aside içinde
    expect(container.querySelector("aside")).toContainElement(brandHost);
  });

  it("footer slot → border-t border-border-subtle + p-3", () => {
    render(
      <Sidebar footer={<span data-testid="footer">F</span>}>x</Sidebar>,
    );
    const footerHost = screen.getByTestId("footer").parentElement!;
    expect(footerHost.className).toMatch(/border-t/);
    expect(footerHost.className).toMatch(/border-border-subtle/);
    expect(footerHost.className).toMatch(/\bp-3\b/);
  });

  it("ariaLabel override → aria-label özelleştirilebilir", () => {
    const { container } = render(
      <Sidebar ariaLabel="Admin paneli gezinmesi">x</Sidebar>,
    );
    expect(container.querySelector("aside")).toHaveAttribute(
      "aria-label",
      "Admin paneli gezinmesi",
    );
  });
});

describe("SidebarGroup", () => {
  it("title verilmişse mono · tracking-meta · text-subtle header render eder", () => {
    render(
      <SidebarGroup title="Kütüphane">
        <div>item</div>
      </SidebarGroup>,
    );
    const header = screen.getByText("Kütüphane");
    expect(header.className).toMatch(/font-mono/);
    expect(header.className).toMatch(/tracking-meta/);
    expect(header.className).toMatch(/text-text-subtle/);
    // uppercase YASAK — spec mono title-case (carry-forward)
    expect(header.className).not.toMatch(/uppercase/);
  });

  it("title verilmemişse header render etmez", () => {
    const { container } = render(
      <SidebarGroup>
        <div>item</div>
      </SidebarGroup>,
    );
    // SidebarGroup wrapper'ın altında sadece item container olmalı
    const wrapper = container.firstChild as HTMLElement;
    // İlk child ya header ya items container. Header yoksa sadece items (space-y-0.5 div)
    const header = wrapper.querySelector(".font-mono.tracking-meta");
    expect(header).toBeNull();
  });

  it("items space-y-0.5 ile dizilir", () => {
    const { container } = render(
      <SidebarGroup title="Studio">
        <div>a</div>
        <div>b</div>
      </SidebarGroup>,
    );
    const items = container.querySelector(".space-y-0\\.5");
    expect(items).toBeInTheDocument();
  });
});

describe("SidebarBrand", () => {
  it("mark default 'E' · accent bg · mono · accent-foreground", () => {
    render(<SidebarBrand name="EtsyHub" />);
    const mark = screen.getByText("E");
    expect(mark.className).toMatch(/bg-accent\b/);
    expect(mark.className).toMatch(/font-mono/);
    expect(mark.className).toMatch(/text-accent-foreground/);
    expect(mark.className).toMatch(/rounded-sm/);
    expect(mark).toHaveAttribute("aria-hidden");
  });

  it("custom mark → render edilir", () => {
    render(<SidebarBrand name="Admin" mark="A" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("scope=admin → 'admin' rozeti render edilir", () => {
    render(<SidebarBrand name="EtsyHub" scope="admin" />);
    const badge = screen.getByText("admin");
    expect(badge.className).toMatch(/bg-text\b/);
    expect(badge.className).toMatch(/text-accent-foreground/);
    expect(badge.className).toMatch(/font-mono/);
  });

  it("scope=user default → admin rozeti yok", () => {
    render(<SidebarBrand name="EtsyHub" />);
    expect(screen.queryByText("admin")).toBeNull();
  });
});

describe("PageShell primitive", () => {
  it("default → flex · h-screen · bg-bg · density=user (data-density=user, p-6)", () => {
    const { container } = render(<PageShell>content</PageShell>);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/\bflex\b/);
    expect(root.className).toMatch(/h-screen/);
    expect(root.className).toMatch(/bg-bg\b/);
    expect(root).toHaveAttribute("data-density", "user");
    const scroll = root.querySelector("main > div:last-child")!;
    expect(scroll.className).toMatch(/\bp-6\b/);
    expect(scroll.className).toMatch(/overflow-auto/);
  });

  it("density=admin → data-density=admin + content p-4", () => {
    const { container } = render(
      <PageShell density="admin">content</PageShell>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("data-density", "admin");
    const scroll = root.querySelector("main > div:last-child")!;
    expect(scroll.className).toMatch(/\bp-4\b/);
  });

  it("title + subtitle verildiğinde topbar render olur (h-header + 2xl semibold title + xs muted subtitle)", () => {
    render(
      <PageShell title="Bookmark" subtitle="84 kayıt · 12 koleksiyon">
        x
      </PageShell>,
    );
    const title = screen.getByText("Bookmark");
    expect(title.className).toMatch(/text-2xl/);
    expect(title.className).toMatch(/font-semibold/);
    const sub = screen.getByText("84 kayıt · 12 koleksiyon");
    expect(sub.className).toMatch(/text-xs/);
    expect(sub.className).toMatch(/text-text-muted/);
    // Topbar container
    const topbar = title.closest("div.h-header");
    expect(topbar).toBeInTheDocument();
    expect(topbar!.className).toMatch(/border-b/);
    expect(topbar!.className).toMatch(/\bpx-6\b/); // density=user
  });

  it("title+actions yoksa topbar render ETMEZ", () => {
    const { container } = render(<PageShell>x</PageShell>);
    const topbar = container.querySelector("main > div.h-header");
    expect(topbar).toBeNull();
  });

  it("actions slot → sağda gap-2 flex", () => {
    render(
      <PageShell
        title="x"
        actions={<button data-testid="act">A</button>}
      >
        y
      </PageShell>,
    );
    const btn = screen.getByTestId("act");
    const actionsHost = btn.parentElement!;
    expect(actionsHost.className).toMatch(/\bflex\b/);
    expect(actionsHost.className).toMatch(/items-center/);
    expect(actionsHost.className).toMatch(/gap-2/);
  });

  it("toolbar slot → ikinci bant border-bottom-subtle + py-3 + px-6 (user density)", () => {
    render(
      <PageShell toolbar={<span data-testid="tb">TB</span>}>x</PageShell>,
    );
    const tb = screen.getByTestId("tb");
    const band = tb.parentElement!;
    expect(band.className).toMatch(/border-b/);
    expect(band.className).toMatch(/border-border-subtle/);
    expect(band.className).toMatch(/\bpy-3\b/);
    expect(band.className).toMatch(/\bpx-6\b/);
    expect(band.className).toMatch(/flex-wrap/);
  });

  it("sidebar slot → main solunda render olur", () => {
    render(
      <PageShell sidebar={<aside data-testid="sb" />}>x</PageShell>,
    );
    const sb = screen.getByTestId("sb");
    // sidebar slot, main'den önce
    expect(sb.nextElementSibling?.tagName).toBe("MAIN");
  });
});

describe("PageShell variant=auth (T-28)", () => {
  it("variant='auth' + brand → brand içeriği render olur", () => {
    render(
      <PageShell variant="auth" brand={<span data-testid="brand-slot">B</span>}>
        <div data-testid="auth-content">F</div>
      </PageShell>,
    );
    expect(screen.getByTestId("brand-slot")).toBeInTheDocument();
    expect(screen.getByTestId("auth-content")).toBeInTheDocument();
  });

  it("variant='auth' → md+ split layout (md:grid-cols-2) + min-h-screen + bg-bg", () => {
    const { container } = render(
      <PageShell variant="auth" brand={<span>B</span>}>
        <div>F</div>
      </PageShell>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/min-h-screen/);
    expect(root.className).toMatch(/bg-bg\b/);
    expect(root.className).toMatch(/grid/);
    expect(root.className).toMatch(/md:grid-cols-2/);
  });

  it("variant='auth' → brand panel md altında gizli (hidden md:flex)", () => {
    render(
      <PageShell variant="auth" brand={<span data-testid="brand-slot">B</span>}>
        <div>F</div>
      </PageShell>,
    );
    // brand slot'unun parent'ı responsive class taşımalı
    const brand = screen.getByTestId("brand-slot");
    const brandHost = brand.closest("[data-pageshell-brand]") as HTMLElement;
    expect(brandHost).toBeInTheDocument();
    expect(brandHost.className).toMatch(/hidden/);
    expect(brandHost.className).toMatch(/md:flex/);
  });

  it("variant olmadan → mevcut davranış (sidebar/title/toolbar render edilir)", () => {
    const { container } = render(
      <PageShell
        sidebar={<aside data-testid="sb-default" />}
        title="Dashboard"
        toolbar={<span data-testid="tb-default" />}
      >
        x
      </PageShell>,
    );
    // Default davranış: flex + h-screen, sidebar/title/toolbar hepsi var
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/h-screen/);
    expect(root.className).not.toMatch(/min-h-screen/);
    expect(screen.getByTestId("sb-default")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("tb-default")).toBeInTheDocument();
  });

  it("variant='default' + brand → brand IGNORE edilir (DOM'da yok)", () => {
    render(
      <PageShell variant="default" brand={<span data-testid="ghost-brand">B</span>}>
        x
      </PageShell>,
    );
    expect(screen.queryByTestId("ghost-brand")).toBeNull();
  });
});
