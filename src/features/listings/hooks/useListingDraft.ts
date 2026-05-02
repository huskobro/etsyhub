"use client";

import { useQuery } from "@tanstack/react-query";
import type { ListingDraftView } from "../types";

/**
 * Fetch draft listing detail (GET /api/listings/draft/[id]).
 *
 * Phase 9 V1 Task 19 — Listing draft view fetch (foundation slice).
 *
 * Spec §5.1: GET /api/listings/draft/[id] → ListingDraftView
 * (includes readiness checks, imageOrder, all metadata).
 */
export function useListingDraft(listingId: string) {
  return useQuery<ListingDraftView>({
    queryKey: ["listing-draft", listingId] as const,
    queryFn: async () => {
      const res = await fetch(`/api/listings/draft/${listingId}`);
      if (!res.ok) {
        const error = new Error("Listing yüklenemedi");
        (error as any).status = res.status;
        throw error;
      }
      const data = (await res.json()) as { listing: ListingDraftView };
      return data.listing;
    },
    enabled: !!listingId,
    staleTime: 30 * 1000, // 30s (same as mockup job polling)
    refetchOnWindowFocus: false,
  });
}
