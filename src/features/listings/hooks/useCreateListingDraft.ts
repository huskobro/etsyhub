"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateListingDraftInput } from "../schemas";

/**
 * Create draft listing from mockup job (POST /api/listings/draft).
 *
 * Phase 9 V1 Task 19 — Listing creation mutation (foundation slice).
 *
 * Spec §6.2: POST /api/listings/draft with mockupJobId
 * → 202 response with { listingId: string }
 *
 * Invalidates listings index on success (soft cache invalidation).
 */
export function useCreateListingDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateListingDraftInput) => {
      const res = await fetch("/api/listings/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const error = new Error("Listing oluşturulamadı");
        (error as any).status = res.status;
        throw error;
      }
      const data = (await res.json()) as { listingId: string };
      return data;
    },
    onSuccess: () => {
      // Invalidate listings index (compact view cache)
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}
