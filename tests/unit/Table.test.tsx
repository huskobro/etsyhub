import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";

/**
 * Table primitive — implementation-brief T-12 (line 87, 103) test paketi.
 * Hedef: density propagation, selected/interactive TR, sortable TH caret state,
 * align ve muted varyantları.
 */

function basicRow({
  density,
  rowProps,
}: {
  density?: "user" | "admin";
  rowProps?: Parameters<typeof TR>[0];
}) {
  return (
    <Table density={density}>
      <THead>
        <TR>
          <TH>Ad</TH>
        </TR>
      </THead>
      <TBody>
        <TR {...rowProps}>
          <TD>Hücre</TD>
        </TR>
      </TBody>
    </Table>
  );
}

describe("Table — wrapper", () => {
  it("dış sarmalayıcı rounded-md + border + overflow-hidden + bg-surface", () => {
    const { container } = render(
      <Table>
        <TBody>
          <TR>
            <TD>x</TD>
          </TR>
        </TBody>
      </Table>,
    );
    const wrapper = container.querySelector("[data-density]")!;
    expect(wrapper).not.toBeNull();
    expect(wrapper.className).toMatch(/rounded-md/);
    expect(wrapper.className).toMatch(/border-border/);
    expect(wrapper.className).toMatch(/overflow-hidden/);
    expect(wrapper.className).toMatch(/bg-surface\b/);
  });

  it("default density user → wrapper data-density='user'", () => {
    const { container } = render(
      <Table>
        <TBody>
          <TR>
            <TD>x</TD>
          </TR>
        </TBody>
      </Table>,
    );
    expect(container.querySelector('[data-density="user"]')).not.toBeNull();
  });

  it("THead bg-surface-muted uygular", () => {
    render(
      <Table>
        <THead>
          <TR>
            <TH>Başlık</TH>
          </TR>
        </THead>
        <TBody>
          <TR>
            <TD>v</TD>
          </TR>
        </TBody>
      </Table>,
    );
    const head = document.querySelector('[data-table-section="head"]')!;
    expect(head.className).toMatch(/bg-surface-muted/);
  });
});

describe("Table — density propagation", () => {
  it("density='user' → TD py-3 + px-4 (text-sm yok)", () => {
    render(basicRow({ density: "user" }));
    const cell = screen.getByText("Hücre");
    expect(cell.className).toMatch(/\bpy-3\b/);
    expect(cell.className).toMatch(/\bpx-4\b/);
    expect(cell.className).not.toMatch(/\btext-sm\b/);
  });

  it("density='admin' → TD py-2.5 + px-4 + text-sm", () => {
    render(basicRow({ density: "admin" }));
    const cell = screen.getByText("Hücre");
    expect(cell.className).toMatch(/py-2\.5/);
    expect(cell.className).toMatch(/\bpx-4\b/);
    expect(cell.className).toMatch(/\btext-sm\b/);
  });

  it("density='admin' → TH de admin paddingi alır (py-2.5)", () => {
    render(basicRow({ density: "admin" }));
    const head = screen.getByText("Ad").closest("th")!;
    expect(head.className).toMatch(/py-2\.5/);
  });
});

