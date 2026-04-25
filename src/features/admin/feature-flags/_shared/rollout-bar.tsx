import { cn } from "@/lib/cn";

export interface RolloutBarProps {
  /** 0-100 arası yüzde */
  percent: number;
  /** Erişilebilirlik etiketi */
  "aria-label"?: string;
  className?: string;
}

/**
 * Rollout Bar — yerel yardımcı (Feature Flags 1. kullanım).
 *
 * Canvas: screens-b.jsx artboard AdminFeatureFlags (satır 350-355).
 * Tek tüketici (FlagsTable) olduğu sürece yerel kalır. 2. tüketici (örn.
 * Cost Usage ekranındaki quota progress bar) geldiği sprintte
 * `src/components/ui/progress-bar.tsx` altına terfi edilir; sözleşme korunur:
 *   `percent` (0-100), `aria-label`.
 *
 * Yasak: "ileride lazım olur" eğilimiyle erken terfi. Primitive sözleşmesi
 * 2. kullanıma kadar olgunlaşmaz.
 *
 * Token disiplini: Tailwind arbitrary value (`w-[X%]`) yasak olduğu için
 * dinamik genişliği **inline style** ile veriyoruz — kasıtlı escape hatch.
 * Bu dosya `scripts/check-tokens.ts` whitelist'ine eklendi.
 */
export function RolloutBar({
  percent,
  className,
  ...rest
}: RolloutBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = clamped === 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("flex items-center gap-2", className)}
      {...rest}
    >
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={cn(
            "h-full transition-all duration-fast",
            filled ? "bg-success" : "bg-accent",
          )}
          // Tailwind arbitrary value `w-[X%]` yasak; dinamik yüzde için
          // kasıtlı inline-style escape hatch. Bkz.
          // docs/plans/admin-feature-flags-data-model.md.
          // eslint-disable-next-line no-restricted-syntax
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-xs tabular-nums text-text-muted">
        {clamped}%
      </span>
    </div>
  );
}
