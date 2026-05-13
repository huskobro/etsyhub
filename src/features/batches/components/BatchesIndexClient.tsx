/* eslint-disable no-restricted-syntax */
// A2 Batches index — text-[13.5px] yarı-piksel batch row title (Kivasy v4
// row typography sabitlerinden, Tailwind text-sm 13 / text-base 14 arası
// token tier yok). Whitelisted in scripts/check-tokens.ts.
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, Plus, RotateCw, ChevronRight, Info, X, ImageOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { FilterChip } from "@/components/ui/FilterChip";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { UserAssetThumb } from "@/components/ui/UserAssetThumb";
import { AppTopbar } from "@/components/ui/AppTopbar";
import {
  DensityToggle,
  type Density,
} from "@/components/ui/DensityToggle";
import {
  type BatchAggregateStatus,
  BATCH_STATUS_LABEL,
  batchAggregateStatus,
  batchStatusTone,
} from "@/features/batches/state-helpers";
import type { RecentBatchSummary } from "@/server/services/midjourney/batches";

/**
 * BatchesIndexClient — Kivasy A2 Batches index.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a1-a2.jsx
 * → A2BatchesIndex.
 *
 * URL state contract:
 *   ?status=running|succeeded|failed|queued|all
 *   ?q=...   (search by batch id / template / prompt preview)
 */

const STATUS_LABELS: Record<string, string> = {
  all: "All",
  running: "Active",
  succeeded: "Succeeded",
  failed: "Failed",
  queued: "Queued",
};

interface BatchesIndexClientProps {
  batches: RecentBatchSummary[];
  initialDensity?: Density;
  /**
   * Batch-first Phase 2 — opsiyonel reference scope.
   * Server tarafından `?referenceId=...` query param'ından resolve edilir.
   * Verilirse list zaten filtrelidir; UI yalnız chip render eder (clear
   * etmek için `/batches` linkine düşer).
   */
  referenceFilter?: {
    id: string;
    label: string | null;
    found: boolean;
  } | null;
}

