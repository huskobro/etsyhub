"use client";

import { useQuery } from "@tanstack/react-query";
import type { SourcePlatform } from "@prisma/client";

export type CompetitorListItem = {
  id: string;
  etsyShopName: string;
  displayName: string | null;
  platform: SourcePlatform;
  shopUrl: string | null;
  totalListings: number | null;
  totalReviews: number | null;
  autoScanEnabled: boolean;
  lastScannedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { listings: number };
};

export type CompetitorListResponse = {
  items: CompetitorListItem[];
  nextCursor: string | null;
};

export const competitorsQueryKey = (q?: string) =>
  ["competitors", { q: q?.trim() ?? "" }] as const;

/**
 * `GET /api/competitors?q=...` sarmalayıcısı.
 * Search input her değişimde yeniden fetch eder (staleTime default provider'dan gelir).
 */
export function useCompetitorsList(params: { q?: string } = {}) {
  return useQuery<CompetitorListResponse>({
    queryKey: competitorsQueryKey(params.q),
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params.q && params.q.trim()) search.set("q", params.q.trim());
      search.set("limit", "60");
      const res = await fetch(`/api/competitors?${search.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Rakip listesi alınamadı");
      }
      return (await res.json()) as CompetitorListResponse;
    },
  });
}
