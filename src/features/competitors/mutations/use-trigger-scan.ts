"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TriggerScanInput } from "../schemas";

type TriggerScanResponse = { jobId: string; scanId: string };

/**
 * `POST /api/competitors/[id]/scan` mutation.
 * Input opsiyonel: default type MANUAL_REFRESH (server tarafı varsayılan).
 */
export function useTriggerScan(competitorId: string) {
  const qc = useQueryClient();
  return useMutation<TriggerScanResponse, Error, TriggerScanInput | undefined>({
    mutationFn: async (input) => {
      const res = await fetch(`/api/competitors/${competitorId}/scan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input ?? {}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Tarama başlatılamadı");
      }
      return (await res.json()) as TriggerScanResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitor", competitorId] });
      qc.invalidateQueries({ queryKey: ["competitor-listings", competitorId] });
      qc.invalidateQueries({ queryKey: ["competitors"] });
    },
  });
}
