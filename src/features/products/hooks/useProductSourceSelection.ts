"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * useProductSourceSelection — Product detail Mockups tab'ında "View source
 * selection" cross-link için product'ın bağlandığı SelectionSet'i resolve
 * eder.
 *
 * R5 surface (minimal invaziv):
 *   GET /api/products/[id]/source-selection → { setId, setName }
 *
 * Bu route Listing.mockupJobId → MockupJob.setId zincirini izler. Listing
 * types view'ına setId eklemek yerine ayrı küçük endpoint — ListingDraftView
 * shape'ine dokunmadık (Phase 9 V1 contract sabit).
 */

export type ProductSourceSelection = {
  setId: string;
  setName: string;
} | null;

export function useProductSourceSelection(productId: string) {
  return useQuery<ProductSourceSelection>({
    queryKey: ["product", productId, "source-selection"] as const,
    enabled: !!productId,
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/source-selection`);
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`Source selection lookup failed (${res.status})`);
      }
      return (await res.json()) as ProductSourceSelection;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
