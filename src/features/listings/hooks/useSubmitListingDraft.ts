"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { listingDraftQueryKey } from "./useListingDraft";

/**
 * POST /api/listings/draft/[id]/submit response shape.
 *
 * Service `submitListingDraft` SUCCESS path döner:
 *   { status: "PUBLISHED", etsyListingId, failedReason: null, providerSnapshot }
 *
 * FAIL path service içinde re-throw eder; endpoint withErrorHandling AppError
 * map'ler (404/409/422/503/400/401/429/502). Hook seviyesinde !res.ok ⇒
 * Error throw, body.error message'ı taşır.
 */
export type SubmitListingDraftResult = {
  status: "PUBLISHED";
  etsyListingId: string;
  failedReason: null;
  providerSnapshot: string;
};

/**
 * Phase 9 V1 Task 22 — Listing draft submit mutation hook.
 *
 * UI consumer: ListingDraftView footer "Taslak Gönder" button.
 * Endpoint zaten hazır (HEAD 23f6ffd, Task 17).
 *
 * Honest fail: backend tüm credential/connection/readiness/provider hatalarını
 * typed AppError olarak HTTP'ye map ediyor; hook body.error message'ını taşır.
 *
 * Success → ["listing-draft", id] + ["listings"] invalidate (status PUBLISHED'a
 * çekildi, hem detail hem index refresh).
 *
 * Auto-redirect YOK: kullanıcı mevcut ekranda kalır, status badge yenilenir.
 */
export function useSubmitListingDraft(id: string) {
  const queryClient = useQueryClient();
  return useMutation<SubmitListingDraftResult, Error, void>({
    mutationFn: async () => {
      const res = await fetch(`/api/listings/draft/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = body?.error ?? `HTTP ${res.status}`;
        throw new Error(message);
      }
      return (await res.json()) as SubmitListingDraftResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listingDraftQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });
}
