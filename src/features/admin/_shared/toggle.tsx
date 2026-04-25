import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Admin Toggle — yerel yardımcı.
 *
 * Implementation brief 5.1 (carry-forward #1): Toggle bilinçli olarak
 * `src/components/ui/` altına çekilmedi. İki admin ekranı (Product Types ve
 * Feature Flags) bu tek dosyayı tüketir. Üçüncü admin ekranı Toggle'a
 * dokunduğu **o sprintte** primitive katmanına terfi edilir; o güne kadar
 * burada kalır. Sözleşme terfide korunur:
 *   `on: boolean`, `onChange: (next: boolean) => void`, `size?: 'sm'|'md'`,
 *   `disabled?: boolean`.
 *
 * Yasak: "Şimdiden çekirdeğe alalım, belki lazım olur" eğilimi. Prop
 * sözleşmesi 3. kullanıma kadar tam olgunlaşmaz.
 */

export type ToggleSize = "sm" | "md";

export interface ToggleProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange" | "type" | "children"
  > {
  on: boolean;
  onChange: (next: boolean) => void;
  size?: ToggleSize;
  disabled?: boolean;
  /** Ekran okuyucu için. Görünür label varsa gerekmez. */
  "aria-label"?: string;
}

const TRACK_DIM: Record<ToggleSize, string> = {
  sm: "h-4 w-7",
  md: "h-5 w-9",
};

const THUMB_DIM: Record<ToggleSize, string> = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
};

const THUMB_TRANSLATE: Record<ToggleSize, string> = {
  sm: "translate-x-3",
  md: "translate-x-4",
};

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { on, onChange, size = "md", disabled, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent",
        "transition-colors duration-fast ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:cursor-not-allowed disabled:opacity-50",
        TRACK_DIM[size],
        on ? "bg-accent" : "bg-border",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block translate-x-0.5 rounded-full bg-surface shadow-card",
          "transition-transform duration-fast ease-out",
          THUMB_DIM[size],
          on ? THUMB_TRANSLATE[size] : "translate-x-0.5",
        )}
      />
    </button>
  );
});
