"use client";

import type { TrendClusterSummary } from "../queries/use-clusters";
import { SeasonalBadge } from "./seasonal-badge";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type Props = {
  cluster: TrendClusterSummary;
  onOpen: (clusterId: string) => void;
};

/**
 * Cluster rail içinde yer alan tek küme kartı. Hero thumbnail varsa onu,
 * yoksa gray placeholder gösterir. Tıklayınca drawer açılır.
 *
 * T-37 spec — docs/design/implementation-notes/trend-stories-screens.md
 * - Manuel `<button>` Card primitive (`as="button" interactive`) ile değiştirildi.
 * - aria-label="Trend kümesi: {label}" Card primitive `...rest` üzerinden forward edilir.
 * - Mağaza/Ürün count → Badge tone="neutral".
 * - ProductType pill → Badge tone="accent".
 * - SeasonalBadge dokunulmadı — Badge primitive emoji slot'u yok, yerel pill korunur (carry-forward).
 * - Thumb (img veya placeholder) yerel; Thumb primitive scope dışı.
 */
export function TrendClusterCard({ cluster, onOpen }: Props) {
  const productTypeLabel = cluster.productType?.displayName ?? null;

  return (
    <Card
      as="button"
      interactive
      onClick={() => onOpen(cluster.id)}
      className="flex w-56 shrink-0 flex-col gap-2 p-3 text-left"
      aria-label={`Trend kümesi: ${cluster.label}`}
    >
      {cluster.hero?.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cluster.hero.thumbnailUrl}
          alt={cluster.hero.title}
          loading="lazy"
          className="aspect-square w-full rounded-md bg-surface-2 object-cover"
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-md bg-surface-2 text-xs text-text-muted">
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
        <Badge tone="neutral">{cluster.storeCount} mağaza</Badge>
        <Badge tone="neutral">{cluster.memberCount} ürün</Badge>
      </div>

      {cluster.seasonalTag || productTypeLabel ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <SeasonalBadge seasonalTag={cluster.seasonalTag} />
          {productTypeLabel ? (
            <Badge tone="accent">{productTypeLabel}</Badge>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
