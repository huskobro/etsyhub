"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { LibraryCard } from "@/server/services/midjourney/library";
import type { Density } from "@/components/ui/DensityToggle";
import { LibraryAssetCard } from "./LibraryAssetCard";

/**
 * LibraryGrid — density-aware asset grid + opener for the right detail panel.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a1-a2.jsx
 * → A1Library grid.
 *
 * Comfortable: 4 cols (md), Dense: 6 cols (md). Mobile collapses to 2 cols.
 *
 * Virtualization-ready: the grid is a flat list of cards rendered in DOM.
 * When the count crosses the comfort threshold (~200 items), swap the inner
 * map for `@tanstack/react-virtual` while keeping the same prop surface.
 */

interface LibraryGridProps {
  cards: LibraryCard[];
  density: Density;
  onOpen: (assetId: string) => void;
}

export function LibraryGrid({ cards, density, onOpen }: LibraryGridProps) {
  return (
    <div
      className={cn(
        "grid gap-3 px-6 py-5",
        density === "dense"
          ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-6"
          : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5",
      )}
      data-testid="library-grid"
      data-density={density}
    >
      {cards.map((card) => (
        <LibraryAssetCard
          key={card.midjourneyAssetId}
          card={card}
          density={density}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

/** Density state hook — surface-scope. */
export function useDensityState(initial: Density = "comfortable") {
  const [density, setDensity] = useState<Density>(initial);
  return { density, setDensity };
}
