"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { listingDraftQueryKey } from "./useListingDraft";

export type ResetListingResult = {
  status: "DRAFT";
  previousEtsyListingId: string | null;
};

/**
 * Phase 9 V1 — Listing FAILED → DRAFT reset mutation hook.
 *
 * UI consumer: SubmitResultPanel FAILED status banner'ında
 * "Yeniden DRAFT'a çevir" button.
 *
 * Endpoint: POST /api/listings/draft/[id]/reset-to-draft
 *
 * Honest fail: backend status guard 409 (FAILED dışı), cross-user 404, soft-deleted 404.
 *
 * Success → ["listing-draft", id] + ["listings"] invalidate (status DRAFT'a
 * çekildi, hem detail hem index refresh).
 */
export function useResetListingToDraft(id: string) {
  const queryClient = useQueryClient();
  return useMutation<ResetListingResult, Error, void>({
    mutationFn: async () => {
      const res = await fetch(`/api/listings/draft/${id}/reset-to-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = body?.error ?? `HTTP ${res.status}`;
        throw new Error(message);
      }
      return (await res.json()) as ResetListingResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listingDraftQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}
