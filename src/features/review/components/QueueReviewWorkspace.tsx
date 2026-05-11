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
import { EvaluationPanel } from "@/features/review/components/EvaluationPanel";
import { buildEvaluation } from "@/features/review/lib/evaluation";
import { getOperatorDecision } from "@/features/review/lib/operator-decision";

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
  /** IA Phase 12 — workspace anchor (CLAUDE.md Madde H). */
  totalReviewPending?: number;
  /** IA-34 — Source label for topbar pending block. */
  sourcePendingLabel?: string;
  /** IA Phase 12 — next pending scope; for AI/Local items the
   *  resolver typically returns the next pending folder (local) or
   *  the next pending batch (AI item with batch lineage). */
  nextScope?: {
    href: string;
    label: string;
    kind: "batch" | "folder" | "queue";
  } | null;
  /** IA Phase 16 — scope identity ZOOM (local-only). Page resolves
   *  current item'ın folderName'ini server-side ve buradan geçirir.
   *  Queue hook'una `folder=` parametresi olarak iletilir; queue
   *  endpoint o folder'ın total + scopeBreakdown'ını döner. AI
   *  scope'ta her zaman null. */
  focusFolderName?: string | null;
  /** IA Phase 19 — scope identity ZOOM (design-only). Reference
   *  scope identity. Queue hook'una `reference=` parametresi
   *  olarak iletilir. Local scope'ta her zaman null. */
  focusReferenceId?: string | null;
  /** IA-34 — scope identity ZOOM (design-only): batch lineage.
   *  Default deep-link scope = batch (reference baskın olmak için
   *  explicit `?scope=reference` gerekir). Queue hook'una `batch=`
   *  param'ı olarak iletilir; batch dominant ise reference param'ı
   *  GÖNDERILMEZ. */
  focusBatchId?: string | null;
  /** IA Phase 18 — adjacent scope navigation (CLAUDE.md Madde M
   *  scope ekseni). When set, the shell wires up scope-axis
   *  keyboard shortcuts (`,` / `.`). */
  scopeNav?: {
    prev: { href: string; label: string } | null;
    next: { href: string; label: string } | null;
  };
  /** IA Phase 19 — scope picker dropdown data. Operatör top-bar'dan
   *  başka bir folder/reference'a hızlıca atlayabilir. */
  scopePicker?: {
    kind: "folder" | "reference" | "batch";
    activeId: string | null;
    entries: Array<{
      id: string;
      label: string;
      pendingCount: number;
      href: string;
    }>;
  };
}

