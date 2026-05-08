"use client";

import { useEffect, useState } from "react";
import { LibraryToolbar } from "./LibraryToolbar";
import { LibraryGrid } from "./LibraryGrid";
import { LibraryDetailPanel } from "./LibraryDetailPanel";
import { LibraryFloatingBulkBar } from "./LibraryFloatingBulkBar";
import { AddToSelectionModal } from "@/features/selections/components/AddToSelectionModal";
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

  // R4 — Per-card "Add to Selection" hand-off modal target. Tek bir asset
  // için açılır; LibraryFloatingBulkBar bulk handoff'u kendi içinde yönetir.
  const [addToSelectionAsset, setAddToSelectionAsset] = useState<string | null>(
    null,
  );

  return (
    <div className="flex h-full flex-col">
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
              onAddToSelection={setAddToSelectionAsset}
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
      {addToSelectionAsset !== null ? (
        <AddToSelectionModal
          midjourneyAssetIds={[addToSelectionAsset]}
          onClose={() => setAddToSelectionAsset(null)}
        />
      ) : null}
    </div>
  );
}
