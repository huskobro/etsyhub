"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Eye,
  Layers,
  RefreshCw,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import {
  type JobState,
  JOB_STATE_LABEL_SHORT,
  jobStateTone,
  batchAggregateStatus,
  BATCH_STATUS_LABEL,
  batchStatusTone,
} from "@/features/batches/state-helpers";
import type { BatchSummary } from "@/server/services/midjourney/batches";

/**
 * BatchDetailClient — Kivasy A3 Batch detail.
 *
 * Batch-first Phase 1: stage-aware CTA block (CLAUDE.md Madde AA).
 *
 * Stage derivation (5 distinct values — no overlap between derive and render):
 *   running         → batch still generating
 *   review-pending  → generation done, undecided items remain (or no review yet)
 *   selection-ready → review complete, kept > 0, selection set exists
 *   kept-no-selection → review complete, kept > 0, no selection set yet
 *   no-kept         → review complete, kept = 0
 *
 * BatchStageCTA receives the resolved stage and renders only — no conditional
 * re-derivation inside the component.
 */

export interface ExistingSelectionSet {
  id: string;
  name: string;
}

/**
 * Batch-first Phase 2 — source reference back-link target.
 * Server tarafından user ownership + deletedAt=null kontrolü ile resolve
 * edilir. null → reference yok, silinmiş, veya batch reference-less
 * (retry, legacy); UI back-link render etmez.
 */
export interface SourceReference {
  id: string;
  label: string | null;
}

interface BatchDetailClientProps {
  summary: BatchSummary;
  existingSelectionSet: ExistingSelectionSet | null;
  sourceReference?: SourceReference | null;
}

type TabId = "overview" | "items" | "logs" | "costs";

type BatchStage =
  | "running"
  | "review-pending"
  | "selection-ready"
  | "kept-no-selection"
  | "no-kept";

function deriveBatchStage(
  summary: BatchSummary,
  existingSelectionSet: ExistingSelectionSet | null,
): BatchStage {
  const status = batchAggregateStatus(summary.counts);
  if (status === "running" || status === "queued") return "running";

  // Generation complete — check review state
  if (
    summary.reviewCounts.total === 0 ||
    summary.reviewCounts.undecided > 0
  ) {
    return "review-pending";
  }

  // Review complete (undecided = 0)
  if (summary.reviewCounts.kept === 0) return "no-kept";
  if (existingSelectionSet) return "selection-ready";
  return "kept-no-selection";
}

