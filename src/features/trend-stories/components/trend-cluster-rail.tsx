"use client";

import { useClusters } from "../queries/use-clusters";
import type { WindowDays } from "@/features/trend-stories/constants";
import { TrendClusterCard } from "./trend-cluster-card";

type Props = {
  windowDays: WindowDays;
  onOpenCluster: (clusterId: string) => void;
};

/**
 * Seçili pencere için yatay-scroll cluster rail'i.
 * States: loading skeleton, error, empty ("Bu pencerede trend kümesi henüz yok."),
 * ve dolu grid.
 */
export function TrendClusterRail({ windowDays, onOpenCluster }: Props) {
  const query = useClusters(windowDays);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-text">Trend Kümeleri</h2>
        {query.data ? (
          <p className="text-xs text-text-muted">
            {query.data.clusters.length} küme
          </p>
        ) : null}
      </div>

      {query.isLoading ? (
        <div
          className="flex gap-3 overflow-x-auto pb-2"
          aria-label="Trend kümeleri yükleniyor"
          role="status"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-64 w-56 shrink-0 animate-pulse rounded-md border border-border bg-surface-muted"
              aria-hidden
            />
          ))}
        </div>
      ) : query.isError ? (
        <p className="text-sm text-danger" role="alert">
          {(query.error as Error).message}
        </p>
      ) : !query.data || query.data.clusters.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6 text-center text-sm text-text-muted">
          Bu pencerede trend kümesi henüz yok.
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {query.data.clusters.map((cluster) => (
            <TrendClusterCard
              key={cluster.id}
              cluster={cluster}
              onOpen={onOpenCluster}
            />
          ))}
        </div>
      )}
    </section>
  );
}
