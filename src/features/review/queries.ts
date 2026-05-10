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
// Pass 24 — Source clarity. Review queue item'ın hangi kaynaktan geldiğini
// UI'da net göstermek için iki ayrı discriminated union variant.
export type ReviewQueueSourceLocal = {
  kind: "local-library";
  folderName: string;
  fileName: string;
  folderPath: string;
  qualityScore: number | null;
  width: number;
  height: number;
  dpi: number | null;
  // IA Phase 9 — focus workspace info-rail metadata.
  mimeType: string;
  fileSize: number;
  qualityReasons: unknown;
  /** IA Phase 11 — persisted Sharp `metadata.hasAlpha` probe. Null on
   *  legacy rows that haven't been re-scanned yet; UI degrades to the
   *  format-level hint when null. */
  hasAlpha: boolean | null;
};
export type ReviewQueueSourceDesign = {
  kind: "design";
  productTypeKey: string | null;
  referenceShortId: string | null;
  createdAt: string;
  // IA Phase 9 — focus workspace info-rail metadata.
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  /** IA Phase 11 — persisted Sharp `metadata.hasAlpha` probe. Same
   *  semantics as local source. */
  hasAlpha: boolean | null;
};
export type ReviewQueueSource =
  | ReviewQueueSourceLocal
  | ReviewQueueSourceDesign;

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
  // Pass 24 — Source meta (additive, optional for backward compat).
  source?: ReviewQueueSource;
};

export type ReviewQueueResponse = {
  items: ReviewQueueItem[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Canonical operator decision filter. Mirrors the URL `?decision=` param
 * and the chip vocabulary. The hook maps this onto the legacy
 * `?status=ReviewStatus` query the server already understands:
 *
 *   undecided → PENDING    (operator hasn't acted yet — NEEDS_REVIEW
 *                           is intentionally NOT included; that is a
 *                           pipeline auto-flag, not an operator state)
 *   kept      → APPROVED
 *   rejected  → REJECTED
 *
 * `status` is still accepted for callers that already hold a
 * ReviewStatus value (e.g. tests, future surfaces); when both are set
 * `decision` wins so the canonical name is the source of truth.
 */
export type CanonicalDecisionFilter = "undecided" | "kept" | "rejected";

function decisionToStatus(d: CanonicalDecisionFilter): ReviewStatusEnum {
  switch (d) {
    case "undecided":
      return "PENDING";
    case "kept":
      return "APPROVED";
    case "rejected":
      return "REJECTED";
  }
}

type Params = {
  scope: "design" | "local";
  decision?: CanonicalDecisionFilter;
  /** Legacy escape hatch — prefer `decision` for new call sites. */
  status?: ReviewStatusEnum;
  page?: number;
  /** IA Phase 15 — server-side search query. Empty string falls
   *  through (helper drops the URL param). */
  q?: string;
};

/** Resolve the effective server-side status for cache key + URL. */
function effectiveStatus(params: Params): ReviewStatusEnum | undefined {
  if (params.decision) return decisionToStatus(params.decision);
  return params.status;
}

export const reviewQueueQueryKey = (params: Params) =>
  [
    "review-queue",
    params.scope,
    effectiveStatus(params) ?? "ALL",
    params.page ?? 1,
    params.q?.trim() ? params.q.trim() : "",
  ] as const;

export function useReviewQueue(params: Params) {
  return useQuery<ReviewQueueResponse>({
    queryKey: reviewQueueQueryKey(params),
    queryFn: async () => {
      const url = new URL("/api/review/queue", window.location.origin);
      url.searchParams.set("scope", params.scope);
      const status = effectiveStatus(params);
      if (status) url.searchParams.set("status", status);
      if (params.page) url.searchParams.set("page", String(params.page));
      const trimmedQ = params.q?.trim();
      if (trimmedQ) url.searchParams.set("q", trimmedQ);

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
