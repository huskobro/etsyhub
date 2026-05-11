import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

/**
 * Kivasy FilterBar — spec A.1.11 · canvas screens.jsx:146-151.
 *
 * **Rol:** Chip bazlı filtre grubu. Toolbar'ın içinde veya tek başına (drawer)
 * kullanılabilir. Semantik yüzey: `role="group"` + `aria-label="Filtreler"`.
 *
 * **Filtre içeriği dışarıdan gelir:** FilterBar kendi Chip listesini
 * üretmez — ekran kendi filter state'ini Chip çocuklarına bağlar. Primitive
 * sadece yerleşim + semantik.
 *
 * **Opsiyonel clear all:** `onClearAll` + `clearLabel` verilmişse sağda bir
 * "Temizle" butonu render eder. Aksi halde clear UI yok.
 *
 * **Dar alan:** `flex-wrap` — Chip'ler alt satıra geçer. Scroll davranışı
 * (yatay scroll chip strip) ileride mobilde ayrı primitive olarak ele
 * alınacak; foundation'da flex-wrap yeterli.
 */

export interface FilterBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Aria-label — varsayılan "Filtreler". Farklı ekran için override. */
  ariaLabel?: string;
  /** Sağda render edilecek "Temizle" etiketi. Verildiğinde onClearAll zorunlu. */
  clearLabel?: string;
  /** Clear all çağrısı — clearLabel verildiğinde butona bağlanır. */
  onClearAll?: () => void;
  /** Clear butonu slotu override etmek için — özel buton gerekirse. */
  clearSlot?: ReactNode;
}

export const FilterBar = forwardRef<HTMLDivElement, FilterBarProps>(
  function FilterBar(
    {
      ariaLabel = "Filtreler",
      clearLabel,
      onClearAll,
      clearSlot,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    const hasClear = Boolean(clearSlot) || Boolean(clearLabel && onClearAll);
    return (
      <div
        ref={ref}
        role="group"
        aria-label={ariaLabel}
        className={cn("flex flex-wrap items-center gap-2", className)}
        {...rest}
      >
        {children}
        {hasClear ? (
          <span className="ml-1">
            {clearSlot ?? (
              <button
                type="button"
                onClick={onClearAll}
                className="font-mono text-xs text-text-subtle hover:text-text transition-colors ease-out duration-fast"
              >
                {clearLabel}
              </button>
            )}
          </span>
        ) : null}
      </div>
    );
  },
);
