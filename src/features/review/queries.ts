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
  /** IA-33 — Focus mode için tam çözünürlüklü asset URL'i. AI Designs
   *  için storage signed URL ile aynı (provider zaten orijinal sunar);
   *  Local Library için `/api/local-library/asset?hash=...` orijinal
   *  dosyayı stream eder. Grid kart `thumbnailUrl` kullanmaya devam
   *  eder (perf); focus stage `fullResolutionUrl` kullanır. */
  fullResolutionUrl: string | null;
  reviewStatus: ReviewStatusEnum;
  reviewStatusSource: "SYSTEM" | "USER";
  reviewScore: number | null;
  reviewSummary: string | null;
  riskFlagCount: number;
  riskFlags: ReviewRiskFlag[];
  reviewedAt: string | null;
  reviewProviderSnapshot: string | null;
  /** IA-29 — AI advisory karar. Operatör truth'tan ayrı. */
  reviewSuggestedStatus: ReviewStatusEnum | null;
  /** IA-29 — Provider raw score (debug/audit). UI ana skor reviewScore. */
  reviewProviderRawScore: number | null;
  // Phase 7 Task 38 — Quick start CTA için (additive).
  // Yalnız scope === "design" item'larında doludur; local-library asset'leri
  // bu üç alanı null taşır (variation batch / reference / productType yok).
  // ReviewCard "Selection Studio'da Aç" butonu jobId === null ise gizlenir.
  referenceId: string | null;
  productTypeId: string | null;
  jobId: string | null;
  // Pass 24 — Source meta (additive, optional for backward compat).
  source?: ReviewQueueSource;
  // IA Phase 18 — review scoring lifecycle. Backend Job table'dan
  // türev; UI sahte default göstermez. "not_queued" en son satır
  // hiç enqueue edilmemiş demek.
  reviewLifecycle?:
    | "not_queued"
    | "queued"
    | "running"
    | "failed"
    | "ready";
};

/**
 * IA Phase 16 — scope identity contract surfaced from the queue
 * endpoint. Top-bar reads `cardinality` for `Item N / M`, `breakdown`
 * for the three-count summary. `kind` differentiates the active
 * scope so the workspace can label it (queue vs folder) without
 * recomputing client-side.
 */
export type ReviewQueueScope =
  | {
      kind: "folder";
      label: string;
      total: number;
      cardinality: number;
      breakdown: { undecided: number; kept: number; discarded: number };
    }
  | {
      kind: "reference";
      /** Reference cuid (scope identity); UI label resolves
       *  to ref-XXXXXX from item.source.referenceShortId. */
      label: string;
      total: number;
      cardinality: number;
      breakdown: { undecided: number; kept: number; discarded: number };
    }
  | {
      kind: "queue";
      total: number;
      cardinality: number;
      breakdown: { undecided: number; kept: number; discarded: number };
    };

export type ReviewQueueResponse = {
  items: ReviewQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  /** IA Phase 16 — scope identity (CLAUDE.md Madde M). Older API
   *  versions in flight may omit it; UI degrades to items.length /
   *  page-slice counts in that window only. */
  scope?: ReviewQueueScope;
  /** IA Phase 27 (CLAUDE.md Madde R) — admin-resolved scoring
   *  policy. Decision/Outcome derivation client-side uses
   *  `policy.thresholds`; absent payload (legacy server in flight)
   *  falls back to builtin defaults with a dev console warn. */
  policy?: {
    thresholds: { low: number; high: number };
  };
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
  /** IA Phase 16 — scope identity ZOOM (local-only). When set, the
   *  queue endpoint narrows total + scopeBreakdown to a single
   *  `LocalLibraryAsset.folderName`. Ignored for design scope. */
  folder?: string;
  /** IA Phase 19 — reference scope ZOOM (design-only). Single
   *  reference's variations form a scope identity. */
  reference?: string;
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
    // IA Phase 16 — folder zoom in cache key. Empty string keeps
    // legacy "no folder" entries hot.
    params.folder?.trim() ? params.folder.trim() : "",
    // IA Phase 19 — reference zoom (design-only) in cache key.
    params.reference?.trim() ? params.reference.trim() : "",
  ] as const;

export function useReviewQueue(params: Params) {
  return useQuery<ReviewQueueResponse>({
    queryKey: reviewQueueQueryKey(params),
    // IA Phase 25 — live lifecycle (CLAUDE.md Madde N). Background
    // refetch lets the operator watch queued/running assets promote
    // to ready without manual reload. Interval only fires when there
    // is something in flight; ready/idle scopes back off.
    refetchInterval: (query) => {
      const data = query.state.data as ReviewQueueResponse | undefined;
      if (!data) return 8000; // first load — try again shortly
      // IA Phase 28 (CLAUDE.md Madde T) — proof-before-done.
      // not_queued bir item rerun edildikten sonra aslında "kuyruğa
      // alınma yolunda" anlamına geliyor (snapshot wipe + enqueue
      // arasındaki pencere). Polling'i bu durumda da kısa tut
      // ki worker geçişi UI'da görülebilsin. liveCount eşleşen tüm
      // 'unsettled' lifecycle'ları sayar.
      const unsettledCount = (data.items ?? []).filter(
        (it) =>
          it.reviewLifecycle === "queued" ||
          it.reviewLifecycle === "running" ||
          it.reviewLifecycle === "not_queued",
      ).length;
      return unsettledCount > 0 ? 5000 : false;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const url = new URL("/api/review/queue", window.location.origin);
      url.searchParams.set("scope", params.scope);
      const status = effectiveStatus(params);
      if (status) url.searchParams.set("status", status);
      if (params.page) url.searchParams.set("page", String(params.page));
      const trimmedQ = params.q?.trim();
      if (trimmedQ) url.searchParams.set("q", trimmedQ);
      const trimmedFolder = params.folder?.trim();
      if (trimmedFolder) url.searchParams.set("folder", trimmedFolder);
      const trimmedRef = params.reference?.trim();
      if (trimmedRef) url.searchParams.set("reference", trimmedRef);

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
