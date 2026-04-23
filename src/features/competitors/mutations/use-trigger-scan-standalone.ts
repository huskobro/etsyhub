"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TriggerScanInput } from "../schemas";

type TriggerScanResponse = { jobId: string; scanId: string };

/**
 * `POST /api/competitors/[id]/scan` — competitorId her çağrıda farklı olabilir
 * (liste sayfasında kart bazlı "Tara" butonu).
 *
 * `useTriggerScan(id)` hook'u tek competitor detay sayfası için; burası liste.
 */
export function useTriggerScanStandalone() {
  const qc = useQueryClient();
  return useMutation<
    TriggerScanResponse,
    Error,
    string,
    { competitorId: string }
  >({
    mutationFn: async (competitorId) => {
      const body: TriggerScanInput = { type: "MANUAL_REFRESH" };
      const res = await fetch(`/api/competitors/${competitorId}/scan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Tarama başlatılamadı");
      }
      return (await res.json()) as TriggerScanResponse;
    },
    onSuccess: (_data, competitorId) => {
      qc.invalidateQueries({ queryKey: ["competitors"] });
      qc.invalidateQueries({ queryKey: ["competitor", competitorId] });
      qc.invalidateQueries({
        queryKey: ["competitor-listings", competitorId],
      });
    },
  });
}
