import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

/**
 * EtsyHub PageShell — spec A.1.10 · canvas app-shell.jsx:133.
 *
 * Editoryal kokpit. Solda Sidebar slot, sağda dikey stack:
 *   Topbar (56h, title + subtitle + actions) → opsiyonel Toolbar band →
 *   Scroll content (density-aware pad).
 *
 * Prop semantiği:
 * - `sidebar`: tamamen opak slot; primitive Sidebar'ı ya da feature adapter'ı
 *   içerir. Shell boyutunu değiştirmez.
 * - `title` / `subtitle`: topbar sol slotu. Title 2xl semibold, subtitle xs
 *   muted. Title zorunlu değil — bazı sayfalarda toolbar tek başına üst bandı
 *   taşır (`title` boşsa topbar render edilmez).
 * - `actions`: topbar sağ slot (Button group vs). Flex gap-2.
 * - `toolbar`: opsiyonel ikinci bant; içine Toolbar/FilterBar konur. Border
 *   bottom subtle.
 * - `density`: "user" | "admin" — content pad ve row-h farkı için root'a
 *   `data-density` yazar. Default "user".
 * - `variant`: "default" | "auth" (default: "default"). "auth" varyantı iki
 *   kolonlu split layout render eder (sol: brand panel, sağ: form panel).
 *   "auth" modunda sidebar/toolbar/density yok sayılır — auth ekranı sade.
 *   Geriye uyumluluk: variant verilmezse mevcut davranış birebir korunur.
 * - `brand`: yalnızca `variant="auth"` tüketir; sol panelin içeriği. Diğer
 *   variant'larda DOM'a render edilmez.
 */

export interface PageShellProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  sidebar?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  density?: "user" | "admin";
  variant?: "default" | "auth";
  brand?: ReactNode;
}

export const PageShell = forwardRef<HTMLDivElement, PageShellProps>(
  function PageShell(
    {
      sidebar,
      title,
      subtitle,
      actions,
      toolbar,
      density = "user",
      variant = "default",
      brand,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    if (variant === "auth") {
      return (
        <div
          ref={ref}
          data-density={density}
          data-variant="auth"
          className={cn(
            "grid min-h-screen w-full grid-cols-1 bg-bg text-text md:grid-cols-2",
            className,
          )}
          {...rest}
        >
          <aside
            data-pageshell-brand
            className={cn(
              "hidden flex-col border-r border-border bg-surface-2 p-10",
              "md:flex",
            )}
          >
            {brand}
          </aside>
          <main className="flex min-h-screen flex-col items-center justify-center p-6">
            <div className="flex w-full max-w-sm flex-col gap-6">
              {title ? (
                <div className="flex flex-col gap-1">
                  <div className="text-2xl font-semibold leading-tight text-text">
                    {title}
                  </div>
                  {subtitle ? (
                    <div className="text-xs text-text-muted">{subtitle}</div>
                  ) : null}
                </div>
              ) : null}
              {children}
              {actions ? (
                <div className="flex items-center gap-2">{actions}</div>
              ) : null}
            </div>
          </main>
        </div>
      );
    }

    const hasTopbar = title != null || actions != null;
    return (
      <div
        ref={ref}
        data-density={density}
        className={cn(
          "flex h-screen w-full bg-bg text-text",
          className,
        )}
        {...rest}
      >
        {sidebar}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {hasTopbar ? (
            // R11.14.11 — PageShell topbar AppTopbar canon parity:
            //   - h-16 (64px), pl-6 pr-5 (admin density korur 16px pad)
            //   - title <h1> k-display + text-[24px] + leading-none + tracking-tight
            //   - subtitle inline mono + 10.5px + tracking-meta + uppercase
            // Önceden: title <div class="text-2xl"> + subtitle alt satır xs.
            // AppTopbar (Library/Overview/References/Batches/Selections/
            // Products/Templates/Settings) ile birebir hierarchy parity.
            <div
              className={cn(
                "flex h-16 flex-shrink-0 items-center gap-4 border-b border-border bg-bg",
                density === "admin" ? "pl-4 pr-3" : "pl-6 pr-5",
              )}
            >
              <div className="min-w-0 flex-1">
                {title ? (
                  <div className="flex items-baseline gap-3">
                    <h1 className="k-display truncate text-[24px] font-semibold leading-none tracking-tight text-text">
                      {title}
                    </h1>
                    {subtitle ? (
                      <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-meta text-text-muted">
                        {subtitle}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {actions ? (
                <div className="flex items-center gap-2">{actions}</div>
              ) : null}
            </div>
          ) : null}
          {toolbar ? (
            <div
              className={cn(
                "flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle bg-bg py-3",
                density === "admin" ? "px-4" : "px-6",
              )}
            >
              {toolbar}
            </div>
          ) : null}
          <div
            className={cn(
              "flex-1 overflow-auto",
              density === "admin" ? "p-4" : "p-6",
            )}
          >
            {children}
          </div>
        </main>
      </div>
    );
  },
);
