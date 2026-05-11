import {
  forwardRef,
  type ElementType,
  type HTMLAttributes,
  type MouseEvent,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Kivasy Card — spec A.2.3.
 *
 * 3 tip (variant):
 * - **stat**: mono title-case label + büyük numeral + trend badge
 * - **asset**: padding 0 · üstte aspect-card thumbnail full-bleed · altta 12px pad
 * - **list**: yatay sıra · sol avatar/thumb · sağ meta
 *
 * Hepsi ortak: `bg-surface · border 1px · radius md · shadow-card`.
 *
 * Hover disiplini (spec A.1.8 + A.2.3):
 * - `interactive` true → border `border` → `border-strong`, shadow 1px → 4px
 *   (shadow-card → shadow-card-hover)
 * - Kart kutusu asla scale etmez; scale yalnızca thumbnail yüzeyinde
 *   (`group` marker ile Thumb `group-hover:scale-subtle`)
 * - Renk patlaması, bouncing, glass, gradient bg YASAK
 *
 * Selected: accent-soft bg (list/stat) veya accent outer ring (asset). Kompozit
 * tip olduğu için component bunu prop olarak kabul eder, render'ı doğru
 * tonla ayarlar.
 */

const cardVariants = cva(
  [
    "rounded-md border bg-surface",
    "shadow-card",
    "transition-colors ease-out duration-fast",
  ],
  {
    variants: {
      variant: {
        stat: "p-4",
        asset: "p-0 overflow-hidden",
        list: "flex items-center gap-3 p-3",
      },
      interactive: {
        true: [
          "cursor-pointer group",
          "hover:border-border-strong hover:shadow-card-hover",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        ],
        false: "",
      },
      selected: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      // List + selected → satır tonu
      {
        variant: "list",
        selected: true,
        class: "bg-accent-soft border-transparent",
      },
      // Stat + selected → hafif accent tonu
      {
        variant: "stat",
        selected: true,
        class: "bg-accent-soft border-transparent",
      },
      // Asset + selected → accent outer ring (kart dışı ring)
      {
        variant: "asset",
        selected: true,
        class: "ring-2 ring-accent ring-offset-2 ring-offset-bg",
      },
      // Default border rengi selected olmayan tüm kartlarda
      { selected: false, class: "border-border" },
    ],
    defaultVariants: {
      variant: "stat",
      interactive: false,
      selected: false,
    },
  },
);

type CardVariants = VariantProps<typeof cardVariants>;

export interface CardProps
  extends Omit<HTMLAttributes<HTMLElement>, "onClick">,
    Omit<CardVariants, "interactive" | "selected"> {
  interactive?: boolean;
  selected?: boolean;
  /** Interactive Card → button/link semantiği için override. Default: div. */
  as?: ElementType;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
}

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  {
    variant = "stat",
    interactive = false,
    selected = false,
    as,
    className,
    children,
    onClick,
    ...rest
  },
  ref,
) {
  const Component = (as ?? "div") as ElementType;
  const extraProps: Record<string, unknown> = {};
  if (interactive && Component === "div") {
    // Klavye erişilebilirliği: interactive div ise rol ve tabIndex ver.
    extraProps.role = "button";
    extraProps.tabIndex = 0;
  }
  return (
    <Component
      ref={ref}
      onClick={onClick}
      data-variant={variant}
      data-selected={selected || undefined}
      className={cn(cardVariants({ variant, interactive, selected }), className)}
      {...extraProps}
      {...rest}
    >
      {children}
    </Component>
  );
});

/**
 * Stat card body helper — zorunlu değil, ama stat kartının tipografi
 * grameri (mono title-case label + büyük numeral + opsiyonel trend badge)
 * tek yerden gelir ki ekranlar bunu yeniden icat etmesin.
 */
export interface StatCardBodyProps {
  label: string;
  value: string | number;
  trend?: React.ReactNode;
}
export function StatCardBody({ label, value, trend }: StatCardBodyProps) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-xs tracking-meta text-text-muted">
        {label}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-3xl font-semibold text-text">{value}</div>
        {trend ? <div className="pb-1">{trend}</div> : null}
      </div>
    </div>
  );
}

/**
 * Asset card body helper — spec "padding 0, üstte aspect-card thumbnail
 * full-bleed, altta 12px pad" kuralını birebir taşır. Thumb parent slot'a
 * direkt konur; meta 12px padding içinde.
 */
export function AssetCardMeta({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-3 space-y-1", className)} {...rest}>
      {children}
    </div>
  );
}
