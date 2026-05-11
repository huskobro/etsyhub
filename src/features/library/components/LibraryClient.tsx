"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { LibraryToolbar } from "./LibraryToolbar";
import { LibraryGrid } from "./LibraryGrid";
import { LibraryDetailPanel } from "./LibraryDetailPanel";
import { LibraryFloatingBulkBar } from "./LibraryFloatingBulkBar";
import {
  type Density,
  readStoredDensity,
} from "@/components/ui/DensityToggle";
import type { LibraryCard } from "@/server/services/midjourney/library";

/**
 * LibraryClient — interactive shell for the /library server component.
 *
 * Composes Toolbar (URL state, density), Grid (density-aware), DetailPanel
 * (selected asset slide-in), FloatingBulkBar (>=2 selected). Selection
 * state lives in Zustand (`useLibrarySelection`); density lives in
 * localStorage via `DensityToggle` and is mirrored here for Grid layout.
 */

interface LibraryClientProps {
  cards: LibraryCard[];
  totalLabel: string;
  /** Empty state copy — depends on whether any filter is active. */
  emptyState: { title: string; hint: string } | null;
  /** "Load more" href, computed server-side from URL state + nextCursor. */
  loadMoreHref: string | null;
}

export function LibraryClient({
  cards,
  totalLabel,
  emptyState,
  loadMoreHref,
}: LibraryClientProps) {
  // Hydrate density from localStorage on first mount; render comfortable
  // before that to avoid layout flicker on first paint.
  const [density, setDensity] = useState<Density>("comfortable");
  useEffect(() => {
    setDensity(readStoredDensity("library"));
  }, []);

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const detailCard = selectedAssetId
    ? cards.find((c) => c.midjourneyAssetId === selectedAssetId) ?? null
    : null;

  // (router declared below as `router` after dismissIntent block; refresh
  // wiring set in a useEffect right after that for clarity.)

  // R11.14.2 — Per-card "Add to Selection" overlay was removed to match
  // v4 A1Library HTML target (CTAs live in detail panel footer, not on
  // cards). Single-asset hand-off lives in LibraryDetailPanel; bulk path
  // lives in LibraryFloatingBulkBar.

  // R11.7 fix — `?intent=start-batch` query param: operatör Batches Start
  // CTA üzerinden geldi, A6 modal reference asset gerektiriyor. Banner
  // ile yönlendirme: "asset seç → kart üzerinden Create Variations".
  // R11.14.9 — `?intent=add-to-selection&setId=X` query param: operatör
  // Selection detail "Add from Library" üzerinden geldi. Banner ile
  // yönlendirme: "asset(lar) seç → bulk-bar Add to Selection".
  const router = useRouter();
  const params = useSearchParams();
  const startBatchIntent = params.get("intent") === "start-batch";
  const addToSelectionIntent = params.get("intent") === "add-to-selection";
  const intentSetId = params.get("setId");

  function dismissIntent() {
    const sp = new URLSearchParams(params.toString());
    sp.delete("intent");
    sp.delete("setId");
    const qs = sp.toString();
    router.replace(qs ? `/library?${qs}` : "/library", { scroll: false });
  }

  // IA-29 (CLAUDE.md Madde W) — live updates. Library is server-rendered;
  // poll router.refresh() so newly arrived MJ assets / scan items show up
  // without a manual page reload. 8s cadence; pauses when tab hidden.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer || (typeof document !== "undefined" && document.hidden)) return;
      timer = setInterval(() => router.refresh(), 8000);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, [router]);

  return (
    <div className="flex h-full flex-col">
      {startBatchIntent ? (
        <div
          className="flex items-start gap-3 border-b border-line bg-k-orange-soft/40 px-6 py-3"
          data-testid="library-start-batch-hint"
          role="status"
        >
          <Sparkles
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-k-orange-ink"
            aria-hidden
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-ink">
              Pick an asset, then use{" "}
              <span className="text-k-orange-ink">Create Variations</span>
            </div>
            <p className="mt-0.5 text-xs text-ink-2">
              Variation batches start from a Library asset. Click an asset
              card → detail panel opens → use the Create Variations CTA.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissIntent}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-3 hover:bg-ink/5 hover:text-ink"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {addToSelectionIntent ? (
        <div
          className="flex items-start gap-3 border-b border-line bg-k-orange-soft/40 px-6 py-3"
          data-testid="library-add-to-selection-hint"
          role="status"
        >
          <Sparkles
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-k-orange-ink"
            aria-hidden
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-ink">
              Pick assets to add to your{" "}
              <span className="text-k-orange-ink">
                {intentSetId
                  ? `Selection set ${intentSetId.slice(0, 8)}`
                  : "Selection set"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-2">
              Multi-select assets below, then use the floating bulk-bar&apos;s{" "}
              <span className="font-medium">Add to Selection</span>{" "}
              action. The destination set is pre-set.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissIntent}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-3 hover:bg-ink/5 hover:text-ink"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      <LibraryToolbar
        totalLabel={totalLabel}
        density={density}
        onDensityChange={setDensity}
      />

      <div className="flex-1 overflow-y-auto">
        {emptyState ? (
          <div
            className="mx-6 my-10 rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center"
            data-testid="library-empty"
          >
            <h3 className="text-base font-semibold text-ink">
              {emptyState.title}
            </h3>
            <p className="mt-1 text-sm text-text-muted">{emptyState.hint}</p>
          </div>
        ) : (
          <>
            <LibraryGrid
              cards={cards}
              density={density}
              onOpen={setSelectedAssetId}
            />
            {loadMoreHref ? (
              <div className="flex justify-center pb-6">
                <a
                  href={loadMoreHref}
                  className="inline-flex items-center gap-1 rounded-md border border-line bg-paper px-4 py-2 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
                  data-testid="library-load-more"
                >
                  Load more →
                </a>
              </div>
            ) : null}
          </>
        )}
      </div>

      <LibraryDetailPanel
        card={detailCard}
        onClose={() => setSelectedAssetId(null)}
      />
      <LibraryFloatingBulkBar />
    </div>
  );
}
