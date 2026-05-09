"use client";

import { Sparkles } from "lucide-react";
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
 * - Library cards do NOT expose set CRUD; "Add to Selection" lives on the
 *   detail panel footer (single asset path) and floating bulk-bar (>=2
 *   selected). Per-card overlay duplicate removed in R11.14.2 to match
 *   v4 A1Library HTML target.
 * - Click on card opens the right detail panel; thumbnail-only click is
 *   reserved for selection toggling alongside the checkbox.
 */

interface LibraryAssetCardProps {
  card: LibraryCardData;
  density: Density;
  onOpen: (assetId: string) => void;
}

export function LibraryAssetCard({
  card,
  density,
  onOpen,
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

      {/* Hover overlay: lightweight icon-only "open detail" affordance.
       * R11.14.2 — Per v4 A1Library HTML target, primary CTAs live in the
       * right detail panel footer ("Add to Selection" / "Variations").
       * Cards keep a small Sparkles iconbtn (top-right on hover) as a
       * shorthand to open the detail panel — preserves discoverability
       * without duplicating the primary CTA. */}
      <div
        className={cn(
          "pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1",
          card.reviewDecision !== "UNDECIDED" && "right-12",
          "opacity-0 transition-opacity group-hover:opacity-100",
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(card.midjourneyAssetId);
          }}
          className="pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded-md bg-paper/95 text-ink-2 shadow-card hover:text-ink"
          title="Open detail · Variations / Add to Selection"
          aria-label="Open detail panel"
        >
          <Sparkles className="h-3 w-3" aria-hidden />
        </button>
      </div>
    </article>
  );
}
