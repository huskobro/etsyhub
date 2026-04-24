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
 */

export interface PageShellProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  sidebar?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  density?: "user" | "admin";
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
      className,
      children,
      ...rest
    },
    ref,
  ) {
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
            <div
              className={cn(
                "flex h-header flex-shrink-0 items-center gap-4 border-b border-border bg-bg",
                density === "admin" ? "px-4" : "px-6",
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                {title ? (
                  <div className="text-2xl font-semibold leading-tight text-text">
                    {title}
                  </div>
                ) : null}
                {subtitle ? (
                  <div className="mt-0.5 text-xs text-text-muted">
                    {subtitle}
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
