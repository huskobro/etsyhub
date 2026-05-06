"use client";

// Pass 39 — "use client" directive eklendi. Table primitive `createContext`
// + `useContext` kullanır (TableDensityContext). Pre-Pass 39: directive yoktu;
// Next.js App Router server component'inden import edilince derleme hatası:
// "You're importing a component that needs createContext. It only works in
// a Client Component but none of its parents are marked with 'use client'".
//
// Etkilenen sayfalar (build error → boş render):
//   - /admin/jobs (server async function db.findMany)
//   - /admin/audit-logs (aynı pattern)
//
// Diğer 4 tüketici (mockup-templates-manager, flags-table, product-types-manager,
// users-table) zaten "use client" component'ler; primitive client'a taşıdığında
// davranış değişmez.

import {
  createContext,
  forwardRef,
  useContext,
  type HTMLAttributes,
  type ReactNode,
  type ThHTMLAttributes,
  type TdHTMLAttributes,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * EtsyHub Table primitive ailesi — implementation-brief T-12 (line 87, 103).
 *
 * **Hedef:** Admin tablolarının (Users / Product Types / Feature Flags) ortak
 * yüzeyi. Spec gereği:
 * - dış sarmalayıcı: `rounded-md border border-border bg-surface overflow-hidden`
 *   (Card aile pattern'i ile aynı)
 * - thead: `bg-surface-muted` · TH mono title-case 11px (Badge meta gramerinin
 *   aynısı: `font-mono text-xs tracking-meta normal-case` → 11px ölçüsü
 *   `text-xs` token'ından gelir; arbitrary value yasak)
 * - density:
 *   - `user`  → satır 56h (`py-3` + base text), padding `px-4`
 *   - `admin` → satır 48h (`py-2.5` + `text-sm`), padding `px-4`
 * - TR aralarında `border-t border-border`; selected → `bg-accent-soft`
 *   (BulkActionBar ile aynı accent dili); interactive → `hover:bg-surface-muted
 *   cursor-pointer transition-colors`
 * - TH sortable → caret state: aktif yön (asc → ChevronUp, desc → ChevronDown)
 *   `text-text` ile, null + sortable → muted up/down stack (`ChevronsUpDown`)
 *   `text-text-muted` ile.
 *
 * **Density propagation:** `<Table density>` prop'u Context üzerinden TH/TD'ye
 * geçer; prop drilling yok, global store yok (`TableDensityContext`). THead
 * ayrıca `data-table-section="head"` markeri üzerinden bilinir; bu sayede TH
 * head içinde, TD body içinde olduğunda density paddinglerini doğru uygular.
 *
 * **Kapsam DIŞI (intentional):**
 * - built-in selection / checkbox kolonu (admin tablolar kendi kablolar)
 * - BulkActionBar entegrasyonu (Bookmarks-tarzı pattern; tablolarla intentional
 *   olarak ayrışır — brief satır 103)
 * - pagination, sticky header, virtualization, column resizing, caption slot
 */

// ─── Context ────────────────────────────────────────────────────────────────

export type TableDensity = "user" | "admin";

const TableDensityContext = createContext<TableDensity>("user");

function useTableDensity(): TableDensity {
  return useContext(TableDensityContext);
}

// ─── Table (root) ───────────────────────────────────────────────────────────

export interface TableProps
  extends Omit<HTMLAttributes<HTMLTableElement>, "children"> {
  density?: TableDensity;
  children: ReactNode;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(function Table(
  { density = "user", className, children, ...rest },
  ref,
) {
  return (
    <TableDensityContext.Provider value={density}>
      <div
        className={cn(
          "rounded-md border border-border bg-surface overflow-hidden",
        )}
        data-density={density}
      >
        <table
          ref={ref}
          className={cn("w-full border-collapse text-text", className)}
          {...rest}
        >
          {children}
        </table>
      </div>
    </TableDensityContext.Provider>
  );
});

// ─── THead / TBody ──────────────────────────────────────────────────────────

export interface THeadProps
  extends Omit<HTMLAttributes<HTMLTableSectionElement>, "children"> {
  children: ReactNode;
}

export const THead = forwardRef<HTMLTableSectionElement, THeadProps>(
  function THead({ className, children, ...rest }, ref) {
    return (
      <thead
        ref={ref}
        data-table-section="head"
        className={cn("bg-surface-muted", className)}
        {...rest}
      >
        {children}
      </thead>
    );
  },
);

export interface TBodyProps
  extends Omit<HTMLAttributes<HTMLTableSectionElement>, "children"> {
  children: ReactNode;
}

export const TBody = forwardRef<HTMLTableSectionElement, TBodyProps>(
  function TBody({ className, children, ...rest }, ref) {
    return (
      <tbody
        ref={ref}
        data-table-section="body"
        className={cn(className)}
        {...rest}
      >
        {children}
      </tbody>
    );
  },
);

// ─── TR ─────────────────────────────────────────────────────────────────────

const trVariants = cva(["border-t border-border"], {
  variants: {
    selected: {
      true: "bg-accent-soft",
      false: "",
    },
    interactive: {
      true: "cursor-pointer hover:bg-surface-muted transition-colors duration-fast ease-out",
      false: "",
    },
  },
  defaultVariants: {
    selected: false,
    interactive: false,
  },
});

type TRVariants = VariantProps<typeof trVariants>;

export interface TRProps
  extends Omit<HTMLAttributes<HTMLTableRowElement>, "onClick" | "children">,
    Omit<TRVariants, "selected" | "interactive"> {
  selected?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export const TR = forwardRef<HTMLTableRowElement, TRProps>(function TR(
  {
    selected = false,
    interactive = false,
    onClick,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <tr
      ref={ref}
      onClick={onClick}
      data-selected={selected || undefined}
      className={cn(trVariants({ selected, interactive }), className)}
      {...rest}
    >
      {children}
    </tr>
  );
});

// ─── Cell shared helpers ────────────────────────────────────────────────────

type CellAlign = "left" | "right" | "center";

function alignClass(align: CellAlign): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

function densityCellClass(density: TableDensity): string {
  // Padding ortak (px-4); satır yüksekliği py- ile gelir; admin gövde text-sm.
  if (density === "admin") return "px-4 py-2.5";
  return "px-4 py-3";
}

// ─── TH ─────────────────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc" | null;

export interface THProps
  extends Omit<
    ThHTMLAttributes<HTMLTableCellElement>,
    "onClick" | "children" | "align"
  > {
  sortable?: boolean;
  sortDirection?: SortDirection;
  onSort?: () => void;
  align?: CellAlign;
  children: ReactNode;
}

export const TH = forwardRef<HTMLTableCellElement, THProps>(function TH(
  {
    sortable = false,
    sortDirection = null,
    onSort,
    align = "left",
    className,
    children,
    ...rest
  },
  ref,
) {
  const density = useTableDensity();
  const handleClick = sortable && onSort ? onSort : undefined;
  const ariaSort: "ascending" | "descending" | "none" | undefined = sortable
    ? sortDirection === "asc"
      ? "ascending"
      : sortDirection === "desc"
        ? "descending"
        : "none"
    : undefined;

  return (
    <th
      ref={ref}
      scope="col"
      aria-sort={ariaSort}
      onClick={handleClick}
      data-sortable={sortable || undefined}
      data-sort-direction={sortDirection ?? undefined}
      className={cn(
        densityCellClass(density),
        alignClass(align),
        // mono title-case 11px (Badge meta gramerinin aynısı)
        "font-mono text-xs tracking-meta normal-case",
        "font-medium text-text-muted",
        sortable && "cursor-pointer select-none hover:text-text",
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5",
          align === "right" && "flex-row-reverse",
          align === "center" && "justify-center",
        )}
      >
        <span>{children}</span>
        {sortable ? <SortCaret direction={sortDirection} /> : null}
      </span>
    </th>
  );
});

function SortCaret({ direction }: { direction: SortDirection }) {
  if (direction === "asc") {
    return (
      <ChevronUp
        aria-hidden
        data-caret="asc"
        className="h-3.5 w-3.5 text-text"
      />
    );
  }
  if (direction === "desc") {
    return (
      <ChevronDown
        aria-hidden
        data-caret="desc"
        className="h-3.5 w-3.5 text-text"
      />
    );
  }
  return (
    <ChevronsUpDown
      aria-hidden
      data-caret="none"
      className="h-3.5 w-3.5 text-text-muted"
    />
  );
}

// ─── TD ─────────────────────────────────────────────────────────────────────

export interface TDProps
  extends Omit<TdHTMLAttributes<HTMLTableCellElement>, "children" | "align"> {
  align?: CellAlign;
  muted?: boolean;
  children: ReactNode;
}

export const TD = forwardRef<HTMLTableCellElement, TDProps>(function TD(
  { align = "left", muted = false, className, children, ...rest },
  ref,
) {
  const density = useTableDensity();
  return (
    <td
      ref={ref}
      className={cn(
        densityCellClass(density),
        alignClass(align),
        density === "admin" ? "text-sm" : undefined,
        muted ? "text-text-muted" : "text-text",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
});
