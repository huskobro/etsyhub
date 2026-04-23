"use client";

import { WINDOW_DAYS, type WindowDays } from "@/features/trend-stories/constants";

type Props = {
  value: WindowDays;
  onChange: (next: WindowDays) => void;
};

const LABELS: Record<WindowDays, string> = {
  1: "1 Gün",
  7: "7 Gün",
  30: "30 Gün",
};

/**
 * Trend penceresi tab'ları (1G / 7G / 30G). Hem cluster rail'i hem feed'i
 * aynı pencereye göre senkron filtrelemek için tek kaynak.
 */
export function WindowTabs({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Trend zaman penceresi"
      className="flex flex-wrap gap-2"
    >
      {WINDOW_DAYS.map((w) => {
        const active = w === value;
        return (
          <button
            key={w}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(w)}
            className={
              active
                ? "rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                : "rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            }
          >
            {LABELS[w]}
          </button>
        );
      })}
    </div>
  );
}
