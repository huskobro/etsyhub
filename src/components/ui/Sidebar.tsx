import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

/**
 * EtsyHub Sidebar — spec A.1.10 · canvas app-shell.jsx:6.
 *
 * 232w dikey panel, surface-2 bg, sağda 1px border. İçerik slotları:
 * - `brand`: üst 56h brand satırı (logo mark + ad + opsiyonel scope etiketi)
 * - `children`: NavItem / SidebarGroup listesi (scroll)
 * - `footer`: opsiyonel alt satır (user card, store switcher vs.)
 *
 * Semantik: `<aside role="navigation" aria-label="Ana gezinme">`. Topbar ile
 * dikey ayrı; mobile responsive şimdilik yok (spec A.1.10 desktop-first MVP).
 */

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  brand?: ReactNode;
  footer?: ReactNode;
  /** Ariaya çıkacak etiket. Default "Ana gezinme". */
  ariaLabel?: string;
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(function Sidebar(
  { brand, footer, ariaLabel = "Ana gezinme", className, children, ...rest },
  ref,
) {
  return (
    <aside
      ref={ref}
      role="navigation"
      aria-label={ariaLabel}
      className={cn(
        "flex h-screen w-sidebar flex-col",
        "bg-surface-2 border-r border-border",
        className,
      )}
      {...rest}
    >
      {brand ? (
        <div className="flex h-header items-center gap-2.5 border-b border-border-subtle px-4">
          {brand}
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto px-2 pb-4 pt-2">{children}</div>
      {footer ? (
        <div className="flex items-center gap-2.5 border-t border-border-subtle p-3">
          {footer}
        </div>
      ) : null}
    </aside>
  );
});

/**
 * SidebarGroup — başlıklı NavItem kümesi. Başlık mono title-case, tracking-meta,
 * text-subtle; başlıksız grup (küçük ayraç) için title atlanabilir.
 *
 * Not: Spec (A.1.10) mono title-case diyor. Canvas uppercase kullanıyor ama
 * carry-forward'daki "title-case dil" disiplini spec'e yaslı; burada spec
 * prime olarak alındı.
 */
export interface SidebarGroupProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
}
export function SidebarGroup({
  title,
  className,
  children,
  ...rest
}: SidebarGroupProps) {
  return (
    <div className={cn("mt-4 first:mt-2", className)} {...rest}>
      {title ? (
        <div className="px-3 pb-1.5 font-mono text-xs tracking-meta text-text-subtle">
          {title}
        </div>
      ) : null}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/**
 * SidebarBrand — küçük accent kare + marka adı + opsiyonel scope etiketi.
 * Admin scope'ta sağda mini 'admin' rozeti belirir (Canvas reference).
 */
export interface SidebarBrandProps {
  /** Tek harf mark (canvas: "E"). */
  mark?: string;
  name: string;
  scope?: "user" | "admin";
}
export function SidebarBrand({ mark = "E", name, scope = "user" }: SidebarBrandProps) {
  return (
    <>
      <div
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-sm bg-accent font-mono text-xs font-bold text-accent-foreground"
      >
        {mark}
      </div>
      <div className="text-sm font-semibold text-text">{name}</div>
      {scope === "admin" ? (
        <span className="ml-auto rounded-sm bg-text px-1.5 py-0.5 font-mono text-xs font-semibold tracking-meta text-accent-foreground">
          admin
        </span>
      ) : null}
    </>
  );
}
