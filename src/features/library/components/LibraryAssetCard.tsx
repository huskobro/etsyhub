"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { UserAssetThumb } from "@/components/ui/UserAssetThumb";
import { useLibrarySelection } from "@/features/library/stores/selection-store";
import { VARIANT_KIND_META } from "@/app/(admin)/admin/midjourney/library/variantKindHelper";
import type { LibraryCard as LibraryCardData } from "@/server/services/midjourney/library";
import type { Density } from "@/components/ui/DensityToggle";

/**
 * Kivasy LibraryAssetCard — A1 Library grid card (R11.14.4 v4 recipe parity).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a1-a2.jsx
 *   → A1Library asset card.
 *
 * v4 A1 DOM structure:
 *   <div class="k-card overflow-hidden ${selected:k-ring-selected}" data-interactive>
 *     <div class="relative">
 *       <div class="p-2 pb-0"><div class="k-thumb" data-kind={...}/></div>
 *       <div class="absolute top-3 left-3"><Checkbox/></div>
 *       <div class="absolute top-3 right-3"><k-iconbtn bookmark/></div>
 *     </div>
 *     <div class="p-3.5 (or p-2.5 dense)">
 *       <div class="text-[13px] font-medium leading-tight truncate">{title}</div>
 *       <div class="mt-1 k-mono text-[10.5px] text-ink-3 tracking-wider">
 *         {ratio} · batch_{batch} · {added} ago
 *       </div>
 *     </div>
 *   </div>
 *
 * Boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Cards do NOT host set CRUD. "Add to Selection" lives in detail panel
 *   footer (single asset) and floating bulk-bar (>=2 selected). Per-card
 *   overlay was removed in R11.14.2; here we keep a small Sparkles
 *   iconbtn (top-right hover) as shorthand to open the detail panel.
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
  const selected = useLibrarySelection((s) =>
    s.selected.has(card.midjourneyAssetId),
  );
  const toggle = useLibrarySelection((s) => s.toggle);
  // R11.14.9 — Bulk mode click conflict fix.
  // User feedback: "Bulk select moduna girince resmin üzerine tıklayınca
  // drawer değil select olması lazım."
  // selectedCount >= 1 ise card click → toggle (bulk select modu).
  // selectedCount === 0 ise card click → onOpen (detail drawer).
  const bulkModeActive = useLibrarySelection((s) => s.selected.size > 0);
  const previewPrompt = (card.expandedPrompt ?? card.prompt).trim();
  const promptPreview =
    previewPrompt.length > 60 ? `${previewPrompt.slice(0, 60)}…` : previewPrompt;
  const titleText = promptPreview || `${variantMeta.label} ${card.gridIndex}`;
  const importedRel = formatRelative(
    typeof card.importedAt === "string"
      ? card.importedAt
      : new Date(card.importedAt).toISOString(),
  );
  const reviewBadge =
    card.reviewDecision === "KEPT"
      ? { tone: "success", label: "Kept" }
      : card.reviewDecision === "REJECTED"
        ? { tone: "danger", label: "Rejected" }
        : null;

  return (
    <div
      className={cn("k-card overflow-hidden group", selected && "k-ring-selected")}
      data-interactive="true"
      data-testid="library-asset-card"
      data-asset-id={card.midjourneyAssetId}
      data-bulk-mode={bulkModeActive ? "true" : "false"}
      onClick={() => {
        // R11.14.9 — Bulk mode'da click → toggle, normal mode'da → drawer
        if (bulkModeActive) {
          toggle(card.midjourneyAssetId);
        } else {
          onOpen(card.midjourneyAssetId);
        }
      }}
    >
      <div className="relative">
        <div className="p-2 pb-0">
          <div className="k-thumb" data-aspect="square">
            <UserAssetThumb
              assetId={card.assetId}
              alt={`${variantMeta.label} grid ${card.gridIndex}`}
              bare
            />
          </div>
        </div>

        {/* Top-left: selection checkbox (always visible, k-checkbox recipe) */}
        <div className="absolute left-3 top-3 z-10">
          <button
            type="button"
            aria-label={`Select ${variantMeta.label} ${card.gridIndex}`}
            aria-pressed={selected}
            onClick={(e) => {
              e.stopPropagation();
              toggle(card.midjourneyAssetId);
            }}
            className="k-checkbox"
            data-checked={selected || undefined}
          >
            {selected ? (
              <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M5 12l5 5L20 7"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </button>
        </div>

        {/* Top-right: review badge (KEPT/REJECTED) — meta only.
         *   v4 A1 has a "bookmark" iconbtn here; we don't have a favorite
         *   model yet, so we surface review-decision badge instead (data-
         *   driven, no hollow UI). */}
        {reviewBadge ? (
          <div className="absolute right-3 top-3 z-10">
            <span className="k-badge" data-tone={reviewBadge.tone}>
              {reviewBadge.label}
            </span>
          </div>
        ) : null}

        {/* Top-right hover: Sparkles iconbtn — opens detail panel.
         *   Hidden when reviewBadge is present (avoid stacking). */}
        {!reviewBadge ? (
          <div className="absolute right-3 top-3 z-10 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              className="k-iconbtn"
              data-size="sm"
              title="Open detail · Variations / Add to Selection"
              aria-label="Open detail panel"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(card.midjourneyAssetId);
              }}
            >
              <Sparkles className="h-3 w-3" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      {/* Meta block — title 13px font-medium + variant k-badge tone-mapped
       *   + mono caption 10.5px.
       * R11.14.14 — Variant kind (Grid/Variation/Upscale/Describe) artık
       * detail drawer ile aynı tone-mapped k-badge olarak render ediliyor
       * (önceki: düz mono text, kullanıcı feedback'ine göre detail drawer
       * paritesi sağlanmamıştı). VARIANT_KIND_META.tone ile renkler
       * Library kartı + drawer + filter chip'lerinde tek kaynaktan. */}
      <div className={density === "dense" ? "p-2.5" : "p-3.5"}>
        <div
          className="truncate text-[13px] font-medium leading-tight text-ink"
          title={previewPrompt}
        >
          {titleText}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="k-badge" data-tone={variantMeta.tone}>
            {variantMeta.label}
            {card.mjActionLabel ? ` ${card.mjActionLabel}` : ""}
          </span>
          <span className="truncate font-mono text-[10.5px] tracking-wider text-ink-3">
            {card.batchId ? `batch_${card.batchId.slice(0, 6)} · ` : ""}
            {importedRel}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
}
