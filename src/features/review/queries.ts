"use client";

// Phase 6 Task 14 — Review queue veri çekim hook'u.
//
// /api/review/queue?scope=design|local&status=...&page=N için TanStack Query
// wrapper. Default page size 24 (server-tarafında zorlanır).
//
// Multi-tenant: server route requireUser ile user-scope filtreler — istemci
// burada userId yollamaz.

import { useQuery } from "@tanstack/react-query";
import type { ReviewRiskFlag } from "@/providers/review/types";

export type ReviewStatusEnum =
  | "PENDING"
  | "APPROVED"
  | "NEEDS_REVIEW"
  | "REJECTED";

// Phase 6 Dalga B (Task 15): detail panel queue cache'inden okur (yeni
// endpoint açmadık) — bu yüzden tip tüm detail alanlarını içerir.
//   - riskFlagCount: grid kart için (hızlı sayı)
//   - riskFlags: detail panel ReviewRiskFlagList için (full array)
//   - reviewSummary: detail panel "Özet" bölümü
//   - reviewProviderSnapshot: detail panel snapshot satırı (audit trail)
export type ReviewQueueItem = {
  id: string;
  thumbnailUrl: string | null;
  reviewStatus: ReviewStatusEnum;
  reviewStatusSource: "SYSTEM" | "USER";
  reviewScore: number | null;
  reviewSummary: string | null;
  riskFlagCount: number;
  riskFlags: ReviewRiskFlag[];
  reviewedAt: string | null;
  reviewProviderSnapshot: string | null;
  // Phase 7 Task 38 — Quick start CTA için (additive).
  // Yalnız scope === "design" item'larında doludur; local-library asset'leri
  // bu üç alanı null taşır (variation batch / reference / productType yok).
  // ReviewCard "Selection Studio'da Aç" butonu jobId === null ise gizlenir.
  referenceId: string | null;
  productTypeId: string | null;
  jobId: string | null;
};

export type ReviewQueueResponse = {
  items: ReviewQueueItem[];
  total: number;
  page: number;
  pageSize: number;
};

type Params = {
  scope: "design" | "local";
  status?: ReviewStatusEnum;
  page?: number;
};

export const reviewQueueQueryKey = (params: Params) =>
  ["review-queue", params.scope, params.status ?? "ALL", params.page ?? 1] as const;

export function useReviewQueue(params: Params) {
  return useQuery<ReviewQueueResponse>({
    queryKey: reviewQueueQueryKey(params),
    queryFn: async () => {
      const url = new URL("/api/review/queue", window.location.origin);
      url.searchParams.set("scope", params.scope);
      if (params.status) url.searchParams.set("status", params.status);
      if (params.page) url.searchParams.set("page", String(params.page));

      const res = await fetch(url.toString());
      if (!res.ok) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: string };
          detail = body.error ?? "";
        } catch {
          // ignore parse hatası
        }
        throw new Error(
          detail
            ? `Review queue alınamadı (${res.status}): ${detail}`
            : `Review queue alınamadı (${res.status})`,
        );
      }
      return (await res.json()) as ReviewQueueResponse;
    },
  });
}
