"use client";

import { Sparkles, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/features/library/components/Checkbox";
import { UserAssetThumb } from "@/components/ui/UserAssetThumb";
import { useLibrarySelection } from "@/features/library/stores/selection-store";
import { VARIANT_KIND_META } from "@/app/(admin)/admin/midjourney/library/variantKindHelper";
import type { LibraryCard as LibraryCardData } from "@/server/services/midjourney/library";
import type { Density } from "@/components/ui/DensityToggle";

/**
 * Kivasy LibraryAssetCard — A1 Library grid card.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a1-a2.jsx
 * → A1Library asset card recipe.
 *
 * Surface boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 * - Library cards expose an "Add to Selection" CTA (handoff to Selections);
 *   no set CRUD here.
 * - Click on card opens the right detail panel; thumbnail-only click is
 *   reserved for selection toggling alongside the checkbox.
 */

interface LibraryAssetCardProps {
  card: LibraryCardData;
  density: Density;
  onOpen: (assetId: string) => void;
  onAddToSelection: (assetId: string) => void;
}

export function LibraryAssetCard({
  card,
  density,
  onOpen,
  onAddToSelection,
}: LibraryAssetCardProps) {
  const variantMeta = VARIANT_KIND_META[card.variantKind];
  const selected = useLibrarySelection((s) => s.selected.has(card.midjourneyAssetId));
  const toggle = useLibrarySelection((s) => s.toggle);
  const previewPrompt = (card.expandedPrompt ?? card.prompt).trim();
  const promptPreview =
    previewPrompt.length > 90
      ? `${previewPrompt.slice(0, 90)}…`
      : previewPrompt;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-md border border-line bg-paper transition-colors hover:border-line-strong",
        density === "dense" ? "p-1.5" : "p-2",
        selected && "k-ring-selected",
      )}
      data-testid="library-asset-card"
      data-asset-id={card.midjourneyAssetId}
    >
      <button
        type="button"
        onClick={() => onOpen(card.midjourneyAssetId)}
        className="block text-left outline-none"
        title={previewPrompt}
      >
        <UserAssetThumb
          assetId={card.assetId}
          alt={`${variantMeta.label} grid ${card.gridIndex}`}
        />
      </button>

      {/* Top-left: selection checkbox (always visible) */}
      <div className="absolute left-3 top-3 z-10">
        <Checkbox
          checked={selected}
          onChange={() => toggle(card.midjourneyAssetId)}
          ariaLabel={`Select ${variantMeta.label} ${card.gridIndex}`}
        />
      </div>

      {/* Top-right: review status badge (KEPT / REJECTED) — meta-only */}
      {card.reviewDecision !== "UNDECIDED" ? (
        <div className="absolute right-3 top-3 z-10">
          {card.reviewDecision === "KEPT" ? (
            <Badge tone="success" title="Kept on review">
              ✓
            </Badge>
          ) : (
            <Badge tone="danger" title="Rejected on review">
              ✕
            </Badge>
          )}
        </div>
      ) : null}

      <div className={cn(density === "dense" ? "p-1.5" : "p-2")}>
        <div className="flex items-center gap-1.5">
          <Badge tone={variantMeta.tone} title={variantMeta.hint}>
            {variantMeta.label}
            {card.mjActionLabel ? ` ${card.mjActionLabel}` : ""}
          </Badge>
          {card.batchId ? (
            <span className="font-mono text-xs text-text-subtle">
              batch_{card.batchId.slice(0, 6)}
            </span>
          ) : null}
        </div>
        {density === "comfortable" ? (
          <p
            className="mt-1 line-clamp-2 text-xs text-text-muted"
            title={previewPrompt}
          >
            {promptPreview || (
              <span className="italic">(boş prompt)</span>
            )}
          </p>
        ) : null}
      </div>

      {/* Hover overlay: single primary action — handoff to Selections.
       * Boundary invariant: no set CRUD here, just the CTA. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-2 bottom-2 flex items-center gap-1",
          "opacity-0 transition-opacity group-hover:opacity-100",
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            // R4 — Hand-off modal (LibraryClient hosts AddToSelectionModal
            // when `addToSelectionAsset !== null`). Boundary preserved:
            // Library never owns set CRUD; the modal picks an existing
            // draft set and posts to /api/selection/sets/[setId]/items
            // /from-library.
            onAddToSelection(card.midjourneyAssetId);
          }}
          data-testid="library-card-add-to-selection"
          className="pointer-events-auto inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md bg-paper/95 px-2 text-xs font-medium text-ink shadow-card hover:bg-paper"
        >
          <Plus className="h-3 w-3" aria-hidden />
          Add to Selection
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(card.midjourneyAssetId);
          }}
          className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md bg-paper/95 text-ink-2 shadow-card hover:text-ink"
          title="Variations / similar"
          aria-label="Variations / similar"
        >
          <Sparkles className="h-3 w-3" aria-hidden />
        </button>
      </div>
    </article>
  );
}
