"use client";

import { cn } from "@/lib/cn";

/**
 * Kivasy ProgressBar — `.k-progress` recipe.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/tokens.css → .k-progress.
 * Promoted to a shared primitive in rollout-3 (third consumer threshold —
 * RolloutBar / Batch Review Studio progress / ActiveTasksPanel).
 *
 * The `style.width` inline is the documented escape hatch (Tailwind
 * arbitrary `w-[X%]` is forbidden by the lint rule); the file is whitelisted
 * in scripts/check-tokens.ts.
 */

interface ProgressBarProps {
  /** 0-100 percent. Values outside the range are clamped. */
  value: number;
  /** Variant — orange (running), blue (info), green (succeeded), amber (warn). */
  tone?: "orange" | "info" | "success" | "warning" | "danger";
  /** Visual height — sm (4px) / md (6px) / lg (8px). Default sm. */
  size?: "sm" | "md" | "lg";
  className?: string;
  ariaLabel?: string;
}

export function ProgressBar({
  value,
  tone = "orange",
  size = "sm",
  className,
  ariaLabel,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const heightClass =
    size === "lg" ? "h-2" : size === "md" ? "h-1.5" : "h-1";
  const fillBg =
    tone === "info"
      ? "bg-info"
      : tone === "success"
        ? "bg-success"
        : tone === "warning"
          ? "bg-warning"
          : tone === "danger"
            ? "bg-danger"
            : "bg-gradient-to-r from-k-orange-bright to-k-orange";

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={cn(
        "relative overflow-hidden rounded-full bg-line-soft",
        heightClass,
        className,
      )}
    >
      <div
        className={cn("absolute inset-y-0 left-0 rounded-full", fillBg)}
        // eslint-disable-next-line no-restricted-syntax
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
