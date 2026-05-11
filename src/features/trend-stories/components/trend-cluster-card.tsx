"use client";

import type { TrendClusterSummary } from "../queries/use-clusters";
import { SeasonalBadge } from "./seasonal-badge";

type Props = {
  cluster: TrendClusterSummary;
  onOpen: (clusterId: string) => void;
};

/**
 * TrendClusterCard — Kivasy v5 B1.Stories sub-view recipe (R11.14.12).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b1.jsx
 *   → SubStories cluster rail card paritesi.
 *
 * R11.14.12 — Eski legacy `Card as="button"` + `Badge` kompozisyonu yerine
 * v5 SubStories k-card pattern'a geçirildi (Library + References Pool +
 * Competitor + Bookmark + Collection paritesiyle birebir):
 *   - .k-card overflow-hidden + data-interactive (button)
 *   - hero thumbnail wrapper p-2 pb-0 + k-thumb data-aspect="square"
 *   - meta block: label 13px font-medium + meta mono caption (store/item
 *     counts) + bottom-row k-badge tone (seasonal + productType)
 *
 * EN normalize: "mağaza" → "shops", "ürün" → "items", "Görsel yok" →
 * "No image", aria-label "Trend kümesi:" → "Trend cluster:".
 */
export function TrendClusterCard({ cluster, onOpen }: Props) {
  const productTypeLabel = cluster.productType?.displayName ?? null;

  return (
    <button
      type="button"
      onClick={() => onOpen(cluster.id)}
      aria-label={`Trend cluster: ${cluster.label}`}
      data-testid="trend-cluster-card"
      data-interactive="true"
      className="k-card overflow-hidden flex w-56 shrink-0 flex-col text-left"
    >
      <div className="p-2 pb-0">
        <div className="k-thumb" data-aspect="square">
          {cluster.hero?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cluster.hero.thumbnailUrl}
              alt={cluster.hero.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-ink-3">
              No image
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 p-3">
        <h3
          className="line-clamp-2 text-[13px] font-medium leading-tight text-ink"
          title={cluster.label}
        >
          {cluster.label}
        </h3>

        <div className="font-mono text-[10.5px] tracking-wider text-ink-3">
          {cluster.storeCount} shops · {cluster.memberCount} items
        </div>

        {cluster.seasonalTag || productTypeLabel ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <SeasonalBadge seasonalTag={cluster.seasonalTag} />
            {productTypeLabel ? (
              <span className="k-badge" data-tone="accent">
                {productTypeLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </button>
  );
}
