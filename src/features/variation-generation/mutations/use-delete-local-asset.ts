"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteLocalAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/local-library/assets/${id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Silme başarısız");
      }
      return r.json();
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["local-library"] }),
  });
}
