import Link from "next/link";
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

/**
 * EtsyHub NavItem — spec A.1.10 · canvas app-shell.jsx:331.
 *
 * Sidebar içindeki tek satırlık gezinme öğesi. Active iken sol kenarda 2px
 * accent bar belirir ve satır surface bg + shadow-card kazanır; inactive iken
 * muted metin + transparent bg.
 *
 * Prop semantiği:
 * - `icon`: lucide bileşeni veya JSX (ikon render slotu)
 * - `label`: metin (single-line, truncate değil — ellipsis sadece uzun store
 *   isimlerinde gerekir, o zaman parent slot çözer)
 * - `badge`: opsiyonel mono sayı (24 item vs), sağ slot
 * - `active`: kullanıcı sayfasındaysa bar + surface tonu aktif
 * - `disabled`: feature flag / faz kısıtı — tıklanamaz, opak zayıf
 *
 * Render:
 * - `href` varsa `<Link>` render olur (Next.js), `disabled` ise `<span>` fallback
 * - `href` yoksa `<button>` render olur (modal trigger / sidebar aksiyon)
 */

export type NavItemIcon =
  | ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  | ReactNode;

export interface NavItemProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children"> {
  icon?: NavItemIcon;
  label: string;
  badge?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  href?: string;
  /** Sağ tarafta ekstra meta (ör. phase etiketi "P5"). */
  meta?: ReactNode;
}

const baseClass = cn(
  "relative flex items-center gap-2.5 h-8 pr-2.5 pl-3.5 rounded-sm",
  "text-sm transition-colors ease-out duration-fast",
);

function stateClass({
  active,
  disabled,
}: {
  active: boolean;
  disabled: boolean;
}) {
  if (disabled) return "text-text-subtle cursor-not-allowed opacity-50";
  if (active)
    return "bg-surface text-text font-medium shadow-card";
  return "text-text-muted hover:bg-surface/60 hover:text-text";
}

function renderIcon(icon: NavItemIcon | undefined, active: boolean) {
  if (!icon) return null;
  const color = active ? "text-accent" : "text-text-muted";
  if (typeof icon === "function" || (typeof icon === "object" && icon && "render" in icon)) {
    const IconComp = icon as ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    return <IconComp className={cn("h-4 w-4", color)} aria-hidden />;
  }
  return <span className={cn("flex h-4 w-4 items-center justify-center", color)}>{icon}</span>;
}

export const NavItem = forwardRef<HTMLElement, NavItemProps>(function NavItem(
  {
    icon,
    label,
    badge,
    active = false,
    disabled = false,
    href,
    meta,
    className,
    ...rest
  },
  ref,
) {
  const classes = cn(baseClass, stateClass({ active, disabled }), className);
  const content = (
    <>
      {active ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-sm bg-accent"
        />
      ) : null}
      {renderIcon(icon, active)}
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined ? (
        <span className="font-mono text-xs text-text-subtle">{badge}</span>
      ) : null}
      {meta ? <span className="ml-1 font-mono text-xs text-text-subtle">{meta}</span> : null}
    </>
  );

  if (disabled || !href) {
    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        data-active={active || undefined}
        data-disabled={disabled || undefined}
        aria-current={active ? "page" : undefined}
        aria-disabled={disabled || undefined}
        className={classes}
        {...(rest as React.HTMLAttributes<HTMLSpanElement>)}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      ref={ref as React.Ref<HTMLAnchorElement>}
      href={href}
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      className={classes}
      {...rest}
    >
      {content}
    </Link>
  );
});
