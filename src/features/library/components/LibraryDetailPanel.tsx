"use client";

import { useState } from "react";
import { Plus, Sparkles, Trash2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DetailPanel } from "@/components/ui/DetailPanel";
import { UserAssetThumb } from "@/components/ui/UserAssetThumb";
import { useLibrarySelection } from "@/features/library/stores/selection-store";
import { VARIANT_KIND_META } from "@/app/(admin)/admin/midjourney/library/variantKindHelper";
import { CreateVariationsModal } from "@/features/batches/components/CreateVariationsModal";
import { AddToSelectionModal } from "@/features/selections/components/AddToSelectionModal";
import type { LibraryCard } from "@/server/services/midjourney/library";

/**
 * LibraryDetailPanel — right-side asset detail.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a1-a2.jsx
 * → A1Library detail panel.
 *
 * Surface boundary: shows lineage hint (Source batch · Reference) and
 * exposes a single primary CTA "Add to Selection" (orange, handoff).
 * Variation re-roll and edit operations are deferred to rollouts 3-4.
 */

interface LibraryDetailPanelProps {
  card: LibraryCard | null;
  onClose: () => void;
}

export function LibraryDetailPanel({ card, onClose }: LibraryDetailPanelProps) {
  const isSelected = useLibrarySelection((s) =>
    card ? s.selected.has(card.midjourneyAssetId) : false,
  );
  const toggle = useLibrarySelection((s) => s.toggle);
  const [variationsOpen, setVariationsOpen] = useState(false);
  const [addToSelectionOpen, setAddToSelectionOpen] = useState(false);

  if (!card) return null;
  const variantMeta = VARIANT_KIND_META[card.variantKind];
  const promptText = (card.expandedPrompt ?? card.prompt).trim();

  return (
    <DetailPanel
      open={true}
      onClose={onClose}
      header={
        <>
          <div className="font-mono text-xs uppercase tracking-meta text-ink-3">
            Asset · {card.midjourneyAssetId.slice(0, 8)}
          </div>
          <h3 className="mt-0.5 truncate text-base font-semibold text-ink">
            {variantMeta.label}
            {card.mjActionLabel ? ` ${card.mjActionLabel}` : ""}
          </h3>
        </>
      }
      footer={
        <>
          <button
            type="button"
            onClick={() => setAddToSelectionOpen(true)}
            data-size="sm"
            className="k-btn k-btn--primary"
            data-testid="library-detail-add-to-selection"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Add to Selection
          </button>
          <button
            type="button"
            onClick={() => toggle(card.midjourneyAssetId)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
            title="Bulk-select toggle (acts on the floating bulk-bar)"
          >
            {isSelected ? "✓ Bulk-selected" : "Bulk select"}
          </button>
          <button
            type="button"
            onClick={() => setVariationsOpen(true)}
            disabled={card.variantKind !== "GRID" && card.variantKind !== "UPSCALE"}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-50"
            title={
              card.variantKind === "GRID" || card.variantKind === "UPSCALE"
                ? "Open Create Variations modal"
                : "Only GRID / UPSCALE assets can spawn variations"
            }
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            Variations
          </button>
          <button
            type="button"
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-ink-2 hover:text-ink"
            disabled
            title="Remove lands in rollout-3"
          >
            <Trash2 className="h-3 w-3" aria-hidden />
            Remove
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <UserAssetThumb
          assetId={card.assetId}
          alt={`${variantMeta.label} ${card.gridIndex}`}
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={variantMeta.tone}>{variantMeta.label}</Badge>
          {card.reviewDecision === "KEPT" ? (
            <Badge tone="success">Kept</Badge>
          ) : card.reviewDecision === "REJECTED" ? (
            <Badge tone="danger">Rejected</Badge>
          ) : (
            <Badge tone="neutral">Pending review</Badge>
          )}
        </div>

        <dl className="grid grid-cols-[110px_1fr] gap-y-3 text-sm">
          {card.batchId ? (
            <>
              <dt className="font-mono text-xs uppercase tracking-meta text-ink-3">
                Source batch
              </dt>
              <dd>
                <a
                  href={`/batches/${card.batchId}`}
                  className="inline-flex items-center gap-1 text-info underline-offset-2 hover:underline"
                >
                  batch_{card.batchId.slice(0, 8)}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </dd>
            </>
          ) : null}

          {card.templateId ? (
            <>
              <dt className="font-mono text-xs uppercase tracking-meta text-ink-3">
                Template
              </dt>
              <dd>
                <a
                  href={`/templates?templateId=${card.templateId}`}
                  className="font-mono text-xs text-info underline-offset-2 hover:underline"
                >
                  tmpl_{card.templateId.slice(0, 8)}
                </a>
              </dd>
            </>
          ) : null}

          {card.parentAssetId ? (
            <>
              <dt className="font-mono text-xs uppercase tracking-meta text-ink-3">
                Parent
              </dt>
              <dd>
                <a
                  href={`/library?parentAssetId=${card.parentAssetId}`}
                  className="font-mono text-xs text-info underline-offset-2 hover:underline"
                >
                  ↑ parent_{card.parentAssetId.slice(0, 8)}
                </a>
              </dd>
            </>
          ) : null}

          <dt className="font-mono text-xs uppercase tracking-meta text-ink-3">
            Imported
          </dt>
          <dd className="font-mono text-xs tabular-nums text-ink-2">
            {new Date(card.importedAt).toLocaleString("tr-TR")}
          </dd>

          <dt className="font-mono text-xs uppercase tracking-meta text-ink-3">
            Job kind
          </dt>
          <dd className="font-mono text-xs text-ink-2">{card.jobKind}</dd>
        </dl>

        {promptText ? (
          <div>
            <div className="mb-1.5 font-mono text-xs uppercase tracking-meta text-ink-3">
              Prompt
            </div>
            <p
              className="whitespace-pre-wrap rounded-md border border-line bg-k-bg-2 px-3 py-2 text-xs leading-relaxed text-ink-2"
              title={promptText}
            >
              {promptText}
            </p>
          </div>
        ) : null}
      </div>
      {variationsOpen ? (
        <CreateVariationsModal
          midjourneyAssetId={card.midjourneyAssetId}
          assetId={card.assetId}
          sourceTitle={`${variantMeta.label} ${card.gridIndex}`}
          sourceMeta={`${card.jobKind} · imported ${new Date(card.importedAt).toLocaleDateString("tr-TR")}`}
          resolvedPrompt={promptText}
          templateLabel={card.templateId ? "Linked template" : null}
          templateId={card.templateId}
          onClose={() => setVariationsOpen(false)}
        />
      ) : null}
      {addToSelectionOpen ? (
        <AddToSelectionModal
          midjourneyAssetIds={[card.midjourneyAssetId]}
          onClose={() => setAddToSelectionOpen(false)}
        />
      ) : null}
    </DetailPanel>
  );
}
