/* eslint-disable no-restricted-syntax */
// SelectionsIndexClient — Kivasy B2 search input border-radius `rounded-md`
// + Tailwind `max-w-[420px]` v5 toolbar sabitleri tokenize edilmedi
// (Batches/Library ile tutarlı). Whitelisted in scripts/check-tokens.ts.
"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { FilterChip } from "@/components/ui/FilterChip";
import {
  type Density,
  DensityToggle,
} from "@/components/ui/DensityToggle";
import { SelectionCard } from "./SelectionCard";
import {
  deriveStage,
  type SelectionStage,
} from "@/features/selections/state-helpers";

/**
 * SelectionsIndexClient — B2 Selections grid (2-col) + toolbar.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b2-b3.jsx →
 * B2SelectionsIndex.
 *
 * Boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Selections = curated sets ready for mockup application. Bulk-select
 *   YOK index seviyesinde — kart kebab tek-set işlemleri içindir.
 */

export interface SelectionRow {
  id: string;
  name: string;
  status: "draft" | "ready" | "archived";
  itemCount: number;
  editedItemCount: number;
  thumbsComposite: (string | null)[];
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  lastExportedAt: string | null;
}

interface SelectionsIndexClientProps {
  rows: SelectionRow[];
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const ALL_STAGES: ReadonlyArray<SelectionStage | "all"> = [
  "all",
  "Curating",
  "Edits",
  "Mockup ready",
  "Sent",
];

export function SelectionsIndexClient({ rows }: SelectionsIndexClientProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [keyword, setKeyword] = useState(params.get("q") ?? "");
  const [density, setDensity] = useState<Density>("comfortable");
  const stageFilter =
    (params.get("stage") as SelectionStage | "all" | null) ?? "all";

  const enriched = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        stage: deriveStage({
          status: r.status,
          finalizedAt: r.finalizedAt,
          lastExportedAt: r.lastExportedAt,
          editedItemCount: r.editedItemCount,
        }),
      })),
    [rows],
  );

  const filtered = useMemo(() => {
    return enriched.filter((r) => {
      if (stageFilter !== "all" && r.stage !== stageFilter) return false;
      if (keyword.trim().length > 0) {
        const q = keyword.trim().toLowerCase();
        if (!r.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [enriched, stageFilter, keyword]);

  function cycleStage() {
    const idx = ALL_STAGES.indexOf(stageFilter);
    const next = ALL_STAGES[(idx + 1) % ALL_STAGES.length] ?? "all";
    const sp = new URLSearchParams(params.toString());
    if (next === "all") sp.delete("stage");
    else sp.set("stage", next);
    const qs = sp.toString();
    router.push(qs ? `/selections?${qs}` : "/selections");
  }

  function applyKeyword(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams(params.toString());
    const q = keyword.trim();
    if (q.length === 0) sp.delete("q");
    else sp.set("q", q);
    const qs = sp.toString();
    router.push(qs ? `/selections?${qs}` : "/selections");
  }

  const mockupReadyCount = enriched.filter(
    (r) => r.stage === "Mockup ready",
  ).length;

  return (
    <div className="-m-6 flex h-screen flex-col" data-testid="selections-page">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-line bg-bg px-6 py-4">
        <div className="flex-1">
          <h1 className="k-display text-lg font-semibold tracking-tight text-ink">Selections</h1>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-meta text-ink-3">
            {rows.length} sets · {mockupReadyCount} mockup-ready
          </p>
        </div>
        <button
          type="button"
          data-size="sm"
          className="k-btn k-btn--primary"
          disabled
          title="New Selection lands as part of Library handoff (R4 in progress)"
          data-testid="selections-new-cta"
        >
          <Plus className="h-3 w-3" aria-hidden />
          New Selection
        </button>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bg px-6 py-3">
        <form
          onSubmit={applyKeyword}
          className="relative flex max-w-md flex-1 items-center"
        >
          <Search
            className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-ink-3"
            aria-hidden
          />
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search selections by name…"
            className="h-8 w-full rounded-md border border-line bg-paper pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
            data-testid="selections-search-input"
          />
        </form>
        <FilterChip active={stageFilter !== "all"} caret onClick={cycleStage}>
          {stageFilter === "all" ? "Stage" : stageFilter}
        </FilterChip>
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-meta text-ink-3">
            {filtered.length} of {rows.length}
          </span>
          <DensityToggle
            surfaceKey="selections"
            defaultValue={density}
            onChange={setDensity}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {filtered.length === 0 ? (
          <div
            className="rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center"
            data-testid="selections-empty"
          >
            <h3 className="text-base font-semibold text-ink">
              {rows.length === 0
                ? "No selections yet"
                : "No selections match these filters"}
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              {rows.length === 0
                ? "Pick assets in Library and add them to a Selection — that's how a curated set is born."
                : "Clear filters or change the stage filter to see more."}
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 gap-4 lg:grid-cols-2"
            data-testid="selections-grid"
          >
            {filtered.map((r) => (
              <SelectionCard
                key={r.id}
                id={r.id}
                name={r.name}
                count={r.itemCount}
                stage={r.stage}
                sourceLabel={`${r.itemCount} items · ${relativeTime(r.updatedAt)}`}
                thumbs={r.thumbsComposite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
