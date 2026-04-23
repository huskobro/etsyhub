"use client";

import { useQuery } from "@tanstack/react-query";
import type { WindowDays } from "@/features/trend-stories/constants";

export type TrendClusterHero = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  sourceUrl: string;
  reviewCount: number;
};

export type TrendClusterProductType = {
  id: string;
  key: string;
  displayName: string;
} | null;

export type TrendClusterSummary = {
  id: string;
  label: string;
  memberCount: number;
  storeCount: number;
  totalReviewCount: number;
  latestMemberSeenAt: string | null;
  seasonalTag: string | null;
  productType: TrendClusterProductType;
  hero: TrendClusterHero | null;
  clusterScore: number;
};

export type ClustersResponse = {
  clusters: TrendClusterSummary[];
};

export const clustersQueryKey = (windowDays: WindowDays) =>
  ["trend-stories", "clusters", windowDays] as const;

/**
 * `GET /api/trend-stories/clusters?window={N}` — aktif trend kümeleri.
 */
export function useClusters(windowDays: WindowDays) {
  return useQuery<ClustersResponse>({
    queryKey: clustersQueryKey(windowDays),
    queryFn: async () => {
      const res = await fetch(
        `/api/trend-stories/clusters?window=${windowDays}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Trend kümeleri alınamadı");
      }
      return (await res.json()) as ClustersResponse;
    },
  });
}
