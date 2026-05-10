/* eslint-disable no-restricted-syntax */
// QueueReviewWorkspace — IA Phase 11 (review experience completion)
//
// Queue-source adapter on top of `ReviewWorkspaceShell`. Handles AI
// Generated + Local Library items via the unified /api/review/queue
// cache and /api/review/decisions write path. The shell owns layout,
// keyboard map, top bar, action bar, filmstrip, info-rail container,
// and help modal; this file owns:
//   • Live queue cache binding (useReviewQueue)
//   • Source-aware info-rail content (LocalSourceSection /
//     DesignSourceSection — file path, DPI, transparency, score, risk)
//   • Cross-page next/prev (page boundary jumps to neighbouring page's
//     first/last item; no wrap)
//   • Decision write through /api/review/decisions
//   • ReviewStatus → CanonicalDecision adapter
//
// Visual + interaction language is now shared with BatchReviewWorkspace
// through the shell. The hardcoded v4 hex sabitleri live in the shell
// only — this file is presentational glue.

"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReviewQueue,
  type ReviewQueueItem,
} from "@/features/review/queries";
import { buildReviewUrl } from "@/features/review/lib/search-params";
import {
  formatFileSize,
  resolutionHint,
  transparencyDescriptor,
} from "@/features/review/lib/format";
import {
  ReviewWorkspaceShell,
  SectionTitle,
  type CanonicalDecision,
} from "@/features/review/components/ReviewWorkspaceShell";

interface QueueReviewWorkspaceProps {
  scope: "design" | "local";
  itemId: string;
  /** Active page from the URL — drives queue cache lookup + cross-
   *  page boundary navigation. */
  page: number;
  /** Active decision filter (canonical chip param). Forwarded to the
   *  queue hook so the workspace and the underlying grid see the same
   *  filtered set. `undefined` = "all" chip. */
  decision: "undecided" | "kept" | "rejected" | undefined;
}

// Pipeline ReviewStatus → canonical operator decision axis. PENDING and
// NEEDS_REVIEW collapse to UNDECIDED on the operator axis (NEEDS_REVIEW
// is a pipeline auto-flag — surfaced separately as a risk hint).
function statusToCanonical(
  s: ReviewQueueItem["reviewStatus"],
): CanonicalDecision {
  if (s === "APPROVED") return "KEPT";
  if (s === "REJECTED") return "REJECTED";
  return "UNDECIDED";
}

// Reverse map for the legacy /api/review/decisions write path. KEPT →
// APPROVED, REJECTED → REJECTED, UNDECIDED uses PATCH (system-reset).
function canonicalToWriteDecision(
  c: CanonicalDecision,
): "APPROVED" | "REJECTED" | null {
  if (c === "KEPT") return "APPROVED";
  if (c === "REJECTED") return "REJECTED";
  return null;
}

// Decision filter → server status param. Mirrors useReviewQueue's
// internal mapping; duplicated here for the prefetch query key
// reconstruction (unfortunately the cache key shape is exposed).
function decisionToCacheStatus(
  decision: "undecided" | "kept" | "rejected" | undefined,
): "ALL" | "PENDING" | "APPROVED" | "REJECTED" {
  if (!decision) return "ALL";
  if (decision === "undecided") return "PENDING";
  if (decision === "kept") return "APPROVED";
  return "REJECTED";
}

