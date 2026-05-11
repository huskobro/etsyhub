"use client";

import { WINDOW_DAYS, type WindowDays } from "@/features/trend-stories/constants";

type Props = {
  value: WindowDays;
  onChange: (next: WindowDays) => void;
  /**
   * Her pencere tab'ı için stabil id. Aktif tabpanel `aria-labelledby` bağı
   * kurulmasını TrendStoriesPage seviyesinde yönetmek için bu mapping
   * dışarıdan gelir (T-34 paterni).
   */
  tabIds: Record<WindowDays, string>;
  /**
   * Her pencere için tabpanel id'si. Tab `aria-controls` bağını kurar.
   */
  panelIds: Record<WindowDays, string>;
};

const LABELS: Record<WindowDays, string> = {
  1: "1 day",
  7: "7 days",
  30: "30 days",
};

/**
 * Trend penceresi tab'ları (1G / 7G / 30G). Hem cluster rail'i hem feed'i
 * aynı pencereye göre senkron filtrelemek için tek kaynak.
 *
 * ARIA: `role="tablist"` + her tab `id` + `aria-controls` + `tabIndex` (aktif
 * 0, diğerleri -1). Tabpanel TrendStoriesPage seviyesinde kurulur (rail+feed
 * birlikte tek panel içeriğidir, 4 ayrı panel YAZILMAZ — carry-forward).
 *
 * Klavye Arrow gez Phase 2 carry-forward.
 */
export function WindowTabs({ value, onChange, tabIds, panelIds }: Props) {
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
            id={tabIds[w]}
            aria-selected={active}
            aria-controls={panelIds[w]}
            tabIndex={active ? 0 : -1}
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
