"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import type { Density } from "@/components/ui/DensityToggle";
import { DensityToggle } from "@/components/ui/DensityToggle";
import { FilterChip } from "@/components/ui/FilterChip";

/**
 * LibraryToolbar — Kivasy A1 toolbar.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a1-a2.jsx
 * → A1Library toolbar.
 *
 * URL state contract (preserved from legacy /admin/midjourney/library):
 *   ?days=recent|7d|30d|all
 *   ?variantKind=GRID|UPSCALE|VARIATION|DESCRIBE
 *   ?reviewDecision=KEPT|UNDECIDED|REJECTED
 *   ?q=...
 *   ?batchId=... ?templateId=... ?parentAssetId=...   (scope chips)
 *
 * The legacy text-based dropdown ergonomics (chip → dropdown popover) is
 * deferred to rollout-2.5; this toolbar exposes the most-used filters as
 * direct cycle-buttons (Kept · Variants · Date) and leaves scope chips
 * (batch/template/parent) as removable indicators.
 */

const DAY_LABELS: Record<string, string> = {
  recent: "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

const DECISION_LABELS: Record<string, string> = {
  all: "All",
  KEPT: "Kept",
  UNDECIDED: "Pending",
  REJECTED: "Rejected",
};

const VARIANT_LABELS: Record<string, string> = {
  ALL: "All types",
  GRID: "Grid",
  UPSCALE: "Upscale",
  VARIATION: "Variation",
  DESCRIBE: "Describe",
};

interface LibraryToolbarProps {
  totalLabel: string;
  density: Density;
  onDensityChange: (next: Density) => void;
}

export function LibraryToolbar({
  totalLabel,
  density,
  onDensityChange,
}: LibraryToolbarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const currentDays = params.get("days") ?? "recent";
  const currentVariant = params.get("variantKind") ?? "ALL";
  const currentDecision = params.get("reviewDecision") ?? "all";
  const currentBatchId = params.get("batchId");
  const currentTemplateId = params.get("templateId");
  const currentParentAssetId = params.get("parentAssetId");
  const [keyword, setKeyword] = useState(params.get("q") ?? "");

  function pushWith(updater: (sp: URLSearchParams) => void) {
    const sp = new URLSearchParams(params.toString());
    sp.delete("cursorId");
    updater(sp);
    const qs = sp.toString();
    startTransition(() => {
      router.push(qs ? `/library?${qs}` : "/library");
    });
  }

  function cycleDays() {
    const order = ["recent", "30d", "all"];
    const next = order[(order.indexOf(currentDays) + 1) % order.length] ?? "recent";
    pushWith((sp) => {
      if (next === "recent") sp.delete("days");
      else sp.set("days", next);
    });
  }

  function cycleVariant() {
    const order = ["ALL", "GRID", "UPSCALE", "VARIATION", "DESCRIBE"];
    const next = order[(order.indexOf(currentVariant) + 1) % order.length] ?? "ALL";
    pushWith((sp) => {
      if (next === "ALL") sp.delete("variantKind");
      else sp.set("variantKind", next);
    });
  }

  function cycleDecision() {
    const order = ["all", "KEPT", "UNDECIDED", "REJECTED"];
    const next = order[(order.indexOf(currentDecision) + 1) % order.length] ?? "all";
    pushWith((sp) => {
      if (next === "all") sp.delete("reviewDecision");
      else sp.set("reviewDecision", next);
    });
  }

  function clearScope(key: string) {
    pushWith((sp) => sp.delete(key));
  }

  function applyKeyword(e: React.FormEvent) {
    e.preventDefault();
    pushWith((sp) => {
      const q = keyword.trim();
      if (q.length === 0) sp.delete("q");
      else sp.set("q", q);
    });
  }

  function clearAll() {
    setKeyword("");
    startTransition(() => {
      router.push("/library");
    });
  }

  const hasAnyFilter =
    currentDays !== "recent" ||
    currentVariant !== "ALL" ||
    currentDecision !== "all" ||
    currentBatchId !== null ||
    currentTemplateId !== null ||
    currentParentAssetId !== null ||
    (params.get("q") ?? "").length > 0;

  return (
    <div
      className="flex flex-col gap-2 border-b border-line bg-bg px-6 py-3"
      data-testid="library-toolbar"
    >
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={applyKeyword}
          className="relative flex flex-1 max-w-md items-center"
        >
          <Search
            className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-ink-3"
            aria-hidden
          />
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search by prompt, batch id, template…"
            disabled={pending}
            className="h-8 w-full rounded-md border border-line bg-paper pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft disabled:opacity-50"
            data-testid="library-search-input"
          />
        </form>

        <FilterChip
          active={currentDecision !== "all"}
          caret
          onClick={cycleDecision}
        >
          {DECISION_LABELS[currentDecision] ?? "Status"}
        </FilterChip>
        <FilterChip
          active={currentVariant !== "ALL"}
          caret
          onClick={cycleVariant}
        >
          {VARIANT_LABELS[currentVariant] ?? "Type"}
        </FilterChip>
        <FilterChip
          active={currentDays !== "recent"}
          caret
          onClick={cycleDays}
        >
          {DAY_LABELS[currentDays] ?? "Date"}
        </FilterChip>

        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-meta text-ink-3">
            {totalLabel}
          </span>
          <DensityToggle
            surfaceKey="library"
            defaultValue={density}
            onChange={onDensityChange}
          />
        </div>
      </div>

      {/* Scope chips (batch/template/parent) — visible when set, removable. */}
      {currentBatchId || currentTemplateId || currentParentAssetId || hasAnyFilter ? (
        <div className="flex flex-wrap items-center gap-2">
          {currentBatchId ? (
            <FilterChip
              active
              removable
              onRemove={() => clearScope("batchId")}
            >
              <span className="font-mono">batch {currentBatchId.slice(0, 8)}</span>
            </FilterChip>
          ) : null}
          {currentTemplateId ? (
            <FilterChip
              active
              removable
              onRemove={() => clearScope("templateId")}
            >
              <span className="font-mono">tmpl {currentTemplateId.slice(0, 8)}</span>
            </FilterChip>
          ) : null}
          {currentParentAssetId ? (
            <FilterChip
              active
              removable
              onRemove={() => clearScope("parentAssetId")}
            >
              <span className="font-mono">parent {currentParentAssetId.slice(0, 8)}</span>
            </FilterChip>
          ) : null}
          {hasAnyFilter ? (
            <button
              type="button"
              onClick={clearAll}
              disabled={pending}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-2 hover:text-ink"
              data-testid="library-clear-filters"
            >
              <X className="h-3 w-3" aria-hidden />
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
