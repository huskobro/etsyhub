import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

/**
 * EtsyHub Toolbar — spec A.1.11 · canvas screens.jsx:141.
 *
 * **Rol:** sayfa başlığı altında opsiyonel üst bant — shell/container. Kendi
 * border'ını taşımaz; çünkü `PageShell.toolbar` slot'u zaten bant
 * border-bottom-subtle + padding veriyor. Dar kullanımda (bir ekranın iç
 * bölümü) `standalone` prop'u ile kendi border + padding'ini açar.
 *
 * **Ayrım:**
 * - Toolbar nötr içerik taşır (search + chip row + actions + view toggle).
 *   Filtre semantiğini `FilterBar` taşır (role + aria-label).
 * - Toolbar yalnızca yerleşim; içeri konan componentlerin semantiğine
 *   karışmaz.
 *
 * **Slot yapısı:**
 * - `leading`: sol slot — genelde Input (search). Sabit genişlik kullanım için
 *   parent sarmalıyla boyutlanır.
 * - `children`: merkez akış — FilterBar veya manuel Chip row vs.
 * - `trailing`: sağ slot — actions / view toggle; `ml-auto` ile sağa yapışır.
 *
 * **Wrap:** default `flex-wrap`. Dar alanda children alt satıra geçer, trailing
 * sağda kalmaya devam eder (ml-auto).
 */

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Kendi kabuğunda duracaksa (PageShell.toolbar slotu dışında). */
  standalone?: boolean;
}

export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(function Toolbar(
  { leading, trailing, standalone = false, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      role="toolbar"
      className={cn(
        "flex flex-wrap items-center gap-2",
        standalone && "rounded-md border border-border-subtle bg-surface px-3 py-2",
        className,
      )}
      {...rest}
    >
      {leading}
      {leading && children ? <ToolbarDivider /> : null}
      {children}
      {trailing ? <div className="ml-auto flex items-center gap-2">{trailing}</div> : null}
    </div>
  );
});

/**
 * ToolbarDivider — 1×20px dikey border-renk çubuk. Canvas screens.jsx:145.
 * Toolbar içinde search ile chip row arasında görsel ayrım için.
 */
export function ToolbarDivider({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block h-5 w-px bg-border", className)}
    />
  );
}
