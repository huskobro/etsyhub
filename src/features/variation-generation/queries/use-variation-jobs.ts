"use client";

import { useQuery } from "@tanstack/react-query";
import type { GeneratedDesign } from "@prisma/client";

// Polling sözleşmesi: in-flight design varsa 5sn'de bir refetch; hepsi terminal
// (SUCCESS/FAIL) olunca durur. Worker'ın state geçişlerini UI'a yansıtır.
export function useVariationJobs(referenceId: string) {
  return useQuery({
    queryKey: ["variation-jobs", referenceId],
    queryFn: async (): Promise<{ designs: GeneratedDesign[] }> => {
      const r = await fetch(`/api/variation-jobs?referenceId=${referenceId}`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "İşler yüklenemedi");
      }
      return r.json();
    },
    refetchInterval: (q) => {
      const ds = q.state.data?.designs ?? [];
      const inflight = ds.some(
        (d) =>
          d.state === "QUEUED" ||
          d.state === "PROVIDER_PENDING" ||
          d.state === "PROVIDER_RUNNING",
      );
      return inflight ? 5000 : false;
    },
  });
}
