"use client";

// Pass 91 — Selection Workspace V1: per-item MJ origin badges.
//
// PreviewCard'da aktif item için MJ context rozetleri:
//   - Variant kind (Grid/Upscale/Variation)
//   - Batch chip (tıklanırsa Review Studio'ya gider)
//   - Job link (job detail)
//
// mjOrigin null ise hiçbir şey render etmez — non-MJ item'lar için sessiz.

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { ItemMjOriginView } from "@/features/selection/queries";

const VARIANT_LABEL: Record<string, string> = {
  GRID: "Grid",
  UPSCALE: "Upscale",
  VARIATION: "Variation",
  DESCRIBE: "Describe",
};

const VARIANT_TONE: Record<
  string,
  "neutral" | "accent" | "success" | "warning"
> = {
  GRID: "neutral",
  UPSCALE: "accent",
  VARIATION: "success",
  DESCRIBE: "warning",
};

type Props = {
  origin: ItemMjOriginView | null;
};

export function MjItemOriginBadges({ origin }: Props) {
  if (!origin) return null;
  const variantLabel = VARIANT_LABEL[origin.variantKind] ?? origin.variantKind;
  const variantTone = VARIANT_TONE[origin.variantKind] ?? "neutral";
  return (
    <span
      className="flex flex-wrap items-center gap-1.5"
      data-testid="mj-item-origin-badges"
    >
      <Badge tone={variantTone}>
        {variantLabel}
        {origin.mjActionLabel ? ` ${origin.mjActionLabel}` : ""}
      </Badge>
      {origin.batchId ? (
        <Link
          href={`/admin/midjourney/batches/${origin.batchId}/review?decision=kept`}
          className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text-muted hover:text-accent"
          title={`Batch ${origin.batchId} — Review Studio`}
          data-testid="mj-item-origin-batch"
        >
          batch {origin.batchId.slice(0, 6)}
        </Link>
      ) : null}
      <Link
        href={`/admin/midjourney/${origin.midjourneyJobId}`}
        className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text-muted hover:text-accent"
        title="MJ Job detail"
        data-testid="mj-item-origin-job"
      >
        job
      </Link>
    </span>
  );
}
