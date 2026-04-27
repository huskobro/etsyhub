"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useMarkNegative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      isNegative: boolean;
      reason?: string;
    }) => {
      const r = await fetch(
        `/api/local-library/assets/${input.id}/negative`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isNegative: input.isNegative,
            reason: input.reason,
          }),
        },
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Negatif işaretleme başarısız");
      }
      return r.json();
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["local-library"] }),
  });
}
