"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * `DELETE /api/competitors/[id]` mutation. Soft delete — deletedAt set.
 * Başarıda liste + detay query'leri invalidate.
 */
export function useDeleteCompetitor() {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/competitors/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Rakip silinemedi");
      }
      return (await res.json()) as { ok: true };
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["competitors"] });
      qc.invalidateQueries({ queryKey: ["competitor", id] });
    },
  });
}
