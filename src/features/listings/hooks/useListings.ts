"use client";

import { useQuery } from "@tanstack/react-query";
import type { ListingIndexView, ListingStatusValue } from "../types";

/**
 * Fetch listing index (GET /api/listings).
 *
 * Phase 9 V1 Task 19 — Listing index fetch (foundation slice).
 *
 * Spec §5.1: GET /api/listings → ListingIndexView[]
 * Optional status filter (compact view, no readiness checks).
 *
 * @param params Optional { status?: ListingStatusValue }
 */
export function useListings(params?: { status?: ListingStatusValue }) {
  return useQuery<ListingIndexView[]>({
    queryKey: ["listings", params?.status ?? "all"] as const,
    queryFn: async () => {
      const url = params?.status
        ? `/api/listings?status=${params.status}`
        : "/api/listings";
      const res = await fetch(url);
      if (!res.ok) {
        const error = new Error("Listings yüklenemedi");
        (error as any).status = res.status;
        throw error;
      }
      const data = (await res.json()) as { listings: ListingIndexView[] };
      return data.listings;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}
