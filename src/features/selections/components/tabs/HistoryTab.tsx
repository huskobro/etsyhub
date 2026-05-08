"use client";

import { cn } from "@/lib/cn";

/**
 * HistoryTab — B3 History tab, timeline.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b2-b3.jsx →
 * B3History.
 *
 * R4 surface: snapshot-derived timeline (created / edits / finalized /
 * exported) — derived in `SelectionDetailClient.buildPlaceholderHistory`.
 * R5+ joins Audit log for richer history (per-edit-op rows, mockup apply
 * runs, etc.).
 */

export interface HistoryEvent {
  /** ISO timestamp. */
  timestamp: string;
  label: string;
  meta: string;
}

interface HistoryTabProps {
  events: HistoryEvent[];
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function HistoryTab({ events }: HistoryTabProps) {
  if (events.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center">
          <h3 className="text-base font-semibold text-ink">No history yet</h3>
          <p className="mt-1 text-sm text-text-muted">
            Selection events appear here as the set moves through stages.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-5"
      data-testid="selection-history-tab"
    >
      <div className="overflow-hidden rounded-md border border-line bg-paper">
        {events.map((e, idx) => (
          <div
            key={`${e.timestamp}-${idx}`}
            className={cn(
              "flex items-start gap-4 px-4 py-3",
              idx < events.length - 1 && "border-b border-line-soft",
            )}
          >
            <span className="w-20 pt-0.5 font-mono text-xs tabular-nums tracking-wider text-ink-3">
              {relativeTime(e.timestamp)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-ink">{e.label}</div>
              <div className="mt-0.5 font-mono text-xs tracking-wider text-ink-3">
                {e.meta}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
