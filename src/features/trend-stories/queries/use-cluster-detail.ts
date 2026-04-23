"use client";

import { useQuery } from "@tanstack/react-query";

export type ClusterDetailHero = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  sourceUrl: string;
  reviewCount: number;
} | null;

export type ClusterDetailInfo = {
  id: string;
  label: string;
  memberCount: number;
  storeCount: number;
  totalReviewCount: number;
  seasonalTag: string | null;
  productType: {
    id: string;
    key: string;
    displayName: string;
  } | null;
  hero: ClusterDetailHero;
  status: string;
  clusterScore: number;
};

export type ClusterMember = {
  listingId: string;
  title: string;
  thumbnailUrl: string | null;
  sourceUrl: string;
  reviewCount: number;
  firstSeenAt: string;
  competitorStoreName: string;
  deleted: boolean;
};

export type ClusterDetailResponse = {
  cluster: ClusterDetailInfo;
  members: ClusterMember[];
  nextCursor: string | null;
};

export const clusterDetailQueryKey = (
  clusterId: string,
  membersCursor: string | null,
) =>
  [
    "trend-stories",
    "clusters",
    "detail",
    clusterId,
    membersCursor ?? "first",
  ] as const;

/**
 * `GET /api/trend-stories/clusters/{id}?membersCursor={cursor}` — küme detay +
 * üye sayfası. Üyeler 30'lu sayfalanır.
 */
export function useClusterDetail(
  clusterId: string | null,
  membersCursor: string | null = null,
) {
  return useQuery<ClusterDetailResponse>({
    queryKey: clusterDetailQueryKey(clusterId ?? "", membersCursor),
    enabled: !!clusterId,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (membersCursor) params.set("membersCursor", membersCursor);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(
        `/api/trend-stories/clusters/${clusterId}${suffix}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Küme detayı alınamadı");
      }
      return (await res.json()) as ClusterDetailResponse;
    },
  });
}
