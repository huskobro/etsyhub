"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

export type CreateVariationsBody = {
  referenceId: string;
  providerId: string;
  aspectRatio: "1:1" | "2:3" | "3:2";
  quality?: "medium" | "high";
  brief?: string;
  count: number;
};

export function useCreateVariations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateVariationsBody) => {
      const r = await fetch("/api/variation-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Üretim başlatılamadı");
      }
      return r.json() as Promise<{
        designIds: string[];
        failedDesignIds: string[];
      }>;
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({
        queryKey: ["variation-jobs", vars.referenceId],
      }),
  });
}
