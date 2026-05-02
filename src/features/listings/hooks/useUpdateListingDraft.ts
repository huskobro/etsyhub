"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateListingMetaInput } from "../schemas";
import type { ListingDraftView } from "../types";
import { listingDraftQueryKey } from "./useListingDraft";

/**
 * PATCH /api/listings/draft/[id] mutation hook.
 *
 * Foundation slice (Task 13-15) PATCH endpoint'i çağırır.
 * Body: UpdateListingMetaSchema strict 6 field (title/description/tags/category/priceCents/materials).
 * Success → invalidateQueries readiness recompute.
 *
 * Phase 8 emsal pattern (useCreateListingDraft).
 */
export function useUpdateListingDraft(id: string) {
  const queryClient = useQueryClient();
  return useMutation<ListingDraftView, Error, UpdateListingMetaInput>({
    mutationFn: async (patch) => {
      const res = await fetch(`/api/listings/draft/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = body?.error ?? body?.message ?? `HTTP ${res.status}`;
        throw new Error(message);
      }
      return (await res.json()) as ListingDraftView;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listingDraftQueryKey(id) });
    },
  });
}