export function QueueReviewWorkspace({
  scope,
  itemId,
  page,
  decision,
}: QueueReviewWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Live queue data — same key the grid uses, so a decision posted
  // here flushes back to the grid on close.
  const { data, isLoading, error } = useReviewQueue({
    scope,
    decision,
    page,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 24;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

  const idx = items.findIndex((it) => it.id === itemId);
  const item = idx >= 0 ? items[idx] : null;

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Cross-page navigation ──────────────────────────────────────────

  const navigateToItemOnPage = useCallback(
    (targetPage: number, targetItemId: string) => {
      router.push(
        buildReviewUrl(pathname, searchParams, {
          page: targetPage === 1 ? undefined : String(targetPage),
          item: targetItemId,
        }),
      );
    },
    [router, pathname, searchParams],
  );

  const prefetchNeighbour = useCallback(
    async (neighbourPage: number) => {
      if (neighbourPage < 1 || neighbourPage > totalPages) return;
      await queryClient.prefetchQuery({
        queryKey: [
          "review-queue",
          scope,
          decisionToCacheStatus(decision),
          neighbourPage,
        ],
        queryFn: async () => {
          const url = new URL(
            "/api/review/queue",
            window.location.origin,
          );
          url.searchParams.set("scope", scope);
          if (decision) {
            const status = decisionToCacheStatus(decision);
            if (status !== "ALL") url.searchParams.set("status", status);
          }
          url.searchParams.set("page", String(neighbourPage));
          const res = await fetch(url.toString());
          if (!res.ok) throw new Error(`prefetch failed: ${res.status}`);
          return await res.json();
        },
      });
    },
    [queryClient, scope, decision, totalPages],
  );

  const goPrev = useCallback(async () => {
    if (idx < 0 || items.length === 0) return;
    if (idx > 0) {
      navigateToItemOnPage(page, items[idx - 1]!.id);
      return;
    }
    if (page <= 1) return;
    await prefetchNeighbour(page - 1);
    const prevPageData = queryClient.getQueryData<{
      items: ReviewQueueItem[];
    }>([
      "review-queue",
      scope,
      decisionToCacheStatus(decision),
      page - 1,
    ]);
    const lastItem =
      prevPageData?.items?.[prevPageData.items.length - 1] ?? null;
    if (!lastItem) return;
    navigateToItemOnPage(page - 1, lastItem.id);
  }, [
    idx,
    items,
    page,
    prefetchNeighbour,
    queryClient,
    scope,
    decision,
    navigateToItemOnPage,
  ]);

  const goNext = useCallback(async () => {
    if (idx < 0 || items.length === 0) return;
    if (idx < items.length - 1) {
      navigateToItemOnPage(page, items[idx + 1]!.id);
      return;
    }
    if (page >= totalPages) return;
    await prefetchNeighbour(page + 1);
    const nextPageData = queryClient.getQueryData<{
      items: ReviewQueueItem[];
    }>([
      "review-queue",
      scope,
      decisionToCacheStatus(decision),
      page + 1,
    ]);
    const firstItem = nextPageData?.items?.[0] ?? null;
    if (!firstItem) return;
    navigateToItemOnPage(page + 1, firstItem.id);
  }, [
    idx,
    items,
    page,
    totalPages,
    prefetchNeighbour,
    queryClient,
    scope,
    decision,
    navigateToItemOnPage,
  ]);

  const exitWorkspace = useCallback(() => {
    router.push(buildReviewUrl(pathname, searchParams, { item: undefined }));
  }, [router, pathname, searchParams]);

  // ── Decision mutation ──────────────────────────────────────────────

  const decisionMutation = useMutation({
    mutationFn: async (
      next: "APPROVED" | "REJECTED",
    ): Promise<"APPROVED" | "REJECTED"> => {
      const res = await fetch("/api/review/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, id: itemId, decision: next }),
      });
      if (!res.ok) throw new Error(`decision failed: ${res.status}`);
      return next;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      setErrorMessage(null);
    },
    onError: () =>
      setErrorMessage("İşlem başarısız oldu — birkaç saniye sonra tekrar deneyin."),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { scope, id: itemId };
      if (scope === "local") body.productTypeKey = "wall_art";
      const res = await fetch("/api/review/decisions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`reset failed: ${res.status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      setErrorMessage(null);
    },
    onError: () =>
      setErrorMessage("Reset başarısız oldu — birkaç saniye sonra tekrar deneyin."),
  });

  // ── Loading / error ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1A1815] text-white/80"
        data-testid="queue-review-workspace"
        data-state="loading"
      >
        <div className="font-mono text-xs uppercase tracking-meta text-white/40">
          Loading review item…
        </div>
      </div>
    );
  }
  if (error || !item) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#1A1815] text-white/80"
        data-testid="queue-review-workspace"
        data-state={error ? "error" : "missing"}
      >
        <h1 className="text-2xl font-semibold">
          {error ? "Review yüklenemedi" : "Kayıt bulunamadı"}
        </h1>
        <p className="max-w-md text-center text-sm text-white/50">
          {error
            ? "Sayfayı yenileyin veya birkaç saniye sonra tekrar deneyin."
            : "Bu öğe silinmiş, başka bir filtrede kalmış ya da farklı bir sayfada olabilir."}
        </p>
        <button
          type="button"
          onClick={exitWorkspace}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:border-white/20 hover:text-white"
        >
          Exit
        </button>
      </div>
    );
  }

  // ── Counts ─────────────────────────────────────────────────────────

  const decidedCount = items.filter(
    (it) => it.reviewStatus === "APPROVED" || it.reviewStatus === "REJECTED",
  ).length;
  const keptCount = items.filter(
    (it) => it.reviewStatus === "APPROVED",
  ).length;
  const undecidedCount = items.length - decidedCount;

  const canGoPrev = idx > 0 || page > 1;
  const canGoNext = idx < items.length - 1 || page < totalPages;

  const currentDecision = statusToCanonical(item.reviewStatus);
  const resetEnabled =
    item.reviewStatusSource === "USER" &&
    !decisionMutation.isPending &&
    !resetMutation.isPending;

  return (
    <ReviewWorkspaceShell<ReviewQueueItem>
      exitHref={buildReviewUrl(pathname, searchParams, { item: undefined })}
      exitLabel="Review"
      scopeLabel={scope === "design" ? "AI · Focus" : "Local · Focus"}
      items={items}
      cursor={idx}
      onJumpToCursor={(targetIdx) => {
        const target = items[targetIdx];
        if (target) navigateToItemOnPage(page, target.id);
      }}
      pageInfo={{ page, total: totalPages }}
      canGoPrev={canGoPrev}
      canGoNext={canGoNext}
      onGoPrev={goPrev}
      onGoNext={goNext}
      decidedCount={decidedCount}
      keptCount={keptCount}
      undecidedCount={undecidedCount}
      currentDecision={currentDecision}
      onDecide={async (_it, next) => {
        const writeNext = canonicalToWriteDecision(next);
        if (!writeNext) return;
        await decisionMutation.mutateAsync(writeNext);
      }}
      onReset={() => resetMutation.mutate()}
      isPending={decisionMutation.isPending || resetMutation.isPending}
      errorMessage={errorMessage}
      resetEnabled={resetEnabled}
      itemId={(it) => it.id}
      filmstripDecisionFor={(it) => statusToCanonical(it.reviewStatus)}
      filmstripThumb={(it) => ({ thumbnailUrl: it.thumbnailUrl })}
      itemTitle={(it) =>
        it.source?.kind === "local-library"
          ? it.source.fileName
          : it.source?.kind === "design" && it.source.productTypeKey
            ? it.source.productTypeKey
            : scope === "design"
              ? "AI variation"
              : "Local asset"
      }
      renderStage={(it) =>
        it.thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={it.thumbnailUrl}
            alt={`${it.source?.kind ?? scope} review item`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/40">
            Önizleme yok
          </div>
        )
      }
      renderInfoRail={(it) => <QueueInfoRail item={it} />}
      testId="queue-review-workspace"
      dataAttributes={{ "data-source": item.source?.kind ?? scope }}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────
// Source-aware info-rail content
// ────────────────────────────────────────────────────────────────────────

function QueueInfoRail({ item }: { item: ReviewQueueItem }) {
  return (
    <>
      {item.reviewStatusSource === "USER" ? (
        <div className="font-mono text-xs uppercase tracking-meta text-white/40">
          Operator override
        </div>
      ) : null}

      {item.source?.kind === "local-library" ? (
        <LocalSourceSection source={item.source} />
      ) : item.source?.kind === "design" ? (
        <DesignSourceSection
          source={item.source}
          referenceId={item.referenceId}
          reviewScore={item.reviewScore}
          riskFlagCount={item.riskFlagCount}
        />
      ) : null}

      {item.reviewSummary ? (
        <section>
          <SectionTitle>Summary</SectionTitle>
          <p className="mt-2 text-xs leading-relaxed text-white/75">
            {item.reviewSummary}
          </p>
        </section>
      ) : null}

      {item.riskFlagCount > 0 ? (
        <section>
          <SectionTitle>Risk flags</SectionTitle>
          <div className="mt-2 text-xs text-white/75">
            {item.riskFlagCount} işaret
          </div>
        </section>
      ) : null}

      {item.reviewProviderSnapshot ? (
        <section>
          <SectionTitle>Provider</SectionTitle>
          <p className="mt-2 font-mono text-xs text-white/60">
            {item.reviewProviderSnapshot}
          </p>
        </section>
      ) : null}
    </>
  );
}

function LocalSourceSection({
  source,
}: {
  source: Extract<
    NonNullable<ReviewQueueItem["source"]>,
    { kind: "local-library" }
  >;
}) {
  const transparency = transparencyDescriptor(source.mimeType, source.hasAlpha);
  const hint = resolutionHint({
    dpi: source.dpi,
    width: source.width,
    height: source.height,
  });
  return (
    <section data-testid="info-rail-local">
      <SectionTitle>File</SectionTitle>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-white/40">Folder</dt>
        <dd
          className="break-all font-mono text-white/75"
          title={source.folderPath}
        >
          {source.folderName}
        </dd>
        <dt className="text-white/40">Path</dt>
        <dd className="break-all font-mono text-white/50">
          {source.folderPath}
        </dd>
        <dt className="text-white/40">Format</dt>
        <dd className="font-mono text-white/75">{transparency.format}</dd>
        <dt className="text-white/40">Size</dt>
        <dd className="text-white/75">{formatFileSize(source.fileSize)}</dd>
        <dt className="text-white/40">Resolution</dt>
        <dd className="text-white/75">
          {source.width}×{source.height}
          {source.dpi ? ` · ${source.dpi} DPI` : ""}
        </dd>
        <dt className="text-white/40">Transparency</dt>
        <dd
          className="text-white/75"
          data-probed={transparency.probed || undefined}
        >
          {transparency.label}
        </dd>
        {source.qualityScore !== null ? (
          <>
            <dt className="text-white/40">Quality</dt>
            <dd className="text-white/75">{source.qualityScore}/100</dd>
          </>
        ) : null}
        {hint ? (
          <>
            <dt className="text-white/40">Hint</dt>
            <dd className="text-white/60">{hint}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

function DesignSourceSection({
  source,
  referenceId,
  reviewScore,
  riskFlagCount,
}: {
  source: Extract<
    NonNullable<ReviewQueueItem["source"]>,
    { kind: "design" }
  >;
  referenceId: string | null;
  reviewScore: number | null;
  riskFlagCount: number;
}) {
  const transparency = transparencyDescriptor(source.mimeType, source.hasAlpha);
  return (
    <section data-testid="info-rail-design">
      <SectionTitle>Variation</SectionTitle>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-white/40">Product</dt>
        <dd className="font-mono text-white/75">
          {source.productTypeKey ?? "—"}
        </dd>
        <dt className="text-white/40">Reference</dt>
        <dd className="font-mono text-white/75">
          {source.referenceShortId ? `ref-${source.referenceShortId}` : "—"}
        </dd>
        <dt className="text-white/40">Format</dt>
        <dd className="font-mono text-white/75">{transparency.format}</dd>
        <dt className="text-white/40">Size</dt>
        <dd className="text-white/75">{formatFileSize(source.fileSize)}</dd>
        {source.width != null && source.height != null ? (
          <>
            <dt className="text-white/40">Resolution</dt>
            <dd className="text-white/75">
              {source.width}×{source.height}
            </dd>
          </>
        ) : null}
        <dt className="text-white/40">Transparency</dt>
        <dd
          className="text-white/75"
          data-probed={transparency.probed || undefined}
        >
          {transparency.label}
        </dd>
        {reviewScore !== null ? (
          <>
            <dt className="text-white/40">Quality</dt>
            <dd className="text-white/75">{reviewScore}/100</dd>
          </>
        ) : null}
        {riskFlagCount > 0 ? (
          <>
            <dt className="text-white/40">Risk</dt>
            <dd className="text-amber-300">{riskFlagCount} işaret</dd>
          </>
        ) : null}
      </dl>
      {referenceId ? (
        <Link
          href={`/references/${referenceId}/variations`}
          className="mt-3 inline-flex items-center gap-1 font-mono text-xs text-white/75 underline-offset-2 hover:underline"
        >
          ↑ open reference variations
        </Link>
      ) : null}
    </section>
  );
}
