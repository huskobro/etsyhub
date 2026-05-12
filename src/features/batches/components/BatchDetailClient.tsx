"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  Layers,
  RefreshCw,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { UserAssetThumb } from "@/components/ui/UserAssetThumb";
import {
  type JobState,
  JOB_STATE_LABEL_SHORT,
  jobStateTone,
  batchAggregateStatus,
  BATCH_STATUS_LABEL,
  batchStatusTone,
} from "@/features/batches/state-helpers";
import { useCreateSelectionFromBatch } from "@/features/batches/mutations/use-create-selection-from-batch";
import type {
  BatchSummary,
  BatchPipeline,
} from "@/server/services/midjourney/batches";

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
 *
 * Phase 9 fit-and-finish — `assetId` eklendi (A3 canonical summary strip
 * Reference tile'ında thumbnail render için).
 */
export interface SourceReference {
  id: string;
  label: string | null;
  assetId: string | null;
}

interface BatchDetailClientProps {
  summary: BatchSummary;
  existingSelectionSet: ExistingSelectionSet | null;
  sourceReference?: SourceReference | null;
}

type TabId = "overview" | "items" | "parameters" | "logs" | "costs";

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

  // Batch-first Phase 6 — tab order canonical v4 A3 ile hizalandı:
  // Items → Parameters → Logs → Costs (canonical). Overview tab'ı
  // implementation-level eklenmişti; Phase 6'da Items'ın önüne taşındı
  // (default tab) ve Parameters tab'ı eklendi (placeholder; A3 spec
  // gereği). Operatör batch summary'yi varsayılan görür, sonra
  // Items/Parameters/Logs/Costs sıralamasıyla derinleşir.
  const tabs: TabItem[] = [
    { id: "overview", label: "Overview" },
    { id: "items", label: "Items", count: total },
    { id: "parameters", label: "Parameters" },
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
            {/* Batch-first Phase 7 — provider-first chip.
             * Kullanıcı-facing dilde provider adı görünür ("Midjourney",
             * "Kie · GPT Image 1.5"). Phase 5/6'daki "MANUAL/AUTO"
             * dil katmanı kaldırıldı; operatör artık "üretim biçimi"
             * değil "üretim sağlayıcısı" görür (provider-first).
             * data-pipeline attribute audit/debug için literal değeri
             * korur. */}
            <span
              className="inline-flex items-center rounded-sm border border-line bg-paper px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-2"
              data-testid="batch-detail-provider-chip"
              data-pipeline={summary.pipeline}
              data-provider-id={summary.providerId ?? "unknown"}
              title={
                summary.providerLabel
                  ? `Provider: ${summary.providerLabel}`
                  : "Provider unknown"
              }
            >
              <span className="text-ink-3">Provider:&nbsp;</span>
              <span className="font-medium text-ink-2">
                {summary.providerLabel ?? "—"}
              </span>
            </span>
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

      {/* Summary strip — A3 Pattern.
       * Phase 9 fit-and-finish — "Source" tile yerine "Reference" tile
       * (canonical v4 A3'te de Reference + thumbnail). Reference yoksa
       * "Source" fallback (template/inline prompt) gösterilir; eski
       * surfaceı kaybetmiyoruz. */}
      <div className="grid grid-cols-2 gap-4 border-b border-line bg-bg px-6 py-4 md:grid-cols-5">
        {sourceReference ? (
          <div data-testid="batch-summary-reference-tile">
            <div className="font-mono text-xs uppercase tracking-meta text-ink-3">
              Reference
            </div>
            <div className="mt-2 flex items-center gap-2">
              {sourceReference.assetId ? (
                <Link
                  href={`/batches?referenceId=${sourceReference.id}`}
                  className="block h-9 w-9 flex-shrink-0 overflow-hidden rounded border border-line"
                  title={
                    sourceReference.label
                      ? `From reference: ${sourceReference.label}`
                      : `From reference ${sourceReference.id}`
                  }
                >
                  <UserAssetThumb
                    assetId={sourceReference.assetId}
                    alt={sourceReference.label ?? "Reference"}
                    square
                    className="!aspect-square"
                  />
                </Link>
              ) : (
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded border border-line bg-k-bg-2 text-ink-3">
                  <Layers className="h-3.5 w-3.5" aria-hidden />
                </div>
              )}
              <span className="truncate text-sm font-medium text-ink">
                {sourceReference.label ??
                  `ref_${sourceReference.id.slice(0, 8)}`}
              </span>
            </div>
          </div>
        ) : (
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
        )}
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
        {tab === "parameters" ? <ParametersTab summary={summary} /> : null}
        {tab === "logs" ? <LogsTab summary={summary} /> : null}
        {tab === "costs" ? (
          <EmptyTabPlaceholder
            title="Costs"
            blurb="Cost breakdown per item + batch total. Coming soon — provider usage aggregation lands with the AI Providers pane."
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
    // existingSelectionSet is guaranteed non-null here by deriveBatchStage.
    // Batch-first Phase 3: name + kept item count bilgisi CTA caption'ında
    // operator'a görünür ("which selection am I continuing?" sorusu).
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
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
        <span
          className="max-w-[280px] truncate font-mono text-xs uppercase tracking-meta text-success"
          data-testid="batch-detail-review-hint"
          data-state="complete"
          title={existingSelectionSet!.name}
        >
          ↗ {existingSelectionSet!.name}
        </span>
        <span
          className="font-mono text-xs uppercase tracking-meta text-ink-3"
          data-testid="batch-detail-selection-hint"
        >
          {summary.reviewCounts.kept} kept · selection started
        </span>
      </div>
    );
  }

  // stage === "kept-no-selection": review complete, kept > 0, no set yet.
  // Batch-first Phase 3: doğrudan Create Selection action — operatör'ü
  // review'a geri göndermek yerine kept items'tan SelectionSet yaratır
  // (downstream gate: CLAUDE.md Madde V'' — operator-only kept zinciri).
  return (
    <KeptNoSelectionCTA
      batchId={summary.batchId}
      keptCount={summary.reviewCounts.kept}
    />
  );
}

/**
 * Batch-first Phase 3 — kept-no-selection stage'inin client-side CTA'sı.
 * Server action: POST /api/batches/[batchId]/create-selection.
 * Success → router.push(/selections/{setId}).
 * Error → inline caption (operator-actionable mesaj).
 */
function KeptNoSelectionCTA({
  batchId,
  keptCount,
}: {
  batchId: string;
  keptCount: number;
}) {
  const router = useRouter();
  const create = useCreateSelectionFromBatch();

  async function onCreate() {
    try {
      const result = await create.mutateAsync(batchId);
      router.push(`/selections/${result.setId}`);
    } catch {
      // Hata create.error üzerinden render edilir; caption ile gösterilir.
    }
  }

  const errMsg = create.error instanceof Error ? create.error.message : null;

  return (
    <div
      className="flex flex-col items-end gap-0.5"
      data-testid="batch-stage-cta"
      data-stage="kept-no-selection"
    >
      <button
        type="button"
        onClick={onCreate}
        disabled={create.isPending}
        data-size="sm"
        className="k-btn k-btn--primary disabled:opacity-60"
        data-testid="batch-detail-create-selection"
      >
        {create.isPending ? (
          <>
            <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
            Creating…
          </>
        ) : (
          <>
            <Sparkles className="h-3 w-3" aria-hidden />
            Create Selection
          </>
        )}
      </button>
      {errMsg ? (
        <span
          className="font-mono text-xs uppercase tracking-meta text-danger"
          data-testid="batch-detail-create-selection-error"
          role="alert"
        >
          {errMsg}
        </span>
      ) : (
        <span
          className="font-mono text-xs uppercase tracking-meta text-success"
          data-testid="batch-detail-review-hint"
          data-state="complete"
        >
          Review complete · {keptCount} kept
        </span>
      )}
      <Link
        href={`/review?batch=${batchId}`}
        className="font-mono text-xs uppercase tracking-meta text-ink-3 underline-offset-2 hover:underline"
        data-testid="batch-detail-reopen-review"
      >
        Re-open review
      </Link>
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

/**
 * Batch-first Phase 7 — Overview tab.
 *
 * Operatöre "bu batch'te ne oldu ve şimdi ne yapmalıyım?" sorusunun
 * cevabını verir. v4 A3 canonical summary strip header'da zaten var;
 * Overview tab onu **production summary** ile derinleştirir:
 *
 *  - Production summary card (provider + reference + product type +
 *    aspect ratio + quality + capability)
 *  - State breakdown (mevcut, korundu)
 *  - Decision summary (review counts — operator gating signal)
 *  - Prompt template snippet (korundu)
 */
function OverviewTab({ summary }: { summary: BatchSummary }) {
  return (
    <div className="space-y-5">
      {/* Production summary card — provider-first dil. */}
      <div
        className="rounded-md border border-line bg-paper p-4"
        data-testid="batch-overview-production-summary"
      >
        <h3 className="font-mono text-xs uppercase tracking-meta text-ink-3">
          Production summary
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
          <ProductionField
            label="Provider"
            value={summary.providerLabel}
            mono
          />
          <ProductionField
            label="Reference"
            value={
              summary.referenceId ? (
                <Link
                  href={`/batches?referenceId=${summary.referenceId}`}
                  className="font-mono text-info underline-offset-2 hover:underline"
                >
                  ↗ {summary.referenceId.slice(0, 8).toUpperCase()}
                </Link>
              ) : null
            }
          />
          <ProductionField
            label="Capability"
            value={
              summary.capabilityUsed === "IMAGE_TO_IMAGE"
                ? "Image-to-image"
                : summary.capabilityUsed === "TEXT_TO_IMAGE"
                  ? "Text-to-image"
                  : null
            }
          />
          <ProductionField
            label="Aspect ratio"
            value={summary.aspectRatio}
            mono
          />
          <ProductionField label="Quality" value={summary.quality} mono />
          <ProductionField
            label="Items"
            value={`${summary.batchTotal} requested`}
            mono
          />
        </div>
      </div>

      {/* Decision summary + state breakdown — operator gating signal. */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold text-ink">Prompt template</h3>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-k-bg-2 px-3 py-2 font-mono text-xs leading-relaxed text-ink-2">
            {summary.promptTemplate ?? "(no prompt template snapshot)"}
          </pre>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Decision summary
            </h3>
            <ul
              className="mt-2 space-y-1.5 text-xs"
              data-testid="batch-overview-decision-summary"
            >
              <BreakdownRow
                label="Kept"
                value={summary.reviewCounts.kept}
                tone="success"
              />
              <BreakdownRow
                label="Rejected"
                value={summary.reviewCounts.rejected}
                tone="danger"
              />
              <BreakdownRow
                label="Undecided"
                value={summary.reviewCounts.undecided}
                tone="warning"
              />
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">State breakdown</h3>
            <ul className="mt-2 space-y-1.5 text-xs">
              <BreakdownRow label="Total" value={summary.counts.total} />
              <BreakdownRow
                label="Queued"
                value={summary.counts.queued}
                tone="neutral"
              />
              <BreakdownRow
                label="Running"
                value={summary.counts.running}
                tone="warning"
              />
              <BreakdownRow
                label="Awaiting"
                value={summary.counts.awaiting}
                tone="warning"
              />
              <BreakdownRow
                label="Succeeded"
                value={summary.counts.completed}
                tone="success"
              />
              <BreakdownRow
                label="Failed"
                value={summary.counts.failed}
                tone="danger"
              />
              <BreakdownRow
                label="Cancelled"
                value={summary.counts.cancelled}
                tone="neutral"
              />
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Production summary field — label (mono caption) + value.
 * Boş değer "—" gösterir (legacy batch'ler bazı alanları taşımaz).
 */
function ProductionField({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-sm",
          mono && "font-mono text-xs",
          value ? "text-ink" : "text-ink-3",
        )}
      >
        {value ?? "—"}
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

/**
 * Batch-first Phase 7 — Items tab.
 *
 * Operatöre "bu batch'ten hangi görseller çıktı?" sorusunun cevabını
 * verir. v4 A3 canonical: card grid + thumbnail + state. Phase 7
 * implementation:
 *   - Card grid (4 column comfortable / 6 column dense — gelecek)
 *   - Thumbnail (UserAssetThumb signed URL)
 *   - State badge + asset count + prompt preview tooltip
 *   - assetId yoksa placeholder + state durumu
 *
 * Bulk-select (re-roll / send to review / discard) v4 spec'inde var
 * ama rollout dışı; thumbnail görünürlüğü Phase 7 öncelik.
 */
function ItemsTab({ summary }: { summary: BatchSummary }) {
  if (summary.jobs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center text-sm text-ink-3">
        Bu batch&apos;te henüz item yok.
      </div>
    );
  }
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      data-testid="batch-items-grid"
    >
      {summary.jobs.map((j) => (
        <BatchItemCard key={j.jobId} job={j} />
      ))}
    </div>
  );
}

function BatchItemCard({ job }: { job: BatchSummary["jobs"][number] }) {
  const stateLabel = job.state
    ? JOB_STATE_LABEL_SHORT[job.state as JobState] ?? job.state
    : "—";
  return (
    <div
      className="k-card overflow-hidden"
      data-testid="batch-item-card"
      data-state={job.state ?? "unknown"}
    >
      <div className="relative aspect-square bg-k-bg-2">
        {job.assetId ? (
          <UserAssetThumb
            assetId={job.assetId}
            alt={`Item ${job.batchIndex}`}
            square
            className="!aspect-square"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-3">
            <Layers className="h-5 w-5 opacity-60" aria-hidden />
          </div>
        )}
        <div className="absolute left-2 top-2">
          <span className="inline-flex items-center rounded bg-paper/85 px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-2 shadow-sm">
            #{job.batchIndex}
          </span>
        </div>
        <div className="absolute right-2 top-2">
          <Badge tone={jobStateTone(job.state)} dot>
            {stateLabel}
          </Badge>
        </div>
      </div>
      <div className="p-3">
        {job.expandedPrompt ? (
          <p
            className="line-clamp-2 font-mono text-[11px] leading-snug text-ink-2"
            title={job.expandedPrompt}
          >
            {job.expandedPrompt}
          </p>
        ) : (
          <p className="text-[11px] text-ink-3">—</p>
        )}
        <div className="mt-2 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          <span>
            {job.assetCount} asset{job.assetCount === 1 ? "" : "s"}
          </span>
          {job.failedReason ? (
            <span
              className="text-danger"
              title={job.failedReason}
            >
              error
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Batch-first Phase 7 — Parameters tab.
 *
 * Operatöre "bu batch hangi üretim ayarlarıyla koştu?" sorusunun
 * cevabını verir. Read-only production request snapshot:
 *   - Provider info (id + label + capability)
 *   - Aspect ratio + quality
 *   - Item count + batch type
 *   - Reference parameters (sref/oref/cref) — placeholder (Phase 7
 *     out-of-scope; design'da var ama production'da yazılmıyor)
 *   - Prompt template / snapshot
 *
 * Boş alanlar "—" gösterir (legacy batch'ler bazı alanları taşımaz).
 */
function ParametersTab({ summary }: { summary: BatchSummary }) {
  return (
    <div
      className="grid grid-cols-1 gap-5 md:grid-cols-2"
      data-testid="batch-parameters"
    >
      <div className="space-y-4">
        <div className="rounded-md border border-line bg-paper p-4">
          <h3 className="font-mono text-xs uppercase tracking-meta text-ink-3">
            Provider
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
            <ProductionField
              label="Provider label"
              value={summary.providerLabel}
            />
            <ProductionField
              label="Provider id"
              value={summary.providerId}
              mono
            />
            <ProductionField
              label="Capability"
              value={
                summary.capabilityUsed === "IMAGE_TO_IMAGE"
                  ? "Image-to-image"
                  : summary.capabilityUsed === "TEXT_TO_IMAGE"
                    ? "Text-to-image"
                    : null
              }
            />
            <ProductionField
              label="Pipeline"
              value={
                summary.pipeline === "ai-variation"
                  ? "AI variation"
                  : "Midjourney bridge"
              }
              mono
            />
          </div>
        </div>

        <div className="rounded-md border border-line bg-paper p-4">
          <h3 className="font-mono text-xs uppercase tracking-meta text-ink-3">
            Generation parameters
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
            <ProductionField
              label="Aspect ratio"
              value={summary.aspectRatio}
              mono
            />
            <ProductionField label="Quality" value={summary.quality} mono />
            <ProductionField
              label="Count"
              value={`${summary.batchTotal} requested`}
              mono
            />
            <ProductionField
              label="Template id"
              value={
                summary.templateId
                  ? summary.templateId.slice(0, 8).toUpperCase()
                  : null
              }
              mono
            />
          </div>
        </div>

        <div
          className="rounded-md border border-dashed border-line bg-paper p-4"
          data-testid="batch-parameters-ref-params"
        >
          <h3 className="font-mono text-xs uppercase tracking-meta text-ink-3">
            Reference parameters
          </h3>
          <p className="mt-2 text-xs text-ink-3">
            <code className="font-mono">sref</code>,{" "}
            <code className="font-mono">oref</code>,{" "}
            <code className="font-mono">cref</code> capture — design system v4
            A6 advanced section&apos;da var, A6 modal implementation rollout
            kapsamında değil. Lineage Job.metadata&apos;sında henüz yazılmıyor.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-md border border-line bg-paper p-4">
          <h3 className="font-mono text-xs uppercase tracking-meta text-ink-3">
            Prompt snapshot
          </h3>
          {summary.promptTemplate ? (
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-k-bg-2 px-3 py-2 font-mono text-xs leading-relaxed text-ink-2">
              {summary.promptTemplate}
            </pre>
          ) : (
            <p className="mt-2 text-xs text-ink-3">
              (no prompt template snapshot — inline prompt or legacy batch)
            </p>
          )}
        </div>

        {summary.retryOfBatchId ? (
          <div className="rounded-md border border-warning bg-warning-soft/40 p-4">
            <h3 className="font-mono text-xs uppercase tracking-meta text-warning">
              Retry lineage
            </h3>
            <p className="mt-2 text-xs text-ink-2">
              This batch is a retry of{" "}
              <Link
                href={`/batches/${summary.retryOfBatchId}`}
                className="font-mono text-warning underline-offset-2 hover:underline"
              >
                {summary.retryOfBatchId.slice(0, 12)}
              </Link>
              .
            </p>
          </div>
        ) : null}
      </div>
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

/**
 * Batch-first Phase 11 — Logs tab.
 *
 * Operatöre "bu batch'te ne oldu?" sorusunun **chronological** cevabını
 * verir. Yeni schema field veya event tablosu DEĞİL — mevcut Job +
 * MidjourneyJob timestamp'lerinden lifecycle event'leri derler:
 *
 *   - Job-level (her iki pipeline):
 *     - queued (createdAt)
 *     - started (startedAt, varsa)
 *     - finished (finishedAt + jobStatus + jobError)
 *   - MidjourneyJob-level (sadece MJ pipeline):
 *     - submitted (mjSubmittedAt — bridge'e gönderildi)
 *     - rendered (mjRenderedAt — MJ render tamamlandı)
 *     - completed (mjCompletedAt — asset import edildi)
 *     - failed (mjFailedAt + failedReason + blockReason)
 *
 * UI: job satırları — her job için kompakt timeline strip. Mono
 * timestamp + status badge + (varsa) error caption. Operatör bir
 * bakışta state akışını görür; debug dump değil, ürün yüzeyi.
 */
function LogsTab({ summary }: { summary: BatchSummary }) {
  if (summary.jobs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center text-sm text-ink-3">
        Bu batch&apos;te henüz job kaydı yok.
      </div>
    );
  }
  return (
    <div className="space-y-3" data-testid="batch-logs">
      <div className="font-mono text-xs uppercase tracking-meta text-ink-3">
        Job lifecycle · {summary.jobs.length} item
      </div>
      <div className="space-y-2">
        {summary.jobs.map((j) => (
          <LogJobRow
            key={j.jobId}
            job={j}
            pipeline={summary.pipeline}
          />
        ))}
      </div>
    </div>
  );
}

type LifecycleEvent = {
  kind:
    | "queued"
    | "started"
    | "submitted"
    | "rendered"
    | "completed"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "blocked";
  at: Date;
  detail?: string;
};

function buildLifecycleEvents(
  job: BatchSummary["jobs"][number],
  pipeline: BatchPipeline,
): LifecycleEvent[] {
  const events: LifecycleEvent[] = [];
  // Queued — her zaman var (Job.createdAt).
  events.push({ kind: "queued", at: job.createdAt });
  // Started — Job.startedAt varsa (RUNNING'e geçildi).
  if (job.startedAt) {
    events.push({ kind: "started", at: job.startedAt });
  }
  // MJ-only intermediate lifecycle (bridge ↔ MJ web events).
  if (pipeline === "midjourney") {
    if (job.mjSubmittedAt) {
      events.push({ kind: "submitted", at: job.mjSubmittedAt });
    }
    if (job.mjRenderedAt) {
      events.push({ kind: "rendered", at: job.mjRenderedAt });
    }
    if (job.mjCompletedAt) {
      events.push({ kind: "completed", at: job.mjCompletedAt });
    }
    if (job.mjFailedAt) {
      events.push({
        kind: "failed",
        at: job.mjFailedAt,
        detail: job.failedReason ?? job.blockReason ?? undefined,
      });
    }
  }
  // Job-level terminal — finishedAt + jobStatus eşleştir.
  if (job.finishedAt) {
    if (job.jobStatus === "SUCCESS") {
      events.push({ kind: "succeeded", at: job.finishedAt });
    } else if (job.jobStatus === "FAILED") {
      events.push({
        kind: "failed",
        at: job.finishedAt,
        detail: job.jobError ?? undefined,
      });
    } else if (job.jobStatus === "CANCELLED") {
      events.push({ kind: "cancelled", at: job.finishedAt });
    }
  }
  // Block reason var ama mjFailedAt yoksa (ör. challenge-required hala
  // pending state'inde) — info olarak göster (state.updatedAt'i kullan).
  if (job.blockReason && !job.mjFailedAt && job.updatedAt) {
    events.push({
      kind: "blocked",
      at: job.updatedAt,
      detail: job.blockReason,
    });
  }
  // Kronolojik sırala.
  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  return events;
}

function LogJobRow({
  job,
  pipeline,
}: {
  job: BatchSummary["jobs"][number];
  pipeline: BatchPipeline;
}) {
  const events = buildLifecycleEvents(job, pipeline);
  const hasError = job.jobStatus === "FAILED" || job.blockReason !== null;
  return (
    <div
      className={cn(
        "rounded-md border border-line bg-paper p-3",
        hasError && "border-danger/40",
      )}
      data-testid="batch-logs-job"
      data-job-id={job.jobId}
      data-status={job.jobStatus ?? "unknown"}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            #{job.batchIndex}
          </span>
          <Badge tone={jobStatusTone(job.jobStatus)} dot>
            {jobStatusLabel(job.jobStatus)}
          </Badge>
          {job.retryCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 rounded border border-warning bg-warning-soft px-1.5 py-0.5 font-mono text-[10.5px] text-warning"
              title={`Retried ${job.retryCount}x`}
            >
              <RotateCw className="h-2.5 w-2.5" aria-hidden />
              {job.retryCount}
            </span>
          ) : null}
        </div>
        <code className="font-mono text-[10.5px] tabular-nums text-ink-3">
          job_{job.jobId.slice(0, 8)}
        </code>
      </div>
      {events.length > 0 ? (
        <ul
          className="mt-2 space-y-1 border-l border-line-soft pl-3"
          data-testid="batch-logs-events"
        >
          {events.map((e, i) => (
            <li
              key={`${e.kind}-${i}`}
              className="flex items-start gap-2 font-mono text-[11px]"
              data-event-kind={e.kind}
            >
              <span
                className={cn(
                  "min-w-[5.5rem] uppercase tracking-meta",
                  eventKindClass(e.kind),
                )}
              >
                {e.kind}
              </span>
              <span className="tabular-nums text-ink-3">
                {formatEventTime(e.at)}
              </span>
              {e.detail ? (
                <span
                  className="ml-1 flex-1 truncate text-ink-2"
                  title={e.detail}
                >
                  · {e.detail}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {job.jobError && job.jobStatus === "FAILED" ? (
        <div
          className="mt-2 rounded border border-danger/30 bg-danger-soft/40 px-2 py-1 font-mono text-[11px] text-danger"
          data-testid="batch-logs-error"
        >
          {job.jobError}
        </div>
      ) : null}
    </div>
  );
}

function jobStatusLabel(status: string | null): string {
  if (!status) return "—";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function jobStatusTone(
  status: string | null,
): "success" | "danger" | "warning" | "neutral" | undefined {
  if (!status) return "neutral";
  if (status === "SUCCESS") return "success";
  if (status === "FAILED") return "danger";
  if (status === "RUNNING") return "warning";
  if (status === "CANCELLED") return "neutral";
  return "neutral";
}

function eventKindClass(kind: LifecycleEvent["kind"]): string {
  switch (kind) {
    case "succeeded":
    case "completed":
    case "rendered":
      return "text-success";
    case "failed":
    case "blocked":
      return "text-danger";
    case "cancelled":
      return "text-ink-3";
    case "started":
    case "submitted":
      return "text-warning";
    case "queued":
    default:
      return "text-ink-3";
  }
}

function formatEventTime(d: Date): string {
  // YYYY-MM-DD HH:MM:SS (UTC). Mono caption tabular-nums.
  return d.toISOString().slice(0, 19).replace("T", " ");
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
