"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Kivasy DetailPanel — right-side slide-in 460w panel.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/tokens.css → `.k-detail`.
 * Composes header / body / footer slots with internal scroll. Used by Library
 * (rollout-2) for asset detail; reused in Batches Items (rollout-3),
 * References (rollout-6).
 *
 * The panel is a positioned aside on desktop. Mobile counterpart (full-screen
 * sheet) deferred to rollout-2 mobile pass.
 */

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  /** Header content — typically a title + meta line. Receives close button next to it. */
  header: React.ReactNode;
  /** Footer slot for primary CTA + ghost actions. */
  footer?: React.ReactNode;
  /** Body content (scrollable). */
  children: React.ReactNode;
  className?: string;
}

export function DetailPanel({
  open,
  onClose,
  header,
  footer,
  children,
  className,
}: DetailPanelProps) {
  if (!open) return null;
  return (
    <aside
      role="complementary"
      aria-label="Detail panel"
      className={cn(
        // v4 panel canonical width — DesignPanel pattern
        // eslint-disable-next-line no-restricted-syntax
        "fixed right-0 top-0 z-50 flex h-screen w-[460px] max-w-[90vw] flex-col border-l border-line bg-paper shadow-popover",
        className,
      )}
    >
      <header className="flex items-center gap-2 border-b border-line px-5 py-4">
        <div className="flex-1 min-w-0">{header}</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-2 hover:border-line-strong hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer ? (
        <div className="flex items-center gap-2 border-t border-line px-5 py-3">
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
