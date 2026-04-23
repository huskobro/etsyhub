"use client";

import { useQuery } from "@tanstack/react-query";
import type { WindowDays } from "@/features/trend-stories/constants";

export type FeedMembershipHint = {
  clusterId: string;
  label: string;
  seasonalTag: string | null;
};

export type FeedListing = {
  listingId: string;
  title: string;
  thumbnailUrl: string | null;
  reviewCount: number;
  sourceUrl: string;
  competitorStoreId: string;
  competitorStoreName: string;
  firstSeenAt: string;
  trendMembershipHint: FeedMembershipHint | null;
};

export type FeedResponse = {
  items: FeedListing[];
  nextCursor: string | null;
};

export const feedQueryKey = (
  windowDays: WindowDays,
  cursor: string | null,
) =>
  ["trend-stories", "feed", windowDays, cursor ?? "first"] as const;

/**
 * `GET /api/trend-stories/feed?window={N}&cursor={cursor}` — rakip mağazaların
 * pencere içindeki yeni listing'leri. Her listing opsiyonel `trendMembershipHint`
 * taşır: kullanıcı bookmark eklediğinde otomatik cluster bağlanır.
 */
export function useFeed(
  windowDays: WindowDays,
  cursor: string | null = null,
) {
  return useQuery<FeedResponse>({
    queryKey: feedQueryKey(windowDays, cursor),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("window", String(windowDays));
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(
        `/api/trend-stories/feed?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Feed alınamadı");
      }
      return (await res.json()) as FeedResponse;
    },
  });
}
