"use client";

// ReviewQueueToolbar — IA Phase 13 unified review filter bar.
//
// Replaces the previous tab + chip + (no search) split layout with a
// single segmented bar following the Kivasy design system recipes
// (`.k-segment`, `.k-input`). One row, three controls:
//
//   • Source segment   — AI Designs / Local Library  (?source=)
//   • Decision segment — All / Undecided / Kept / Rejected (?decision=)
//   • Search input     — quick filter (?q=, debounced)
//
// CLAUDE.md Madde M (review surface filter bar düzeni) + Madde L
// (Kivasy DS recipe önceliği). The earlier ad-hoc rounded-full chips
// gave a "chip soup" feel that competed with the workspace top bar;
// this toolbar is one premium segmented row.
//
// Behaviour notes
//   - Source change resets `?page=`, `?item=`, `?decision=` (the
//     other source rarely matches the operator's current filter).
//   - Decision change resets `?page=` and `?item=` (the open item
//     may be filtered out).
//   - Search debounces 300ms before pushing `?q=` so each
//     keystroke doesn't write to history. Empty string clears.
//   - All writes go through `buildReviewUrl` — alias-pair logic
//     keeps legacy `?tab=` + `?detail=` from leaking back into
//     the URL.

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { buildReviewUrl } from "@/features/review/lib/search-params";
import { cn } from "@/lib/cn";
import type { DecisionChipValue } from "./ReviewDecisionFilter";

type SourceValue = "ai" | "local";

const SOURCE_OPTIONS: ReadonlyArray<{
  value: SourceValue;
  label: string;
  count?: number;
}> = [
  { value: "ai", label: "AI Designs" },
  { value: "local", label: "Local Library" },
];

const DECISION_OPTIONS: ReadonlyArray<{
  value: DecisionChipValue;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "undecided", label: "Undecided" },
  { value: "kept", label: "Kept" },
  { value: "rejected", label: "Rejected" },
];

const SEARCH_DEBOUNCE_MS = 300;

interface ReviewQueueToolbarProps {
  source: SourceValue;
  decision: DecisionChipValue;
  /** Active search term from `?q=`. Empty string when unset. */
  initialQuery?: string;
  /** Optional pending counts per source — surfaced as a small chip
   *  next to the segment label (e.g. "Local Library · 273"). */
  sourceCounts?: { ai?: number; local?: number };
  /** Optional pending counts per decision (active source). */
  decisionCounts?: {
    all?: number;
    undecided?: number;
    kept?: number;
    rejected?: number;
  };
}

export function ReviewQueueToolbar({
  source,
  decision,
  initialQuery = "",
  sourceCounts,
  decisionCounts,
}: ReviewQueueToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState(initialQuery);

  // Debounce search → URL. The grid re-fetches whenever ?q= changes,
  // so we don't write on every keystroke. Empty value clears the
  // param via `undefined` so the alias-pair helper drops it.
  useEffect(() => {
    if (searchValue === initialQuery) return;
    const handle = setTimeout(() => {
      router.replace(
        buildReviewUrl(pathname, searchParams, {
          q: searchValue.trim() ? searchValue.trim() : undefined,
          page: undefined,
          item: undefined,
        }),
        { scroll: false },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const switchSource = (next: SourceValue) => {
    if (next === source) return;
    router.push(
      buildReviewUrl(pathname, searchParams, {
        source: next,
        page: undefined,
        item: undefined,
        decision: undefined,
        q: undefined,
      }),
    );
  };

  const switchDecision = (next: DecisionChipValue) => {
    if (next === decision) return;
    router.push(
      buildReviewUrl(pathname, searchParams, {
        decision: next === "all" ? undefined : next,
        page: undefined,
        item: undefined,
      }),
    );
  };

  return (
    <div
      role="toolbar"
      aria-label="Review queue toolbar"
      data-testid="review-queue-toolbar"
      className="flex flex-wrap items-center gap-3"
    >
      {/* Source segment */}
      <div
        className="k-segment"
        role="group"
        aria-label="Review source"
        data-testid="toolbar-source-segment"
      >
        {SOURCE_OPTIONS.map((opt) => {
          const isActive = opt.value === source;
          const count =
            opt.value === "ai"
              ? sourceCounts?.ai
              : sourceCounts?.local;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => switchSource(opt.value)}
              data-testid={`toolbar-source-${opt.value}`}
            >
              {opt.label}
              {typeof count === "number" ? (
                <span
                  className={cn(
                    "ml-1 font-mono text-[10.5px] tabular-nums",
                    isActive ? "text-ink-3" : "text-ink-4",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Decision segment */}
      <div
        className="k-segment"
        role="group"
        aria-label="Review decision filter"
        data-testid="toolbar-decision-segment"
      >
        {DECISION_OPTIONS.map((opt) => {
          const isActive = opt.value === decision;
          const count = decisionCounts?.[opt.value];
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => switchDecision(opt.value)}
              data-testid={`toolbar-decision-${opt.value}`}
            >
              {opt.label}
              {typeof count === "number" ? (
                <span
                  className={cn(
                    "ml-1 font-mono text-[10.5px] tabular-nums",
                    isActive ? "text-ink-3" : "text-ink-4",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Search input */}
      <div className="relative ml-auto w-full max-w-xs">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
        <input
          type="search"
          className="k-input !pl-9"
          placeholder={
            source === "local"
              ? "Search file or folder…"
              : "Search prompt or reference…"
          }
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          aria-label="Search review queue"
          data-testid="toolbar-search"
        />
      </div>
    </div>
  );
}
