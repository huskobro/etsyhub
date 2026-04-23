"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AddCompetitorInput } from "../schemas";

type CreateResponse = {
  competitor: { id: string; etsyShopName: string };
};

/**
 * `POST /api/competitors` mutation. Başarıda tüm `competitors` liste
 * query'lerini invalidate eder.
 */
export function useCreateCompetitor() {
  const qc = useQueryClient();
  return useMutation<CreateResponse, Error, AddCompetitorInput>({
    mutationFn: async (input) => {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Rakip eklenemedi");
      }
      return (await res.json()) as CreateResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitors"] });
    },
  });
}