// IA-30 (CLAUDE.md Madde V) — canonical operator decision axis SADECE
// USER damgalı item'lardan beslenir. AI advisory (suggested status)
// final karar değildir; source !== USER ise operator axis'te
// UNDECIDED. Helper tek nokta: getOperatorDecision (cards, filmstrip,
// scope counts hepsi aynı semantikten geçer).
function statusToCanonical(
  status: ReviewQueueItem["reviewStatus"],
  source: ReviewQueueItem["reviewStatusSource"],
): CanonicalDecision {
  return getOperatorDecision({
    reviewStatus: status,
    reviewStatusSource: source,
  });
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
// reconstruction (cache key shape is exposed by the query layer).
//
// IA-30/IA-31 reminder (CLAUDE.md Madde V): "kept" UI semantik
// olarak operatör damgası (`reviewStatus = APPROVED AND
// reviewStatusSource = USER`) demek. Cache key ile server status
// filter aynı raw enum değerini taşır (`APPROVED`), ama queue
// endpoint kept/rejected sayımlarını **source = USER** kısıtıyla
// hesaplar (route.ts breakdownWhere). AI advisory hiçbir yerde
// "kept" sayımına sızmaz — burada "APPROVED" sadece prefetch
// cache key normalization'ı içindir, downstream gate değildir.
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
  totalReviewPending,
  sourcePendingLabel,
  nextScope,
  focusFolderName,
  focusReferenceId,
  focusBatchId,
  scopeNav,
  scopePicker,
}: QueueReviewWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // IA Phase 16 + 19 + IA-34 — scope identity ZOOM.
  //   • Local focus mode: queue?folder=<currentFolderName>.
  //   • Design focus mode default: queue?batch=<currentBatchId>.
  //   • Design focus mode (reference explicit): queue?reference=<...>.
  // Scope priority: batch > reference > queue.
  const folderQueryArg = scope === "local" && focusFolderName
    ? focusFolderName
    : undefined;
  // Batch ile reference ikisi de varsa batch baskın — caller (page
  // loader) `focusReferenceId`'i null'a çekerek explicit reference
  // dominance'ı override edebilir.
  const batchQueryArg =
    scope === "design" && focusBatchId ? focusBatchId : undefined;
  const referenceQueryArg =
    scope === "design" && !batchQueryArg && focusReferenceId
      ? focusReferenceId
      : undefined;

  // Live queue data — same key the grid uses, so a decision posted
  // here flushes back to the grid on close.
  const { data, isLoading, error } = useReviewQueue({
    scope,
    decision,
    page,
    folder: folderQueryArg,
    reference: referenceQueryArg,
    batch: batchQueryArg,
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
      // IA Phase 16 — prefetch key matches queries.ts 6-tuple
      // (q empty when not searching, folder empty when not zoomed).
      await queryClient.prefetchQuery({
        queryKey: [
          "review-queue",
          scope,
          decisionToCacheStatus(decision),
          neighbourPage,
          "",
          folderQueryArg ?? "",
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
          if (folderQueryArg) url.searchParams.set("folder", folderQueryArg);
          const res = await fetch(url.toString());
          if (!res.ok) throw new Error(`prefetch failed: ${res.status}`);
          return await res.json();
        },
      });
    },
    [queryClient, scope, decision, totalPages, folderQueryArg],
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
      "",
      folderQueryArg ?? "",
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
    folderQueryArg,
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
      "",
      folderQueryArg ?? "",
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
    folderQueryArg,
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
      setErrorMessage("Action failed — try again in a few seconds."),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      // IA-30 — local productTypeKey artık server tarafında resolve
      // ediliyor (folder mapping > convention > body override). UI
      // hardcoded değer GÖNDERMEZ.
      const body: Record<string, unknown> = { scope, id: itemId };
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
      setErrorMessage("Reset failed — try again in a few seconds."),
  });

  // IA Phase 26 — explicit rerun: wipes snapshot + enqueues a new
  // provider call (PATCH with `rerun: true`). Server-side preserve
  // semantic stays the default; this path is opt-in only.
  const rerunMutation = useMutation({
    mutationFn: async () => {
      // IA-30 — local productTypeKey server-side resolve (folder mapping).
      const body: Record<string, unknown> = { scope, id: itemId, rerun: true };
      const res = await fetch("/api/review/decisions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `rerun failed: ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    },
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
          {error ? "Couldn't load review" : "Item not found"}
        </h1>
        <p className="max-w-md text-center text-sm text-white/50">
          {error
            ? "Refresh the page or try again in a few seconds."
            : "This item may be deleted, hidden by a filter, or on a different page."}
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

  // ── Scope identity counts (IA Phase 16) ────────────────────────────
  //
  // Sayaçlar **server-side scope breakdown**'ından gelir, page slice
  // değil. Local focus mode'da scope = active folder; aksi halde
  // scope = entire queue (filtered by decision chip + q). UI'a
  // CLAUDE.md Madde M scope identity contract'ı gerçek sayılarla
  // beslenir.
  //
  // Backward compat: server scope alanı yoksa (deploy window'unda
  // legacy yanıt), eski page-slice yöntemi fallback kalır.
  const breakdown = data?.scope?.breakdown;
  const cardinality = data?.scope?.cardinality ?? total;
  const keptCount = breakdown?.kept ?? items.filter(
    (it) => it.reviewStatus === "APPROVED",
  ).length;
  const discardedCount = breakdown?.discarded ?? items.filter(
    (it) => it.reviewStatus === "REJECTED",
  ).length;
  const undecidedCount = breakdown?.undecided ?? (items.length - keptCount - discardedCount);

  const canGoPrev = idx > 0 || page > 1;
  const canGoNext = idx < items.length - 1 || page < totalPages;

  const currentDecision = statusToCanonical(item.reviewStatus, item.reviewStatusSource);
  const resetEnabled =
    item.reviewStatusSource === "USER" &&
    !decisionMutation.isPending &&
    !resetMutation.isPending;

  return (
    <ReviewWorkspaceShell<ReviewQueueItem>
      exitHref={buildReviewUrl(pathname, searchParams, { item: undefined })}
      exitLabel="Review"
      scopeLabel={
        scope === "design"
          ? // IA-34 — scope priority: batch > reference > queue.
            // Topbar label must reflect the same priority the
            // query/picker uses; otherwise the operator sees a
            // "Reference …" header while the picker swaps batches.
            data?.scope?.kind === "batch"
            ? `Batch · batch-${data.scope.label.slice(-6)}`
            : data?.scope?.kind === "reference"
              ? `Reference · ref-${data.scope.label.slice(-6)}`
              : item.source?.kind === "design" && item.source.batchShortId
                ? `Batch · batch-${item.source.batchShortId}`
                : item.source?.kind === "design" && item.source.referenceShortId
                  ? `Reference · ref-${item.source.referenceShortId}`
                  : "AI Designs"
          : data?.scope?.kind === "folder"
            ? `Folder · ${data.scope.label}`
            : item.source?.kind === "local-library"
              ? `Folder · ${item.source.folderName}`
              : "Local Library"
      }
      totalReviewPending={totalReviewPending}
      sourcePendingLabel={sourcePendingLabel}
      nextScope={nextScope ?? null}
      items={items}
      cursor={idx}
      onJumpToCursor={(targetIdx) => {
        const target = items[targetIdx];
        if (target) navigateToItemOnPage(page, target.id);
      }}
      scopeTotal={cardinality}
      canGoPrev={canGoPrev}
      canGoNext={canGoNext}
      onGoPrev={goPrev}
      onGoNext={goNext}
      scopeNav={scopeNav}
      scopePicker={scopePicker}
      keptCount={keptCount}
      discardedCount={discardedCount}
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
      filmstripDecisionFor={(it) => statusToCanonical(it.reviewStatus, it.reviewStatusSource)}
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
      renderStage={(it) => {
        // IA-33 — focus mode için tam çözünürlüklü asset. Local için
        // `/api/local-library/asset` orijinal dosyayı stream eder (4096×
        // 4096 JPEG → 760×760 stage'i tam doldurur); AI için aynı
        // storage signed URL (provider zaten orijinal sunar, ek round-
        // trip yok). thumbnailUrl fallback'i UI dataset farklı türlü
        // gelirse defansif zincir.
        const src = it.fullResolutionUrl ?? it.thumbnailUrl;
        return src ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt={`${it.source?.kind ?? scope} review item`}
            className="pointer-events-none h-full w-full select-none object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/40">
            No preview
          </div>
        );
      }}
      renderInfoRail={(it) => (
        <QueueInfoRail
          item={it}
          scopeTrigger={(() => {
            // IA Phase 22 — focus mode trigger CTA. Local: folder
            // scope; Design: reference scope. Both gate on having
            // a real scope identity so we never fire a queue-wide
            // trigger by accident.
            if (scope === "local") {
              const folder =
                it.source?.kind === "local-library"
                  ? it.source.folderName
                  : null;
              if (!folder) return undefined;
              return {
                label: `“${folder}” folder`,
                onTrigger: async () => {
                  // IA-30 — productTypeKey server-resolve (folder
                  // mapping → convention). UI hardcoded değer
                  // göndermez.
                  const r = await fetch("/api/review/scope-trigger", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      scope: "folder",
                      folderName: folder,
                    }),
                  });
                  if (!r.ok) {
                    const body = await r.json().catch(() => ({}));
                    throw new Error(body?.error ?? `HTTP ${r.status}`);
                  }
                  // Refresh the queue so the lifecycle promotes.
                  await queryClient.invalidateQueries({ queryKey: ["review-queue"] });
                },
              };
            }
            const refId =
              it.source?.kind === "design" ? it.referenceId : null;
            if (!refId) return undefined;
            return {
              label: `ref-${refId.slice(-6)}`,
              onTrigger: async () => {
                const r = await fetch("/api/review/scope-trigger", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    scope: "reference",
                    referenceId: refId,
                  }),
                });
                if (!r.ok) {
                  const body = await r.json().catch(() => ({}));
                  throw new Error(body?.error ?? `HTTP ${r.status}`);
                }
                await queryClient.invalidateQueries({ queryKey: ["review-queue"] });
              },
            };
          })()}
          rerun={
            // IA Phase 26 — explicit rerun affordance. Only available
            // when the asset already has a snapshot (otherwise there
            // is nothing to "rerun") and a decision job isn't already
            // in flight. Operator override items can still rerun —
            // sticky guard at the worker decides whether to overwrite.
            it.reviewProviderSnapshot
              ? {
                  enabled: !rerunMutation.isPending,
                  onRerun: async () => {
                    await rerunMutation.mutateAsync();
                  },
                }
              : undefined
          }
          thresholds={data?.policy?.thresholds}
        />
      )}
      testId="queue-review-workspace"
      dataAttributes={{ "data-source": item.source?.kind ?? scope }}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────
