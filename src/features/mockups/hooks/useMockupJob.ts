"use client";

import { useQuery } from "@tanstack/react-query";

// Backend Task 17 GET /api/mockup/jobs/[jobId] response shape
export type MockupJobView = {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL_COMPLETE" | "FAILED" | "CANCELLED";
  packSize: number;
  actualPackSize: number;
  totalRenders: number;
  successRenders: number;
  failedRenders: number;
  coverRenderId: string | null;
  errorSummary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  estimatedCompletionAt: string | null;
  renders: MockupRenderView[];
};

export type MockupRenderView = {
  id: string;
  packPosition: number | null;
  selectionReason: string;
  status: "PENDING" | "RENDERING" | "SUCCESS" | "FAILED";
  outputKey: string | null;
  thumbnailKey: string | null;
  errorClass:
    | "RENDER_TIMEOUT"
    | "TEMPLATE_INVALID"
    | "SOURCE_QUALITY"
    | "SAFE_AREA_OVERFLOW"
    | "PROVIDER_DOWN"
    | null;
  errorDetail: string | null;
  templateSnapshot: { templateName: string; aspectRatios: string[] } | null;
  variantId: string;
  retryCount: number;
  startedAt: string | null;
  completedAt: string | null;
};

export const mockupJobQueryKey = (jobId: string) => ["mockup-job", jobId] as const;

const TERMINAL_STATUSES: MockupJobView["status"][] = [
  "COMPLETED",
  "PARTIAL_COMPLETE",
  "FAILED",
  "CANCELLED",
];

/**
 * Mockup job polling hook (Spec §5.5).
 *
 * Phase 7 v1.0.1 fix emsali (ExportButton.tsx): `refetchQueries` —
 * `invalidateQueries` global staleTime 30s ile mark-stale yapar ama
 * refetch'i ertele; component zaten mount'lı + refetchOnWindowFocus
 * false olduğundan fiili refetch gecikir (manuel QA 10+sn). refetchQueries
 * staleness bypass.
 *
 * @param jobId Job id (server entry'de SSR ownership check yapıldı)
 */
export function useMockupJob(jobId: string) {
  return useQuery<MockupJobView>({
    queryKey: mockupJobQueryKey(jobId),
    queryFn: async () => {
      const res = await fetch(`/api/mockup/jobs/${jobId}`);
      if (res.status === 404) throw new Error("Job bulunamadı");
      if (!res.ok) throw new Error(`Job yüklenemedi (${res.status})`);
      return (await res.json()) as MockupJobView;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000; // henüz veri yok, polling devam
      if (TERMINAL_STATUSES.includes(data.status)) return false; // terminal, polling dur
      return 3000;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}
