"use client";

// Pass 90 — Kept Workspace Card.
//
// Tek bir KEPT asset'i temsil eder. Bulk select için checkbox state'i
// dışarıdan props ile gelir (parent KeptWorkspace tutuyor).

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { AssetThumb } from "../AssetThumb";
import type { MJVariantKind } from "@prisma/client";

const VARIANT_LABELS: Record<MJVariantKind, string> = {
  GRID: "Grid",
  UPSCALE: "Upscale",
  VARIATION: "Variation",
  DESCRIBE: "Describe",
};

type KeptCardProps = {
  card: {
    midjourneyAssetId: string;
    assetId: string;
    gridIndex: number;
    variantKind: MJVariantKind;
    mjActionLabel: string | null;
    parentAssetId: string | null;
    parentAssetThumbId: string | null;
    midjourneyJobId: string;
    prompt: string;
    expandedPrompt: string | null;
    batchId: string | null;
    templateId: string | null;
    alreadyPromotedDesignId: string | null;
  };
  selected: boolean;
  onToggle: () => void;
};

export function KeptCard({ card, selected, onToggle }: KeptCardProps) {
  const previewPrompt = (card.expandedPrompt ?? card.prompt).trim();
  const promptShort =
    previewPrompt.length > 100
      ? `${previewPrompt.slice(0, 100)}…`
      : previewPrompt;

  const cardClass =
    "flex flex-col gap-1.5 rounded-md border p-2 transition cursor-pointer " +
    (selected
      ? "border-accent bg-accent-soft/40"
      : "border-border bg-surface hover:border-border-strong");

  return (
    <article
      className={cardClass}
      onClick={onToggle}
      data-testid="mj-kept-card"
      data-mj-asset-id={card.midjourneyAssetId}
      data-selected={selected ? "true" : "false"}
    >
      <div className="relative">
        <AssetThumb assetId={card.assetId} alt={`Kept ${card.gridIndex}`} />
        {/* Bulk select checkbox üst sol köşe */}
        <div
          className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded border-2 border-surface bg-surface shadow-card"
          aria-hidden
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 cursor-pointer accent-current"
            data-testid="mj-kept-checkbox"
          />
        </div>
        {/* Variation parent thumb sağ üst */}
        {card.parentAssetThumbId ? (
          <div
            className="absolute right-1 top-1 h-12 w-12 overflow-hidden rounded border-2 border-surface shadow-card"
            title="Parent (variation kaynağı)"
            data-testid="mj-kept-parent-thumb"
          >
            <AssetThumb assetId={card.parentAssetThumbId} square />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Badge tone="success">✓ Tutuldu</Badge>
        <Badge tone="neutral">
          {VARIANT_LABELS[card.variantKind]}
          {card.mjActionLabel ? ` ${card.mjActionLabel}` : ""}
        </Badge>
        {card.alreadyPromotedDesignId ? (
          <Badge tone="info" title="GeneratedDesign'a promote edilmiş">
            ↗ promoted
          </Badge>
        ) : null}
      </div>

      <p
        className="line-clamp-2 text-xs text-text-muted"
        title={previewPrompt}
      >
        {promptShort || <span className="italic">(boş prompt)</span>}
      </p>

      <div
        className="flex flex-wrap items-center gap-2 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <Link
          href={`/admin/midjourney/${card.midjourneyJobId}`}
          className="text-text-muted underline hover:text-accent"
        >
          job
        </Link>
        {card.batchId ? (
          <Link
            href={`/admin/midjourney/batches/${card.batchId}/review?decision=kept`}
            className="text-text-muted underline hover:text-accent"
            title="Batch Review Studio (kept filter)"
          >
            review
          </Link>
        ) : null}
        {card.batchId ? (
          <Link
            href={`/admin/midjourney/batches/${card.batchId}`}
            className="text-text-muted underline hover:text-accent"
          >
            batch {card.batchId.slice(0, 6)}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