// Source-aware info-rail content
// ────────────────────────────────────────────────────────────────────────

function QueueInfoRail({
  item,
  scopeTrigger,
  rerun,
  thresholds,
}: {
  item: ReviewQueueItem;
  scopeTrigger:
    | { label: string; onTrigger: () => Promise<void> }
    | undefined;
  rerun:
    | { enabled: boolean; onRerun: () => Promise<void> }
    | undefined;
  /** IA Phase 27 (CLAUDE.md Madde R) — admin-resolved decision
   *  thresholds from the queue endpoint payload. Passed through to
   *  `buildEvaluation` so the Decision/Outcome derivation respects
   *  operator overrides instead of hardcoded 60/90. */
  thresholds: { low: number; high: number } | undefined;
}) {
  // IA Phase 17 — full applicability context. Design item'larda
  // productType backend'den item.source.productTypeKey ile gelir.
  // Local item'larda backend mapping'den resolve ediyor (server'da),
  // UI render için criteria evaluator'ün bir productType'a ihtiyacı
  // IA-35 — productType context her iki source'tan da gerçek
  // resolved key'i alır:
  //   • design → item.source.productTypeKey (always set by generator)
  //   • local  → item.source.productTypeKey (queue endpoint folder
  //     mapping ile resolve eder; null → operatör henüz mapping
  //     atamadı, applicability rules "no productType" davranışına
  //     düşer ve sahte fallback uygulanmaz)
  // Operatöre gösterilen score backend'in deterministic system
  // score'u; checklist applicability bu gerçek bağlama göre hesaplanır.
  const productType: string | null =
    item.source?.kind === "design"
      ? item.source.productTypeKey ?? null
      : item.source?.kind === "local-library"
        ? item.source.productTypeKey
        : null;
  const format = item.source?.mimeType
    ? item.source.mimeType.replace("image/", "").toLowerCase()
    : "png";
  const hasAlpha = item.source?.hasAlpha ?? null;
  const sourceKind: "design" | "local-library" =
    item.source?.kind === "local-library" ? "local-library" : "design";

  const evaluation = buildEvaluation({
    reviewedAt: item.reviewedAt,
    reviewScore: item.reviewScore,
    reviewSummary: item.reviewSummary,
    reviewProviderSnapshot: item.reviewProviderSnapshot,
    riskFlags: item.riskFlags,
    operatorOverride: item.reviewStatusSource === "USER",
    // IA-35 — composeContext yalnız productType resolved'sa kurulur.
    // Null ise (local folder pending mapping) compose hiç çalışmaz;
    // EvaluationPanel snapshot'a düşer ve operatöre "Map folder"
    // mesajı gösterilebilir. Sahte "wall_art" YOK.
    composeContext:
      productType !== null
        ? {
            productType,
            format,
            hasAlpha,
            sourceKind,
            transformsApplied: [],
          }
        : undefined,
    backendLifecycle: item.reviewLifecycle,
    thresholds,
    // IA Phase 28 — stored decision = persisted reviewStatus (operator).
    storedReviewStatus: item.reviewStatus,
    // IA-29 — AI advisory ayrı katman. PENDING (henüz scored değil)
    // null'a çekilir; null → aiSuggestion lifecycle ready iken
    // derived'a düşer.
    aiSuggestedStatus:
      item.reviewSuggestedStatus &&
      item.reviewSuggestedStatus !== "PENDING"
        ? (item.reviewSuggestedStatus as "APPROVED" | "NEEDS_REVIEW" | "REJECTED")
        : null,
  });
  return (
    <>
      {/* Source-specific metadata sits above evaluation; AI + Local
       *   share the unified info-rail order: source meta → evaluation →
       *   operator override note. */}
      {item.source?.kind === "local-library" ? (
        <LocalSourceSection source={item.source} />
      ) : item.source?.kind === "design" ? (
        <DesignSourceSection
          source={item.source}
          referenceId={item.referenceId}
        />
      ) : null}

      {/* IA Phase 26 — single source of truth for operator-override
       *   messaging. EvaluationPanel's Decision block already states
       *   "Operator decision" + the reason cümlesi; ayrı bir section
       *   tekrarlamak gerek değil (CLAUDE.md Madde M++ — no duplication). */}
      <EvaluationPanel
        evaluation={evaluation}
        scopeTrigger={scopeTrigger}
        rerun={rerun}
      />
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
  // IA-34 — File section collapsible (default closed). Folder/Path/
  // Format/Size/Resolution/Transparency/Hint dikey alanı yiyordu;
  // operatör ihtiyaç duyduğunda açar. Provider / Rerun Review /
  // Variation / Stored decision aynı görsel pattern'i kullanır:
  // button + SectionTitle + `+`/`−` glyph (`Show/Hide` metni YOK).
  // CLAUDE.md Madde Q — information density without clutter.
  const [open, setOpen] = useState(false);
  // IA Phase 16 — Quality satırı EvaluationPanel'e taşındı (sistem
  // skor tek yerde). Hint hâlâ kaynak metadata'da kalır — DPI/Res
  // hint mekanik bir kural; sistem değerlendirmesinden bağımsızdır.
  const transparency = transparencyDescriptor(source.mimeType, source.hasAlpha);
  const hint = resolutionHint({
    dpi: source.dpi,
    width: source.width,
    height: source.height,
  });
  return (
    <section data-testid="info-rail-local">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
        aria-controls="info-rail-local-content"
        data-testid="info-rail-local-toggle"
      >
        <SectionTitle>File</SectionTitle>
        <span
          className="font-mono text-[10px] uppercase tracking-meta text-white/40"
          aria-hidden
        >
          {open ? "−" : "+"}
        </span>
      </button>
      {!open ? (
        // Kapalı durum: file adı tek satır özet — operatör hangi
        // file'a baktığını sabit tutar; full path açıldığında görünür.
        <div
          className="mt-1 truncate font-mono text-[11px] text-white/50"
          title={source.fileName}
          data-testid="info-rail-local-summary"
        >
          {source.fileName}
        </div>
      ) : (
        <dl
          id="info-rail-local-content"
          className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs"
          data-testid="info-rail-local-detail"
        >
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
          {hint ? (
            <>
              <dt className="text-white/40">Hint</dt>
              <dd className="text-white/60">{hint}</dd>
            </>
          ) : null}
        </dl>
      )}
    </section>
  );
}

function DesignSourceSection({
  source,
  referenceId,
}: {
  source: Extract<
    NonNullable<ReviewQueueItem["source"]>,
    { kind: "design" }
  >;
  referenceId: string | null;
}) {
  // IA Phase 19 — Variation section is collapsible (CLAUDE.md
  // Madde Q — information density). Default closed; operator
  // expands it when curious about lineage. Saves vertical space
  // so Evaluation + checklist sit above the fold.
  const [open, setOpen] = useState(false);
  const transparency = transparencyDescriptor(source.mimeType, source.hasAlpha);
  return (
    <section data-testid="info-rail-design">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
        data-testid="info-rail-design-toggle"
      >
        <SectionTitle>Variation</SectionTitle>
        <span
          className="font-mono text-[10px] uppercase tracking-meta text-white/40"
          aria-hidden
        >
          {open ? "−" : "+"}
        </span>
      </button>
      {!open ? (
        <div
          className="mt-1 font-mono text-[11px] text-white/50"
          data-testid="info-rail-design-summary"
        >
          {source.productTypeKey ?? "—"} ·{" "}
          {source.referenceShortId
            ? `ref-${source.referenceShortId}`
            : "no ref"}{" "}
          · {transparency.format}
        </div>
      ) : null}
      {open ? (
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
      </dl>
      ) : null}
      {open && referenceId ? (
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