export function BatchDetailClient({
  summary,
  existingSelectionSet,
  sourceReference = null,
}: BatchDetailClientProps) {
  const [tab, setTab] = useState<TabId>("overview");

  const status = batchAggregateStatus(summary.counts);
  const statusTone = batchStatusTone(status);
  const statusLabel = BATCH_STATUS_LABEL[status];

  const total = summary.counts.total;
  const decided = summary.counts.completed + summary.counts.failed;
  const progressPct = total > 0 ? Math.round((decided / total) * 100) : 0;
  const succeededPct =
    total > 0 ? Math.round((summary.counts.completed / total) * 100) : 0;

  const stage = deriveBatchStage(summary, existingSelectionSet);

  const tabs: TabItem[] = [
    { id: "overview", label: "Overview" },
    { id: "items", label: "Items", count: total },
    { id: "logs", label: "Logs" },
    { id: "costs", label: "Costs" },
  ];

  return (
    <div className="-m-6 flex h-screen flex-col" data-testid="batch-detail-page">
      {/* R11.14.7 — h1 17→24px parity (matches AppTopbar canon). */}
      <header className="flex h-16 flex-shrink-0 items-center gap-4 border-b border-line bg-bg pl-6 pr-5">
        <Link
          href="/batches"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-2 hover:border-line-strong hover:text-ink"
          aria-label="Back to batches"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3">
            <h1 className="truncate k-display text-[24px] font-semibold leading-none tracking-tight text-ink">
              batch_{summary.batchId.slice(0, 12)}
            </h1>
            <Badge tone={statusTone} dot>
              {statusLabel}
            </Badge>
            {summary.retryOfBatchId ? (
              <Link
                href={`/batches/${summary.retryOfBatchId}`}
                className="inline-flex items-center gap-1 rounded border border-warning bg-warning-soft px-1.5 py-0.5 font-mono text-xs text-warning hover:underline"
              >
                <RotateCw className="h-3 w-3" aria-hidden />
                Retry of {summary.retryOfBatchId.slice(0, 8)}
              </Link>
            ) : null}
            <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              {summary.createdAt.toISOString().slice(0, 19).replace("T", " ")}
              {summary.templateId ? (
                <>
                  {" · "}
                  <Link
                    href={`/templates?templateId=${summary.templateId}`}
                    className="text-info underline-offset-2 hover:underline"
                  >
                    TEMPLATE {summary.templateId.slice(0, 8).toUpperCase()}
                  </Link>
                </>
              ) : null}
            </span>
            {/* Batch-first Phase 2 — source reference back-link.
             * Kullanıcı batch detail'den reference scope'una geri dönebilsin
             * (lineer akış geri yönü). sourceReference null ise (legacy
             * batch, retry, soft-deleted reference) render edilmez. */}
            {sourceReference ? (
              <Link
                href={`/batches?referenceId=${sourceReference.id}`}
                className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-meta text-info underline-offset-2 hover:underline"
                title={
                  sourceReference.label
                    ? `From reference: ${sourceReference.label}`
                    : `From reference ${sourceReference.id}`
                }
                data-testid="batch-detail-source-reference"
              >
                ↩ FROM REF {sourceReference.id.slice(0, 8).toUpperCase()}
              </Link>
            ) : null}
          </div>
        </div>
        {/* Batch-first Phase 1 — stage-aware CTA (CLAUDE.md Madde AA). */}
        <BatchStageCTA
          summary={summary}
          stage={stage}
          existingSelectionSet={existingSelectionSet}
        />
      </header>

      {/* Summary strip — A3 Pattern */}
      <div className="grid grid-cols-2 gap-4 border-b border-line bg-bg px-6 py-4 md:grid-cols-5">
        <SummaryTile
          label="Source"
          value={
            summary.templateId
              ? `template ${summary.templateId.slice(0, 8)}`
              : summary.promptTemplate
                ? "inline prompt"
                : "—"
          }
        />
        <SummaryTile
          label="Type"
          value={`Variation · ${summary.batchTotal} requested`}
        />
        <div>
          <div className="font-mono text-xs uppercase tracking-meta text-ink-3">
            Progress
          </div>
          <div className="mt-2 flex items-center gap-2">
            <ProgressBar
              value={progressPct}
              tone={
                status === "running"
                  ? "orange"
                  : status === "failed"
                    ? "danger"
                    : "success"
              }
              className="flex-1"
            />
            <span className="font-mono text-xs tabular-nums text-ink-2">
              {decided}/{total}
            </span>
          </div>
        </div>
        <SummaryTile
          label="Success rate"
          value={total > 0 ? `${succeededPct}%` : "—"}
        />
        <SummaryTile
          label="Items"
          value={`${summary.counts.completed} kept · ${summary.counts.failed} failed`}
        />
      </div>

      {/* Tabs */}
      <div className="px-6">
        <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as TabId)} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === "overview" ? <OverviewTab summary={summary} /> : null}
        {tab === "items" ? <ItemsTab summary={summary} /> : null}
        {tab === "logs" ? (
          <EmptyTabPlaceholder
            title="Logs"
            blurb="Per-job state transitions + bridge errors. Wires up after the unified job-stream feed lands."
          />
        ) : null}
        {tab === "costs" ? (
          <EmptyTabPlaceholder
            title="Costs"
            blurb="Per-job and per-batch cost breakdown. Pulls from CostUsage; UI lands with the AI Providers pane."
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Batch-first Phase 1 — stage-aware CTA block.
 *
 * Receives a pre-resolved `stage` value from `deriveBatchStage`.
 * Does NOT re-derive the stage — pure render only.
 */
function BatchStageCTA({
  summary,
  stage,
  existingSelectionSet,
}: {
  summary: BatchSummary;
  stage: BatchStage;
  existingSelectionSet: ExistingSelectionSet | null;
}) {
  if (stage === "running") {
    return (
      <div
        className="flex flex-col items-end gap-0.5"
        data-testid="batch-stage-cta"
        data-stage="running"
      >
        <div className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink-3">
          <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
          Generating…
        </div>
        {summary.counts.failed > 0 ? (
          <Link
            href={`/batches/${summary.batchId}?action=retry-failed`}
            className="font-mono text-xs uppercase tracking-meta text-danger underline-offset-2 hover:underline"
          >
            {summary.counts.failed} failed · retry
          </Link>
        ) : (
          <span className="font-mono text-xs uppercase tracking-meta text-ink-3">
            {summary.counts.completed}/{summary.counts.total} done
          </span>
        )}
      </div>
    );
  }

  if (stage === "review-pending") {
    return (
      <div
        className="flex flex-col items-end gap-0.5"
        data-testid="batch-stage-cta"
        data-stage="review-pending"
      >
        <Link
          href={`/review?batch=${summary.batchId}`}
          data-size="sm"
          className="k-btn k-btn--primary"
          data-testid="batch-detail-open-review"
        >
          <Eye className="h-3 w-3" aria-hidden />
          Open Review
        </Link>
        {summary.reviewCounts.total > 0 ? (
          <span
            className="font-mono text-xs uppercase tracking-meta text-k-orange-bright"
            data-testid="batch-detail-review-hint"
            data-state="pending"
          >
            {summary.reviewCounts.undecided} undecided · decide before next stage
          </span>
        ) : (
          <span
            className="font-mono text-xs uppercase tracking-meta text-ink-3"
            data-testid="batch-detail-review-hint"
            data-state="empty"
          >
            Review every item before proceeding
          </span>
        )}
        {summary.counts.failed > 0 ? (
          <Link
            href={`/batches/${summary.batchId}?action=retry-failed`}
            className="font-mono text-xs uppercase tracking-meta text-ink-3 underline-offset-2 hover:underline"
          >
            <RotateCw className="inline h-3 w-3" aria-hidden />{" "}
            Retry {summary.counts.failed} failed
          </Link>
        ) : null}
      </div>
    );
  }

  if (stage === "no-kept") {
    return (
      <div
        className="flex flex-col items-end gap-0.5"
        data-testid="batch-stage-cta"
        data-stage="no-kept"
      >
        <Link href="/batches" data-size="sm" className="k-btn k-btn--primary">
          <RefreshCw className="h-3 w-3" aria-hidden />
          New Batch
        </Link>
        <span
          className="font-mono text-xs uppercase tracking-meta text-ink-3"
          data-testid="batch-detail-review-hint"
          data-state="no-kept"
        >
          No items kept · start a new batch
        </span>
      </div>
    );
  }

  if (stage === "selection-ready") {
    // existingSelectionSet is guaranteed non-null here by deriveBatchStage
    return (
      <div
        className="flex flex-col items-end gap-0.5"
        data-testid="batch-stage-cta"
        data-stage="selection-ready"
      >
        <Link
          href={`/selections/${existingSelectionSet!.id}`}
          data-size="sm"
          className="k-btn k-btn--primary"
          data-testid="batch-detail-continue-selection"
        >
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Continue in Selection
        </Link>
        <span
          className="font-mono text-xs uppercase tracking-meta text-ink-3"
          data-testid="batch-detail-review-hint"
          data-state="complete"
        >
          {summary.reviewCounts.kept} kept · selection started
        </span>
      </div>
    );
  }

  // stage === "kept-no-selection": review complete, kept > 0, no set yet
  return (
    <div
      className="flex flex-col items-end gap-0.5"
      data-testid="batch-stage-cta"
      data-stage="kept-no-selection"
    >
      <Link
        href={`/review?batch=${summary.batchId}`}
        data-size="sm"
        className="k-btn k-btn--primary"
        data-testid="batch-detail-open-review"
      >
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        Open Review
      </Link>
      <span
        className="font-mono text-xs uppercase tracking-meta text-success"
        data-testid="batch-detail-review-hint"
        data-state="complete"
      >
        Review complete · {summary.reviewCounts.kept} kept
      </span>
    </div>
  );
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-meta text-ink-3">
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-medium text-ink">{value}</div>
    </div>
  );
}

function OverviewTab({ summary }: { summary: BatchSummary }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      <div className="md:col-span-2">
        <h3 className="text-sm font-semibold text-ink">Prompt template</h3>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-k-bg-2 px-3 py-2 font-mono text-xs leading-relaxed text-ink-2">
          {summary.promptTemplate ?? "(no prompt template snapshot)"}
        </pre>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-ink">State breakdown</h3>
        <ul className="mt-2 space-y-1.5 text-xs">
          <BreakdownRow label="Total" value={summary.counts.total} />
          <BreakdownRow label="Queued" value={summary.counts.queued} tone="neutral" />
          <BreakdownRow label="Running" value={summary.counts.running} tone="warning" />
          <BreakdownRow label="Awaiting" value={summary.counts.awaiting} tone="warning" />
          <BreakdownRow label="Succeeded" value={summary.counts.completed} tone="success" />
          <BreakdownRow label="Failed" value={summary.counts.failed} tone="danger" />
          <BreakdownRow label="Cancelled" value={summary.counts.cancelled} tone="neutral" />
        </ul>
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "danger" | "neutral";
}) {
  const muted = value === 0;
  return (
    <li className="flex items-center justify-between gap-3">
      <span className={cn("text-ink-2", muted && "text-ink-3")}>{label}</span>
      {muted ? (
        <span className="font-mono text-xs tabular-nums text-ink-3">—</span>
      ) : (
        <Badge tone={tone}>{value}</Badge>
      )}
    </li>
  );
}

