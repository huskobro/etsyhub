"use client";

import { useClusters } from "../queries/use-clusters";
import type { WindowDays } from "@/features/trend-stories/constants";
import { TrendClusterCard } from "./trend-cluster-card";
import { StateMessage } from "@/components/ui/StateMessage";

type Props = {
  windowDays: WindowDays;
  onOpenCluster: (clusterId: string) => void;
};

/**
 * Seçili pencere için yatay-scroll cluster rail'i.
 *
 * T-37 spec — docs/design/implementation-notes/trend-stories-screens.md
 * - Loading / error / empty → StateMessage primitive (manuel 4'lü skeleton kaldırıldı).
 * - Header (`<h2>Trend Kümeleri</h2>` + "{N} küme" mono muted) korunur.
 * - Grid: `flex gap-3 overflow-x-auto pb-2` (yatay scroll) korunur.
 */
export function TrendClusterRail({ windowDays, onOpenCluster }: Props) {
  const query = useClusters(windowDays);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-text">Trend Kümeleri</h2>
        {query.data ? (
          <p className="font-mono text-xs tracking-meta text-text-muted">
            {query.data.clusters.length} küme
          </p>
        ) : null}
      </div>

      {query.isLoading ? (
        <StateMessage tone="neutral" title="Kümeler yükleniyor…" />
      ) : query.isError ? (
        <StateMessage
          tone="error"
          title="Kümeler yüklenemedi"
          body={(query.error as Error).message}
        />
      ) : !query.data || query.data.clusters.length === 0 ? (
        <StateMessage
          tone="neutral"
          title="Bu pencerede trend kümesi henüz yok"
          body="Pencere tab'larından farklı bir aralık deneyebilirsin."
        />
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
