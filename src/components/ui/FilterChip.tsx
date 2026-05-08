"use client";

import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Kivasy FilterChip — `.k-chip` recipe.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/tokens.css →
 * `.k-chip` / `.k-chip--active`. Used in toolbar filter rows across
 * Library, Batches, Selections, Products, References (rollouts 2-7).
 *
 * Variants:
 * - default: paper bg, line border, ink-2 text
 * - active:  orange-soft bg, orange-ink text, no border outline
 * - removable: trailing × that calls `onRemove` (active scope chip pattern)
 */

interface FilterChipProps {
  active?: boolean;
  caret?: boolean;
  removable?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FilterChip({
  active = false,
  caret = false,
  removable = false,
  onClick,
  onRemove,
  disabled,
  className,
  children,
}: FilterChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
        active
          ? "border-transparent bg-k-orange-soft text-k-orange-ink"
          : "border-line bg-paper text-ink-2 hover:border-line-strong hover:text-ink",
        disabled && "opacity-50",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 outline-none"
      >
        <span>{children}</span>
        {caret ? (
          <ChevronDown className="h-3 w-3 text-ink-3" aria-hidden />
        ) : null}
      </button>
      {removable ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          disabled={disabled}
          aria-label="Remove filter"
          className="inline-flex h-4 w-4 items-center justify-center rounded opacity-70 hover:opacity-100"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
