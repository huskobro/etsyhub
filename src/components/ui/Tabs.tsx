"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Kivasy Tabs — `.k-tabs` recipe (primary tabs, orange underline).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx → Tabs.
 * Used by Batch detail (rollout-3), Selection detail (rollout-4),
 * Product detail (rollout-5), and the Listing post-generation handoff.
 *
 * Each tab can either be an internal link (rendered as `<Link>`) or a pure
 * client-side button (no `href`). Link mode preserves SSR-friendly URL state.
 */

export interface TabItem {
  id: string;
  label: string;
  /** Mono numeric chip next to the label (item count, etc). */
  count?: number;
  /** Internal link target (URL state). If absent, tab is a button. */
  href?: string;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange?: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-0 border-b border-line",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const content = (
          <>
            <span>{tab.label}</span>
            {tab.count !== undefined ? (
              <span className="ml-1.5 inline-flex items-center rounded bg-k-bg-2 px-1.5 py-0.5 font-mono text-xs tabular-nums text-ink-3">
                {tab.count}
              </span>
            ) : null}
            {isActive ? (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-[-1px] h-0.5 rounded-t bg-k-orange"
              />
            ) : null}
          </>
        );
        const baseClass = cn(
          "relative inline-flex h-11 items-center px-1 mr-6 text-sm font-medium transition-colors outline-none",
          isActive
            ? "text-ink"
            : "text-ink-3 hover:text-ink-2",
          tab.disabled && "opacity-50 pointer-events-none",
        );

        if (tab.href) {
          return (
            <Link
              key={tab.id}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              className={baseClass}
              data-tab-id={tab.id}
            >
              {content}
            </Link>
          );
        }
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(tab.id)}
            disabled={tab.disabled}
            className={baseClass}
            data-tab-id={tab.id}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
