import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * EtsyHub Badge — spec A.2.5 (status badge).
 * Kural: 20h · mono · 11px · tracking meta (0.6px) · radius sm.
 * Title-case kilidi: component children metnini olduğu gibi render eder,
 * Tailwind uppercase/capitalize utility EKLENMEZ. `normal-case` açıkça
 * uygulanır — kullanıcı yanlışlıkla parent'tan gelen bir transform miras
 * almamalı.
 */

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1",
    "h-5 px-2",
    "rounded-sm border",
    "font-mono text-xs font-medium tracking-meta normal-case",
    "whitespace-nowrap",
  ],
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-text-muted border-border",
        accent: "bg-accent-soft text-accent-text border-transparent",
        success: "bg-success-soft text-success border-transparent",
        warning: "bg-warning-soft text-warning border-transparent",
        danger: "bg-danger-soft text-danger border-transparent",
        info: "bg-info-soft text-info border-transparent",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  children?: ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone, dot = false, className, children, ...rest },
  ref,
) {
  return (
    <span ref={ref} className={cn(badgeVariants({ tone }), className)} {...rest}>
      {dot ? (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
        />
      ) : null}
      {children}
    </span>
  );
});

/**
 * Tag — spec A.2.5: "neutral badge, thumbnail altında tek tane".
 * Ayrı bir component değil; Badge'in neutral tonuna anlam veren alias.
 * Kullanım: `<Tag>Clipart</Tag>` → `<Badge tone="neutral">Clipart</Badge>`.
 */
export const Tag = forwardRef<HTMLSpanElement, Omit<BadgeProps, "tone">>(
  function Tag(props, ref) {
    return <Badge ref={ref} tone="neutral" {...props} />;
  },
);