describe("Table — TR selected / interactive", () => {
  it("selected=true → bg-accent-soft + data-selected", () => {
    render(basicRow({ rowProps: { selected: true, children: <TD>Hücre</TD> } }));
    const row = screen.getByText("Hücre").closest("tr")!;
    expect(row.className).toMatch(/bg-accent-soft/);
    expect(row.getAttribute("data-selected")).toBe("true");
  });

  it("selected default false → data-selected attribute YOK + accent-soft yok", () => {
    render(basicRow({}));
    const row = screen.getByText("Hücre").closest("tr")!;
    expect(row.getAttribute("data-selected")).toBeNull();
    expect(row.className).not.toMatch(/bg-accent-soft/);
  });

  it("interactive=true → cursor-pointer + hover:bg-surface-muted", () => {
    render(
      basicRow({
        rowProps: { interactive: true, children: <TD>Hücre</TD> },
      }),
    );
    const row = screen.getByText("Hücre").closest("tr")!;
    expect(row.className).toMatch(/cursor-pointer/);
    expect(row.className).toMatch(/hover:bg-surface-muted/);
    expect(row.className).toMatch(/transition-colors/);
  });

  it("interactive + onClick → tıklamada handler tetiklenir", () => {
    const onClick = vi.fn();
    render(
      <Table>
        <TBody>
          <TR interactive onClick={onClick}>
            <TD>Tıkla</TD>
          </TR>
        </TBody>
      </Table>,
    );
    fireEvent.click(screen.getByText("Tıkla").closest("tr")!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("TR aralarında border-t border-border zaten variant'tan gelir", () => {
    render(basicRow({}));
    const row = screen.getByText("Hücre").closest("tr")!;
    expect(row.className).toMatch(/border-t/);
    expect(row.className).toMatch(/border-border/);
  });
});

describe("Table — TH sortable + caret", () => {
  it("sortable + sortDirection=null → muted ChevronsUpDown caret (data-caret='none')", () => {
    render(
      <Table>
        <THead>
          <TR>
            <TH sortable onSort={() => void 0}>
              Ad
            </TH>
          </TR>
        </THead>
        <TBody>
          <TR>
            <TD>v</TD>
          </TR>
        </TBody>
      </Table>,
    );
    const th = screen.getByText("Ad").closest("th")!;
    expect(th.getAttribute("aria-sort")).toBe("none");
    const caret = th.querySelector("[data-caret]");
    expect(caret).not.toBeNull();
    expect(caret!.getAttribute("data-caret")).toBe("none");
    expect(caret!.getAttribute("class")).toMatch(/text-text-muted/);
  });

  it("sortDirection='asc' → ChevronUp aktif (data-caret='asc') + aria-sort=ascending", () => {
    render(
      <Table>
        <THead>
          <TR>
            <TH sortable sortDirection="asc" onSort={() => void 0}>
              Ad
            </TH>
          </TR>
        </THead>
        <TBody>
          <TR>
            <TD>v</TD>
          </TR>
        </TBody>
      </Table>,
    );
    const th = screen.getByText("Ad").closest("th")!;
    expect(th.getAttribute("aria-sort")).toBe("ascending");
    const caret = th.querySelector("[data-caret]");
    expect(caret!.getAttribute("data-caret")).toBe("asc");
    expect(caret!.getAttribute("class")).toMatch(/\btext-text\b/);
  });

  it("sortDirection='desc' → ChevronDown aktif (data-caret='desc') + aria-sort=descending", () => {
    render(
      <Table>
        <THead>
          <TR>
            <TH sortable sortDirection="desc" onSort={() => void 0}>
              Ad
            </TH>
          </TR>
        </THead>
        <TBody>
          <TR>
            <TD>v</TD>
          </TR>
        </TBody>
      </Table>,
    );
    const th = screen.getByText("Ad").closest("th")!;
    expect(th.getAttribute("aria-sort")).toBe("descending");
    const caret = th.querySelector("[data-caret]");
    expect(caret!.getAttribute("data-caret")).toBe("desc");
  });

  it("sortable + onSort → tıklamada onSort tetiklenir", () => {
    const onSort = vi.fn();
    render(
      <Table>
        <THead>
          <TR>
            <TH sortable onSort={onSort}>
              Ad
            </TH>
          </TR>
        </THead>
        <TBody>
          <TR>
            <TD>v</TD>
          </TR>
        </TBody>
      </Table>,
    );
    fireEvent.click(screen.getByText("Ad").closest("th")!);
    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it("sortable=false → caret render edilmez + aria-sort YOK + cursor-pointer YOK", () => {
    render(
      <Table>
        <THead>
          <TR>
            <TH>Ad</TH>
          </TR>
        </THead>
        <TBody>
          <TR>
            <TD>v</TD>
          </TR>
        </TBody>
      </Table>,
    );
    const th = screen.getByText("Ad").closest("th")!;
    expect(th.getAttribute("aria-sort")).toBeNull();
    expect(th.querySelector("[data-caret]")).toBeNull();
    expect(th.className).not.toMatch(/cursor-pointer/);
  });
});

describe("Table — TH typography (mono 11px title-case)", () => {
  it("font-mono + text-xs + tracking-meta + normal-case zorunlu", () => {
    render(
      <Table>
        <THead>
          <TR>
            <TH>iPhone Case</TH>
          </TR>
        </THead>
        <TBody>
          <TR>
            <TD>v</TD>
          </TR>
        </TBody>
      </Table>,
    );
    const th = screen.getByText("iPhone Case").closest("th")!;
    expect(th.className).toMatch(/font-mono/);
    expect(th.className).toMatch(/text-xs/);
    expect(th.className).toMatch(/tracking-meta/);
    expect(th.className).toMatch(/normal-case/);
    // title-case kilidi: uppercase / capitalize utility eklenmemeli
    expect(th.className).not.toMatch(/\buppercase\b/);
    expect(th.className).not.toMatch(/\bcapitalize\b/);
  });
});

describe("Table — align variants", () => {
  it("TH align='right' → text-right", () => {
    render(
      <Table>
        <THead>
          <TR>
            <TH align="right">Sayı</TH>
          </TR>
        </THead>
        <TBody>
          <TR>
            <TD>v</TD>
          </TR>
        </TBody>
      </Table>,
    );
    const th = screen.getByText("Sayı").closest("th")!;
    expect(th.className).toMatch(/text-right/);
  });

  it("TD align='center' → text-center", () => {
    render(
      <Table>
        <TBody>
          <TR>
            <TD align="center">orta</TD>
          </TR>
        </TBody>
      </Table>,
    );
    const td = screen.getByText("orta");
    expect(td.className).toMatch(/text-center/);
  });

  it("TD default align → text-left", () => {
    render(
      <Table>
        <TBody>
          <TR>
            <TD>sol</TD>
          </TR>
        </TBody>
      </Table>,
    );
    expect(screen.getByText("sol").className).toMatch(/text-left/);
  });
});

describe("Table — TD muted", () => {
  it("muted=true → text-text-muted", () => {
    render(
      <Table>
        <TBody>
          <TR>
            <TD muted>silik</TD>
          </TR>
        </TBody>
      </Table>,
    );
    expect(screen.getByText("silik").className).toMatch(/text-text-muted/);
  });

  it("muted=false (default) → text-text", () => {
    render(
      <Table>
        <TBody>
          <TR>
            <TD>normal</TD>
          </TR>
        </TBody>
      </Table>,
    );
    const td = screen.getByText("normal");
    expect(td.className).toMatch(/\btext-text\b/);
    expect(td.className).not.toMatch(/text-text-muted/);
  });
});
