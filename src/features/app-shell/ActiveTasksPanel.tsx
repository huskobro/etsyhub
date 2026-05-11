"use client";

import { useState } from "react";
import { ChevronDown, X, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Kivasy Active Tasks Panel — persistent floating panel (rollout-1 scaffold).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx → ActiveTasks.
 * Lives bottom-right on every (app) page. Collapses to a small pill when
 * empty or dismissed; expands to a 320-340px panel showing 1-3 active jobs
 * with progress bar + ETA.
 *
 * Rollout-1: data is sourced via props from the layout (placeholder data).
 * Rollout-3 wires this to the unified active-job stream once Batches lands.
 *
 * Mobile (deferred to rollout-2): becomes a swipe-up bottom drawer.
 */

export interface ActiveTask {
  id: string;
  label: string;
  detail: string;
  done: number;
  total: number;
  /** Relative ETA, e.g. "~3m". Undefined = no ETA shown. */
  eta?: string;
  /** Click target — typically the batch detail page once that exists. */
  href?: string;
}

export interface ActiveTasksPanelProps {
  tasks: ActiveTask[];
  /** Total active count across the workspace — informs the header summary
   *  even when this panel only renders the top 3 tasks. */
  totalActive?: number;
  /** Aggregate ETA caption shown in the header. */
  totalEta?: string;
  /** Initially collapsed; default false (open). */
  defaultCollapsed?: boolean;
}

export function ActiveTasksPanel({
  tasks,
  totalActive,
  totalEta,
  defaultCollapsed = false,
}: ActiveTasksPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const visibleTasks = tasks.slice(0, 3);
  const count = totalActive ?? tasks.length;

  if (count === 0) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="k-tasks-pill fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2 shadow-card hover:shadow-card-hover"
        aria-label={`${count} active tasks · expand panel`}
      >
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-k-orange" />
          <span className="absolute -inset-0.5 animate-ehPulse rounded-full bg-k-orange/40" />
        </span>
        <span className="font-mono text-xs tracking-meta text-text-muted">
          Active · {count}
        </span>
      </button>
    );
  }

  return (
    <aside
      role="region"
      aria-label="Active tasks"
      // eslint-disable-next-line no-restricted-syntax
      className="k-tasks fixed bottom-5 right-5 z-40 w-[340px] overflow-hidden rounded-lg border border-line bg-paper shadow-popover"
    >
      <header className="flex items-center gap-2 px-4 pb-3 pt-4">
        <CircularRing count={count} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-none text-ink">
            Active tasks
          </div>
          {/* eslint-disable-next-line no-restricted-syntax */}
          <div className="mt-1 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            {count} running{totalEta ? ` · ${totalEta} left` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse"
          className="k-iconbtn-sm flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-2 hover:border-line-strong hover:text-ink"
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss panel"
          className="k-iconbtn-sm flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-2 hover:border-line-strong hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </header>

      <div className="space-y-3 px-4 pb-4">
        {visibleTasks.map((task) => (
          <ActiveTaskRow key={task.id} task={task} />
        ))}
      </div>

      {count > visibleTasks.length ? (
        <footer className="flex items-center justify-between border-t border-line-soft bg-k-bg-2/40 px-4 py-2.5">
          {/* eslint-disable-next-line no-restricted-syntax */}
          <span className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
            Workspace queue
          </span>
          {/* eslint-disable-next-line no-restricted-syntax */}
          <span className="flex items-center gap-1 font-mono text-[10.5px] text-k-orange-ink">
            +{count - visibleTasks.length} more
            <MoreHorizontal className="h-3 w-3" aria-hidden />
          </span>
        </footer>
      ) : null}
    </aside>
  );
}

function ActiveTaskRow({ task }: { task: ActiveTask }) {
  const pct = task.total > 0 ? (task.done / task.total) * 100 : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium leading-tight text-ink">
            {task.label}
          </div>
          {/* eslint-disable-next-line no-restricted-syntax */}
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-meta text-ink-3">
            {task.detail}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs font-medium tabular-nums text-ink">
            {task.done}/{task.total}
          </div>
          {task.eta ? (
            // eslint-disable-next-line no-restricted-syntax
            <div className="mt-0.5 font-mono text-[10px] text-ink-3">
              {task.eta}
            </div>
          ) : null}
        </div>
      </div>
      <div className="relative h-1 overflow-hidden rounded-full bg-line-soft">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-k-orange-bright to-k-orange",
          )}
          // eslint-disable-next-line no-restricted-syntax
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CircularRing({ count }: { count: number }) {
  // Static visual indicator; ring fill is illustrative, not data-bound.
  // Becomes data-bound in rollout-3 when the unified job stream lands.
  const dash = 56.5;
  const offset = count > 0 ? 22 : dash;
  return (
    <div className="relative flex h-6 w-6 items-center justify-center">
      <svg width="22" height="22" viewBox="0 0 22 22" className="-rotate-90">
        <circle
          cx="11"
          cy="11"
          r="9"
          fill="none"
          // eslint-disable-next-line no-restricted-syntax
          stroke="rgba(22,19,15,0.08)"
          strokeWidth="2"
        />
        <circle
          cx="11"
          cy="11"
          r="9"
          fill="none"
          stroke="var(--k-orange)"
          strokeWidth="2"
          strokeDasharray={dash}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
