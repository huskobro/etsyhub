"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useRetryVariation(referenceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/variation-jobs/${id}/retry`, {
        method: "POST",
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Yeniden deneme başarısız");
      }
      return r.json();
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["variation-jobs", referenceId] }),
  });
}
