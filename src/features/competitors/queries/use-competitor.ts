"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  CompetitorListingStatus,
  CompetitorScanStatus,
  CompetitorScanType,
  SourcePlatform,
} from "@prisma/client";
import type { ReviewWindow } from "../schemas";

export type CompetitorDetail = {
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
};

export type CompetitorScanSummary = {
  id: string;
  type: CompetitorScanType;
  status: CompetitorScanStatus;
  provider: string;
  listingsFound: number;
  listingsNew: number;
  listingsUpdated: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type CompetitorDetailResponse = {
  competitor: CompetitorDetail;
  lastScan: CompetitorScanSummary | null;
};

export type CompetitorListing = {
  id: string;
  externalId: string;
  platform: SourcePlatform;
  sourceUrl: string;
  title: string;
  thumbnailUrl: string | null;
  imageUrls: string[];
  priceCents: number | null;
  currency: string | null;
  reviewCount: number;
  favoritesCount: number | null;
  listingCreatedAt: string | null;
  latestReviewAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  status: CompetitorListingStatus;
};

export type CompetitorListingsResponse = {
  items: CompetitorListing[];
  nextCursor: string | null;
  window: ReviewWindow;
  disclaimer: string;
};

export const competitorQueryKey = (id: string) =>
  ["competitor", id] as const;

export const competitorListingsQueryKey = (
  id: string,
  window: ReviewWindow,
) => ["competitor-listings", id, window] as const;

/**
 * `GET /api/competitors/[id]` — competitor + lastScan snapshot.
 */
export function useCompetitor(id: string | undefined) {
  return useQuery<CompetitorDetailResponse>({
    queryKey: competitorQueryKey(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/competitors/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Rakip detayı alınamadı");
      }
      return (await res.json()) as CompetitorDetailResponse;
    },
  });
}

/**
 * `GET /api/competitors/[id]/listings?window=...` — ranked listings + disclaimer.
 */
export function useCompetitorListings(
  id: string | undefined,
  window: ReviewWindow,
) {
  return useQuery<CompetitorListingsResponse>({
    queryKey: competitorListingsQueryKey(id ?? "", window),
    enabled: !!id,
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("window", window);
      search.set("limit", "60");
      const res = await fetch(
        `/api/competitors/${id}/listings?${search.toString()}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Listing akışı alınamadı");
      }
      return (await res.json()) as CompetitorListingsResponse;
    },
  });
}
