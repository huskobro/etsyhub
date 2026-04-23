"use client";

import type { TrendClusterSummary } from "../queries/use-clusters";
import { SeasonalBadge } from "./seasonal-badge";

type Props = {
  cluster: TrendClusterSummary;
  onOpen: (clusterId: string) => void;
};

/**
 * Cluster rail içinde yer alan tek küme kartı. Hero thumbnail varsa onu,
 * yoksa gray placeholder gösterir. Tıklayınca drawer açılır.
 */
export function TrendClusterCard({ cluster, onOpen }: Props) {
  const productTypeLabel = cluster.productType?.displayName ?? null;

  return (
    <button
      type="button"
      onClick={() => onOpen(cluster.id)}
      className="flex w-56 shrink-0 flex-col gap-2 rounded-md border border-border bg-surface p-3 text-left shadow-card hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`Trend kümesi: ${cluster.label}`}
    >
      {cluster.hero?.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cluster.hero.thumbnailUrl}
          alt={cluster.hero.title}
          loading="lazy"
          className="aspect-square w-full rounded-md bg-surface-muted object-cover"
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-md bg-surface-muted text-xs text-text-muted">
          Görsel yok
        </div>
      )}

      <h3
        className="line-clamp-2 text-sm font-medium text-text"
        title={cluster.label}
      >
        {cluster.label}
      </h3>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-text-muted">
          {cluster.storeCount} mağaza
        </span>
        <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-text-muted">
          {cluster.memberCount} ürün
        </span>
      </div>

      {cluster.seasonalTag || productTypeLabel ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <SeasonalBadge seasonalTag={cluster.seasonalTag} />
          {productTypeLabel ? (
            <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs text-accent">
              {productTypeLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}
