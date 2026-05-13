"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Kivasy FloatingBulkBar — bottom-center bulk action bar.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/tokens.css → `.k-fab`.
 * Appears when `count >= 2` per docs/IMPLEMENTATION_HANDOFF.md §1 design
 * principle. Lives inside dark surface (#16130F) for legibility against
 * any underlying canvas.
 *
 * Pattern reused in Library (rollout-2), Batches Items (rollout-3),
 * Selections Designs tab (rollout-4).
 */

export interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  /** Primary action gets the orange fill. Only one allowed per bar. */
  primary?: boolean;
  disabled?: boolean;
  /** Phase 46 — optional per-action data-testid for surface-specific
   *  selectors (e.g. references-bulk-add-to-draft). */
  testId?: string;
}

interface FloatingBulkBarProps {
  count: number;
  /** Hide the bar (count < 2 typically). Render-side optimization is the
   *  caller's job; this component renders whatever count is passed. */
  actions: BulkAction[];
  onClear: () => void;
  className?: string;
  /** Phase 46 — optional data-testid on the toolbar root. Useful when
   *  several FloatingBulkBar consumers coexist (References + Library
   *  + Selections) and tests need to scope by surface. */
  testId?: string;
}

export function FloatingBulkBar({
  count,
  actions,
  onClear,
  className,
  testId,
}: FloatingBulkBarProps) {
  return (
    <div
      role="toolbar"
      aria-label={`${count} selected — bulk actions`}
      data-testid={testId}
      className={cn(
        "k-fab fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl px-4 py-1.5",
        className,
      )}
    >
      <span className="k-fab__count font-mono text-xs tracking-meta">
        {count} selected
      </span>
      {actions.map((action, idx) => (
        <button
          key={idx}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          data-testid={action.testId}
          className={cn(
            "k-fab__btn inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
            action.primary && "k-fab__btn--primary",
          )}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="k-fab__close inline-flex h-7 w-7 items-center justify-center rounded-md"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