function relativeTime(date: Date): string {
  const ms = Date.now() - date.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function BatchesIndexClient({
  batches,
  initialDensity = "comfortable",
  referenceFilter = null,
}: BatchesIndexClientProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [density, setDensity] = useState<Density>(initialDensity);
  const [keyword, setKeyword] = useState(params.get("q") ?? "");
  const currentStatus = (params.get("status") ?? "all") as BatchAggregateStatus | "all";
  // R11.7 fix — `?action=new` middleware redirect target'ı (legacy
  // /admin/midjourney/batch-run'dan gelen). A6 modal reference asset
  // gerektirdiği için standalone tetiklenemiyor; banner ile operatöre
  // doğru entry point'i (Library → asset seç → Create Variations) söyle.
  const startBatchHint = params.get("action") === "new";

  function dismissStartBatchHint() {
    pushWith((sp) => sp.delete("action"));
  }

  function pushWith(updater: (sp: URLSearchParams) => void) {
    const sp = new URLSearchParams(params.toString());
    updater(sp);
    const qs = sp.toString();
    startTransition(() => {
      router.push(qs ? `/batches?${qs}` : "/batches");
    });
  }

  function cycleStatus() {
    const order = ["all", "running", "succeeded", "failed", "queued"];
    const next = order[(order.indexOf(currentStatus) + 1) % order.length] ?? "all";
    pushWith((sp) => {
      if (next === "all") sp.delete("status");
      else sp.set("status", next);
    });
  }

  function applyKeyword(e: React.FormEvent) {
    e.preventDefault();
    pushWith((sp) => {
      const q = keyword.trim();
      if (q.length === 0) sp.delete("q");
      else sp.set("q", q);
    });
  }

  // Client-side filtering (the listRecentBatches service returns ~30 most
  // recent — small cardinality, doing the slice here keeps the surface
  // simple. Server-side filter migration is a rollout-3.5 if cardinality
  // grows.)
  const enriched = batches.map((b) => ({
    ...b,
    aggregateStatus: batchAggregateStatus({
      total: b.counts.total,
      queued: b.counts.queued,
      running: b.counts.running,
      completed: b.counts.completed,
      failed: b.counts.failed,
      cancelled: b.counts.cancelled,
      awaiting: b.counts.awaiting,
    }),
  }));

  const filtered = enriched.filter((b) => {
    if (currentStatus !== "all" && b.aggregateStatus !== currentStatus)
      return false;
    if (keyword.trim().length > 0) {
      const q = keyword.trim().toLowerCase();
      if (
        !b.batchId.toLowerCase().includes(q) &&
        !(b.templateId ?? "").toLowerCase().includes(q) &&
        !(b.promptTemplatePreview ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const totalLabel = `${filtered.length} of ${batches.length}`;
  const runningCount = enriched.filter(
    (b) => b.aggregateStatus === "running",
  ).length;

  return (
    <div className="-m-6 flex h-screen flex-col" data-testid="batches-page">
      <AppTopbar
        title="Batches"
        subtitle={`${runningCount} RUNNING · ${batches.length} LAST 30`}
        actions={
          <>
            <Link
              href="/library"
              data-size="sm"
              className="k-btn k-btn--secondary"
            >
              <RotateCw className="h-3 w-3" aria-hidden />
              Retry-failed-only
            </Link>
            <Link
              href="/references?intent=start-batch"
              data-size="sm"
              className="k-btn k-btn--primary"
              data-testid="batches-new-cta"
            >
              <Plus className="h-3 w-3" aria-hidden />
              Start Batch
            </Link>
          </>
        }
      />

      {/* Phase 42 — Batch-first architecture. Start-batch entry now
          routes to References (curated Pool), NOT Library (generated
          outputs). Variation batches anchor on a Reference asset; the
          v7 d2a/d2b batch-config surface lives at /references/[id]/
          variations (provider + count + aspect + prompt template +
          generate → real batch row created). */}
      {startBatchHint ? (
        <div
          className="flex items-start gap-3 border-b border-line bg-k-orange-soft/40 px-6 py-3"
          data-testid="batches-start-hint"
          role="status"
        >
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-k-orange-ink" aria-hidden />
          <div className="flex-1">
            <div className="text-[13px] font-medium text-ink">
              Pick references and stage them in the draft batch
            </div>
            <p className="mt-0.5 text-[12.5px] text-ink-2">
              Variation batches anchor on references. Open References, hover
              a card, click{" "}
              <span className="font-medium text-ink">Add to Draft</span>. The
              draft panel on the right opens automatically — finish staging,
              then click{" "}
              <span className="font-medium text-ink">Create Similar</span> to
              compose the batch (provider, mode, count, aspect ratio).
            </p>
            <Link
              href="/references?intent=start-batch"
              className="mt-2 inline-flex h-7 items-center gap-1 rounded-md border border-line bg-paper px-2 text-[11.5px] font-medium text-ink hover:border-line-strong"
              data-testid="batches-start-hint-cta"
            >
              Open References
              <ChevronRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <button
            type="button"
            onClick={dismissStartBatchHint}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-3 hover:bg-ink/5 hover:text-ink"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bg px-6 py-3">
        <form onSubmit={applyKeyword} className="relative flex max-w-md flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-ink-3" aria-hidden />
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search batches by id, template…"
            disabled={pending}
            className="h-8 w-full rounded-md border border-line bg-paper pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft disabled:opacity-50"
            data-testid="batches-search-input"
          />
        </form>
        <FilterChip
          active={currentStatus !== "all"}
          caret
          onClick={cycleStatus}
        >
          {STATUS_LABELS[currentStatus] ?? "Status"}
        </FilterChip>
        {/* Batch-first Phase 2 — reference scope filter chip. Server-side
         * filter; clear etmek için root /batches'a düşer. */}
        {referenceFilter ? (
          <Link
            href="/batches"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-info bg-info-soft px-2.5 text-xs font-medium text-info hover:bg-info-soft/70"
            data-testid="batches-reference-filter-chip"
            title="Clear reference filter"
          >
            <span className="font-mono uppercase tracking-meta text-[10.5px]">
              REF{" "}
              {referenceFilter.found
                ? referenceFilter.label
                  ? referenceFilter.label.slice(0, 24)
                  : referenceFilter.id.slice(0, 8).toUpperCase()
                : `${referenceFilter.id.slice(0, 8).toUpperCase()} · not found`}
            </span>
            <X className="h-3 w-3" aria-hidden />
          </Link>
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-meta text-ink-3">
            {totalLabel}
          </span>
          <DensityToggle
            surfaceKey="batches"
            defaultValue={density}
            onChange={setDensity}
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {filtered.length === 0 ? (
          <div
            className="rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center"
            data-testid="batches-empty"
          >
            <h3 className="text-base font-semibold text-ink">
              {batches.length === 0
                ? "No batches yet"
                : "No batches match these filters"}
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              {batches.length === 0
                ? "Start your first production batch — use Start Batch above to pick a reference."
                : "Clear filters or search by batch id / template."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-line bg-paper">
            <table className="w-full" data-testid="batches-table">
              <thead className="border-b border-line-soft bg-k-bg-2/40">
                <tr>
                  <BatchTH className="w-12" />
                  <BatchTH>Batch</BatchTH>
                  <BatchTH>Source</BatchTH>
                  <BatchTH className="w-32">Progress</BatchTH>
                  <BatchTH className="w-32">Status</BatchTH>
                  <BatchTH className="w-24">Started</BatchTH>
                  <BatchTH className="w-12" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const tone = batchStatusTone(b.aggregateStatus);
                  const progressPct =
                    b.counts.total > 0
                      ? Math.round((b.counts.completed / b.counts.total) * 100)
                      : 0;
                  return (
                    <tr
                      key={b.batchId}
                      className={cn(
                        "border-b border-line-soft last:border-b-0 transition-colors hover:bg-k-bg-2/40",
                        density === "dense" ? "" : "",
                      )}
                      data-testid="batches-row"
                    >
                      <BatchTD className={density === "dense" ? "py-2" : "py-3"}>
                        <Link
                          href={`/batches/${b.batchId}`}
                          className="block"
                          aria-label={`Open batch ${b.batchId.slice(0, 8)}`}
                        >
                          {b.representativeAssetId ? (
                            <div
                              className={cn(
                                "overflow-hidden rounded-md border border-line-soft bg-k-bg-2",
                                density === "dense" ? "h-7 w-7" : "h-9 w-9",
                              )}
                            >
                              <UserAssetThumb
                                assetId={b.representativeAssetId}
                                alt={`Batch ${b.batchId.slice(0, 8)} preview`}
                              />
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "flex items-center justify-center rounded-md border border-dashed border-line-soft bg-k-bg-2 text-ink-4",
                                density === "dense" ? "h-7 w-7" : "h-9 w-9",
                              )}
                              title="No representative asset yet"
                            >
                              <ImageOff
                                className={cn(
                                  density === "dense" ? "h-3 w-3" : "h-3.5 w-3.5",
                                )}
                                aria-hidden
                              />
                            </div>
                          )}
                        </Link>
                      </BatchTD>
                      <BatchTD className={density === "dense" ? "py-2" : "py-3"}>
                        <Link
                          href={`/batches/${b.batchId}`}
                          className="block text-[13.5px] font-medium text-ink hover:text-k-orange"
                        >
                          batch_{b.batchId.slice(0, 12)}
                        </Link>
                        {b.templateId ? (
                          <div className="mt-0.5 font-mono text-xs text-ink-3">
                            template {b.templateId.slice(0, 8)}
                          </div>
                        ) : null}
                      </BatchTD>
                      <BatchTD className={density === "dense" ? "py-2" : "py-3"}>
                        {b.promptTemplatePreview ? (
                          <span
                            className="block max-w-md truncate text-xs text-ink-2"
                            title={b.promptTemplatePreview}
                          >
                            {b.promptTemplatePreview}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-3">—</span>
                        )}
                        {/* Batch-first Phase 2 — reference lineage chip.
                         * Job.metadata.referenceId üzerinden batch'i üreten
                         * reference scope'una bağlantı. Filter aktifken
                         * render edilmez (zaten chip toolbar'da görünüyor). */}
                        {b.referenceId && !referenceFilter ? (
                          <Link
                            href={`/batches?referenceId=${b.referenceId}`}
                            className="mt-0.5 inline-block font-mono text-[10.5px] uppercase tracking-meta text-info underline-offset-2 hover:underline"
                            data-testid="batches-row-reference-lineage"
                            title={`Filter batches from this reference (${b.referenceId})`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            ↗ REF {b.referenceId.slice(0, 8).toUpperCase()}
                          </Link>
                        ) : null}
                      </BatchTD>
                      <BatchTD className={density === "dense" ? "py-2" : "py-3"}>
                        <div className="flex items-center gap-2">
                          <ProgressBar
                            value={progressPct}
                            tone={
                              b.aggregateStatus === "running"
                                ? "orange"
                                : b.aggregateStatus === "failed"
                                  ? "danger"
                                  : b.aggregateStatus === "succeeded"
                                    ? "success"
                                    : "orange"
                            }
                            className="flex-1"
                            ariaLabel={`Batch progress ${progressPct}%`}
                          />
                          <span className="font-mono text-xs tabular-nums text-ink-3">
                            {b.counts.completed}/{b.counts.total}
                          </span>
                        </div>
                      </BatchTD>
                      <BatchTD className={density === "dense" ? "py-2" : "py-3"}>
                        <Badge tone={tone} dot>
                          {BATCH_STATUS_LABEL[b.aggregateStatus]}
                        </Badge>
                        {/* Batch-first Phase 2 — review breakdown caption.
                         * Operator gating signal Batches grid'inden okunsun;
                         * detail'e girmeden "kaç undecided?" sorusu çözülür. */}
                        {b.reviewCounts.total > 0 ? (
                          <div
                            className="mt-1 font-mono text-[10.5px] uppercase tracking-meta text-ink-3"
                            data-testid="batches-row-review-counts"
                          >
                            {b.reviewCounts.undecided > 0 ? (
                              <span className="text-k-orange-ink">
                                {b.reviewCounts.undecided} undecided
                              </span>
                            ) : b.reviewCounts.kept > 0 ? (
                              <span className="text-success">
                                {b.reviewCounts.kept} kept
                              </span>
                            ) : (
                              // Phase 9 — empty state neutral "—" (sayı
                              // değil). "0 kept" operatöre yanıltıcı
                              // hissettiriyordu (sıfır sonuç vs henüz
                              // karar yok).
                              <span className="text-ink-3">—</span>
                            )}
                          </div>
                        ) : null}
                      </BatchTD>
                      <BatchTD className={density === "dense" ? "py-2" : "py-3"}>
                        <span className="font-mono text-xs tabular-nums text-ink-3">
                          {relativeTime(b.createdAt)}
                        </span>
                      </BatchTD>
                      <BatchTD className={density === "dense" ? "py-2" : "py-3"}>
                        <Link
                          href={`/batches/${b.batchId}`}
                          aria-label="Open batch"
                        >
                          <ChevronRight
                            className="h-4 w-4 text-ink-3"
                            aria-hidden
                          />
                        </Link>
                      </BatchTD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BatchTH({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-left font-mono text-xs font-medium uppercase tracking-meta text-ink-3",
        className,
      )}
    >
      {children}
    </th>
  );
}

function BatchTD({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-3 align-middle", className)}>{children}</td>;
}
