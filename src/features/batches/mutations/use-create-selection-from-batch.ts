"use client";

import { useMutation } from "@tanstack/react-query";

/**
 * Batch-first Phase 3 — useCreateSelectionFromBatch
 *
 * Batch detail "Create Selection" CTA'sının React Query mutation hook'u.
 * POST /api/batches/[batchId]/create-selection — body yok, sunucu
 * batch'in KEPT asset'lerinden otomatik resolve eder (reference,
 * productType, auto-name).
 *
 * onSuccess'te UI redirect (router.push /selections/{setId}) yapar.
 * Hata path'i UI'a propagate edilir (NotFoundError 404, ValidationError
 * 400 — "NO_KEPT_ASSETS" gibi).
 */

export type CreateSelectionFromBatchResult = {
  setId: string;
  name: string;
  itemsAdded: number;
  promotedCreated: number;
};

export function useCreateSelectionFromBatch() {
  return useMutation({
    mutationFn: async (batchId: string): Promise<CreateSelectionFromBatchResult> => {
      const r = await fetch(`/api/batches/${batchId}/create-selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ?? "Selection oluşturulamadı",
        );
      }
      return (await r.json()) as CreateSelectionFromBatchResult;
    },
  });
}
