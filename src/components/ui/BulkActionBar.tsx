import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

/**
 * EtsyHub BulkActionBar — spec A.1.11 · canvas screens.jsx:176-197.
 *
 * **Görünürlük davranışı:**
 * - `selectedCount === 0` → primitive `null` döner (render YOK).
 * - `selectedCount > 0` → accent-soft bg, sol checkmark chip, seçim cümlesi,
 *   sağ action slot, opsiyonel dismiss (X).
 *
 * **Yapışma davranışı:**
 * - Default `sticky=false` — content akışında toolbar'ın hemen altında bir
 *   satır olarak durur (canvas Bookmarks davranışı).
 * - `sticky=true` → `sticky top-0 z-10`; parent scroll container'da yukarıda
 *   kalır. Uzun list / tablo ekranları için.
 *
 * **Kapanma davranışı:**
 * - `onDismiss` verilmişse sağda X butonu render olur. Tıklandığında callback
 *   tetiklenir; primitive selection state'i **kendi tutmaz**, parent yönetir.
 * - Dismiss olmadan seçim temizlendiğinde (selectedCount=0) bar kendiliğinden
 *   kaybolur.
 *
 * **Dil:**
 * - `label` → sayı + nesne adı + "seçildi/seçili" gibi Türkçe cümle. Default
 *   şablon: `"{count} öğe seçildi"`.
 * - `selectedLabel` override kullanılıyorsa Türkçe dil korunsun (title-case
 *   YASAK, carry-forward badge dili disiplini).
 *
 * **Dar alan:**
 * - Flex-wrap off (satır kırılmaz), ama action group içi `flex-wrap` ve
 *   `min-w-0` ile label truncate eder. Çok kalabalık aksiyon setlerinde
 *   ekran overflow-menu açsın.
 */

export interface BulkActionBarProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Kaç öğe seçili. 0 ise primitive render etmez. */
  selectedCount: number;
  /** Label override. Verilmezse "{count} öğe seçildi" şablonu kullanılır. */
  label?: ReactNode;
  /** Sağ action slotu (Button grubu). */
  actions?: ReactNode;
  /** X butonu render edilsin; callback seçimi temizlemeyi parent'a bırakır. */
  onDismiss?: () => void;
  /** Sticky top davranışı — uzun içerikli ekranlar için. */
  sticky?: boolean;
}

export const BulkActionBar = forwardRef<HTMLDivElement, BulkActionBarProps>(
  function BulkActionBar(
    {
      selectedCount,
      label,
      actions,
      onDismiss,
      sticky = false,
      className,
      ...rest
    },
    ref,
  ) {
    if (selectedCount <= 0) return null;

    const resolvedLabel = label ?? `${selectedCount} öğe seçildi`;
    return (
      <div
        ref={ref}
        role="region"
        aria-label="Toplu aksiyon"
        data-selected-count={selectedCount}
        className={cn(
          "flex items-center gap-3 rounded-md border border-transparent bg-accent-soft px-3 py-2 text-sm",
          sticky && "sticky top-0 z-10",
          className,
        )}
        {...rest}
      >
        <span
          aria-hidden
          className="flex h-4 w-4 items-center justify-center rounded-sm bg-accent text-accent-foreground"
        >
          <CheckIcon />
        </span>
        <span className="min-w-0 truncate font-medium text-accent-text">
          {resolvedLabel}
        </span>
        {actions ? (
          <div className="ml-auto flex items-center gap-1.5">{actions}</div>
        ) : null}
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Seçimi temizle"
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-sm",
              "text-accent-text hover:bg-accent/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              "transition-colors ease-out duration-fast",
              !actions && "ml-auto",
            )}
          >
            <XIcon />
          </button>
        ) : null}
      </div>
    );
  },
);

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.5L5 9L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 3L9 9M9 3L3 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
