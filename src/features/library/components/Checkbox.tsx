"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Library-scope minimal checkbox — Kivasy v4 `.k-checkbox` recipe.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx → Checkbox.
 * Filled orange when checked. Used inside LibraryAssetCard top-left and
 * (rollout-3) Batch items grid. Promoted to src/components/ui/ when the
 * second consumer lands.
 */

interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  ariaLabel,
  className,
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "inline-flex h-4 w-4 items-center justify-center rounded border-[1.5px] transition-colors",
        checked
          ? "border-k-orange bg-k-orange text-white"
          : "border-line-strong bg-paper hover:border-ink-3",
        className,
      )}
    >
      {checked ? (
        <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
      ) : null}
    </button>
  );
}
