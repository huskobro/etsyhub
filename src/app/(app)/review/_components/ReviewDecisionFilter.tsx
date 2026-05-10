"use client";

// Review canonical decision-axis filter chip group.
//
// Renders a four-chip row — All / Undecided / Kept / Rejected — bound
// to the URL `?decision=` param. Decision wording matches the canonical
// MJReviewDecision axis used by the batch workspace, so the operator
// sees one taxonomy regardless of which review surface they are on.
//
// Behavior is intentionally lightweight:
//   • Chip click writes `?decision=undecided|kept|rejected` (or clears
//     the param when "All" is picked) via the canonical buildReviewUrl
//     helper. The legacy alias auto-clear handles ?tab= vs ?source=.
//   • The actual filtering of the visible items happens client-side
//     inside ReviewQueueList — no server fetch is invalidated, the
//     React Query cache stays warm, and pagination state is left
//     untouched. This keeps the change risk-bounded for the first
//     iteration; we can move filtering down to the queue endpoint in a
//     later pass once we are happy with the UX.
//
// `?item=` is intentionally cleared when the filter changes — the
// drawer's target may not pass the new filter and an empty drawer is
// worse than re-opening one that survives.

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { buildReviewUrl } from "@/features/review/lib/search-params";

export type DecisionChipValue = "all" | "undecided" | "kept" | "rejected";

const CHIPS: ReadonlyArray<{ value: DecisionChipValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "undecided", label: "Undecided" },
  { value: "kept", label: "Kept" },
  { value: "rejected", label: "Rejected" },
];

export function decisionFromParam(raw: string | null | undefined): DecisionChipValue {
  if (!raw) return "all";
  const v = raw.toLowerCase();
  return v === "undecided" || v === "kept" || v === "rejected" ? v : "all";
}

export function ReviewDecisionFilter({
  active,
}: {
  active: DecisionChipValue;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (next: DecisionChipValue) => {
    router.push(
      buildReviewUrl(pathname, searchParams, {
        decision: next === "all" ? undefined : next,
        // Reset the open drawer — the current item may be filtered out.
        item: undefined,
      }),
    );
  };

  return (
    <div
      role="group"
      aria-label="Review decision filter"
      data-testid="review-decision-filter"
      className="flex flex-wrap items-center gap-2"
    >
      {CHIPS.map((chip) => {
        const isActive = chip.value === active;
        return (
          <button
            key={chip.value}
            type="button"
            onClick={() => select(chip.value)}
            data-active={isActive ? "true" : "false"}
            aria-pressed={isActive}
            data-testid={`review-decision-chip-${chip.value}`}
            className={
              isActive
                ? "rounded-full border border-accent bg-accent-soft px-3 py-1 text-xs font-medium text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                : "rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted hover:border-border-strong hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            }
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