function ItemsTab({ summary }: { summary: BatchSummary }) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-paper">
      <table className="w-full" data-testid="batch-items-table">
        <thead className="border-b border-line bg-k-bg-2/40">
          <tr>
            <ItemTH className="w-12">#</ItemTH>
            <ItemTH>Status</ItemTH>
            <ItemTH>Expanded prompt</ItemTH>
            <ItemTH className="w-32">Variables</ItemTH>
            <ItemTH className="w-20">Assets</ItemTH>
            <ItemTH className="w-12" />
          </tr>
        </thead>
        <tbody>
          {summary.jobs.map((j) => (
            <tr
              key={j.jobId}
              className="border-b border-line-soft last:border-b-0 hover:bg-k-bg-2/40"
            >
              <ItemTD>
                <code className="font-mono text-xs tabular-nums text-ink-3">
                  {j.batchIndex}
                </code>
              </ItemTD>
              <ItemTD>
                <Badge tone={jobStateTone(j.state)} dot>
                  {j.state
                    ? JOB_STATE_LABEL_SHORT[j.state as JobState] ?? j.state
                    : "—"}
                </Badge>
                {j.blockReason ? (
                  <div
                    className="mt-1 text-xs text-danger"
                    title={j.failedReason ?? undefined}
                  >
                    {j.blockReason}
                  </div>
                ) : null}
              </ItemTD>
              <ItemTD>
                {j.expandedPrompt ? (
                  <span
                    className="block max-w-md truncate font-mono text-xs text-ink-2"
                    title={j.expandedPrompt}
                  >
                    {j.expandedPrompt}
                  </span>
                ) : (
                  <span className="text-xs text-ink-3">—</span>
                )}
              </ItemTD>
              <ItemTD>
                {j.variables ? (
                  <span className="font-mono text-xs text-ink-3">
                    {Object.keys(j.variables).length} vars
                  </span>
                ) : (
                  <span className="text-xs text-ink-3">—</span>
                )}
              </ItemTD>
              <ItemTD>
                {j.assetCount > 0 ? (
                  <Badge tone="success">{j.assetCount}</Badge>
                ) : (
                  <span className="text-xs text-ink-3">—</span>
                )}
              </ItemTD>
              <ItemTD>
                {j.midjourneyJobId ? (
                  <Link
                    href={`/library?days=all&parentAssetId=`}
                    aria-label="Open in Library"
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-3 hover:text-ink"
                  >
                    <Layers className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                ) : null}
              </ItemTD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemTH({
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

function ItemTD({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-3 py-3 align-top", className)}>{children}</td>;
}

function EmptyTabPlaceholder({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-text-muted">{blurb}</p>
      <ChevronRight className="mx-auto mt-3 h-3 w-3 text-ink-3" aria-hidden />
    </div>
  );
}
