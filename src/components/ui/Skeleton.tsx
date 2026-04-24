import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * EtsyHub Skeleton — spec A.2.7.
 * Kural: surface-3 bg + `ehPulse` keyframe (opacity 1 ↔ 0.55).
 * **Shimmer gradient yok.** Radius `rounded-sm` default.
 *
 * Atomic `Skeleton` (ölçü/şekil), `SkeletonCard` (grid default 6 sabit kart),
 * `SkeletonRow` (tablo default 5 sabit satır). Boyut default'ları named
 * utility olarak kilitli; `w`/`h`/`r` prop'ları isteyen ekranlar için.
 */

export type SkeletonShape = "line" | "text" | "rect" | "circle";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  shape?: SkeletonShape;
}

const shapeClasses: Record<SkeletonShape, string> = {
  line: "h-3 w-full rounded-sm",
  text: "h-4 w-3/4 rounded-sm",
  rect: "h-20 w-full rounded-sm",
  circle: "h-8 w-8 rounded-full",
};

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { shape = "line", className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "block bg-surface-3 animate-ehPulse",
        shapeClasses[shape],
        className,
      )}
      {...rest}
    />
  );
});

/**
 * SkeletonCard — thumbnail + title + meta skeleton.
 * Bookmark/Reference grid kartının iskeletini birebir taşır.
 */
function SkeletonCardItem() {
  return (
    <div className="rounded-md border border-border bg-surface shadow-card overflow-hidden">
      <Skeleton shape="rect" className="h-auto aspect-card rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-3 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-14 rounded-sm" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

export interface SkeletonCardGridProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Skeleton kart sayısı — spec default **6** (user grid).
   * Shimmer/random boyut yasak; sayı da sabit, ekran bunu değiştirmemeli.
   */
  count?: number;
}

export const SkeletonCardGrid = forwardRef<HTMLDivElement, SkeletonCardGridProps>(
  function SkeletonCardGrid({ count = 6, className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        role="status"
        aria-label="Yükleniyor"
        className={cn(
          "grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
          className,
        )}
        {...rest}
      >
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCardItem key={i} />
        ))}
      </div>
    );
  },
);

export interface SkeletonTableProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Skeleton satır sayısı — spec default **5** (admin tablo).
   * Her satırda her kolon skeleton taşır.
   */
  rows?: number;
  /**
   * Kolon sayısı. Default **4** (admin density tablosu asgari set).
   */
  columns?: number;
}

export const SkeletonTable = forwardRef<HTMLDivElement, SkeletonTableProps>(
  function SkeletonTable({ rows = 5, columns = 4, className, ...rest }, ref) {
    const colWidths = ["w-1/4", "w-1/3", "w-1/5", "w-2/5", "w-1/2", "w-1/6"];
    return (
      <div
        ref={ref}
        role="status"
        aria-label="Yükleniyor"
        className={cn(
          "rounded-md border border-border bg-surface divide-y divide-border-subtle",
          className,
        )}
        {...rest}
      >
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 h-12">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn("h-3", colWidths[c % colWidths.length])}
              />
            ))}
          </div>
        ))}
      </div>
    );
  },
);
