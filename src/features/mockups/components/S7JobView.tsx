"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMockupJob,
  mockupJobQueryKey,
} from "@/features/mockups/hooks/useMockupJob";
import { useMockupJobCompletionToast } from "@/features/mockups/hooks/useMockupJobCompletionToast";
import { useSelectionSet } from "@/features/selection/queries";
import { Button } from "@/components/ui/Button";
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * S7JobView — Mockup job in-progress / terminal-state surface.
 *
 * Phase 54 — Kanonical omurga polish (Phase 53 S8ResultView ile aile parity):
 *   - **EN parity**: TR drift temizlendi ("Pack Hazırlanıyor"→"Mockup pack
 *     in progress", "Render Durumu"→"Render status", "İş'i iptal et"→"Cancel
 *     job", "S3'e dön"→"Back to Mockup Studio", "Bilinmeyen hata"→"Unknown
 *     error", "Bu sayfayı kapatabilirsin..."→"You can close this page...").
 *   - **Kivasy DS migration**: Legacy `bg-blue-50 bg-red-50 bg-green-50
 *     border-gray-200 var(--color-border) var(--color-accent)` token'lar
 *     `warning-soft / danger-soft / success-soft / k-bg-2 / k-orange /
 *     line` recipe'lerine geçti.
 *   - **Source lineage strip**: useSelectionSet ile set name + back-link +
 *     (varsa) source batch + product type chip (Phase 52 SetSummaryCard /
 *     Phase 53 S8ResultView parity).
 *   - **State polish**: success/active/failed/cancelled state'leri aynı
 *     layout/hierarchy/tone ailesinde; her state operatöre ne olduğunu +
 *     sonra ne yapacağını söyler.
 *   - **Render row recipe**: legacy glif (⊙/◐/⚠) ve `bg-surface border`
 *     yerine icon component'leri (CheckCircle2 / Loader2 spin / AlertTriangle)
 *     + `border-line bg-paper` recipe.
 */

const REDIRECT_FEEDBACK_MS = 400; // 250-500ms aralığı (Spec §5.5)

/* Phase 53 lineage helper parity — sourceMetadata'dan canonical
 * source batch id (variation-batch + mjOrigin format). Schema-zero. */
function resolveSourceBatchId(sourceMetadata: unknown): string | null {
  if (!sourceMetadata || typeof sourceMetadata !== "object") return null;
  const md = sourceMetadata as Record<string, unknown>;
  if (md.kind === "variation-batch" && typeof md.batchId === "string") {
    return md.batchId;
  }
  const mjOrigin = md.mjOrigin;
  if (mjOrigin && typeof mjOrigin === "object") {
    const batchIds = (mjOrigin as Record<string, unknown>).batchIds;
    if (Array.isArray(batchIds) && typeof batchIds[0] === "string") {
      return batchIds[0] as string;
    }
  }
  return null;
}

export function S7JobView({
  setId,
  jobId,
}: {
  setId: string;
  jobId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: job, isLoading, error } = useMockupJob(jobId);
  /* Phase 54 — Source set lineage. useSelectionSet React Query hook,
   * Selection detail / Apply view / Result view ile aynı cache key.
   * Set load olana kadar lineage strip render edilmez (graceful). */
  const { data: set } = useSelectionSet(setId);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Phase 8 Task 30 — Job completion/failure toast
  useMockupJobCompletionToast(job);

  // Auto-redirect on terminal success states (Spec §5.5 satır 1304-1311)
  useEffect(() => {
    if (!job) return;
    if (job.status === "COMPLETED" || job.status === "PARTIAL_COMPLETE") {
      // Yumuşatma: kısa success feedback (250-500ms) sonra redirect
      redirectTimerRef.current = setTimeout(() => {
        router.replace(
          `/selection/sets/${setId}/mockup/jobs/${jobId}/result`,
        );
      }, REDIRECT_FEEDBACK_MS);
    }
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [job?.status, jobId, setId, router]);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/mockup/jobs/${jobId}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        // Polling'i refresh et — status CANCELLED'a update olacak
        await queryClient.refetchQueries({
          queryKey: mockupJobQueryKey(jobId),
        });
      }
    } catch (err) {
      console.error("Cancel error:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) return <div className="p-8 text-sm text-ink-3">Loading…</div>;
  if (error)
    return (
      <div role="alert" className="p-8 text-sm text-danger">
        Couldn't load job
      </div>
    );
  if (!job) return null;

  const isActive = job.status === "QUEUED" || job.status === "RUNNING";
  const isSuccess =
    job.status === "COMPLETED" || job.status === "PARTIAL_COMPLETE";
  const eta = job.estimatedCompletionAt
    ? Math.max(
        0,
        Math.floor(
          (new Date(job.estimatedCompletionAt).getTime() - Date.now()) / 1000,
        ),
      )
    : null;

  // Phase 54 — lineage extraction.
  const sourceBatchId = set ? resolveSourceBatchId(set.sourceMetadata) : null;
  const productTypeKey =
    (set as { items?: Array<{ productTypeKey?: string | null }> } | undefined)
      ?.items?.[0]?.productTypeKey ?? null;

  const progressPct =
    job.totalRenders > 0
      ? Math.round((job.successRenders / job.totalRenders) * 100)
      : 0;

  return (
    <main
      className="mx-auto max-w-2xl p-8"
      data-testid="mockup-job-view"
      data-status={job.status}
    >
      <header className="mb-6">
        <h1 className="k-display text-[24px] font-semibold leading-none tracking-tight text-ink">
          {isSuccess
            ? "Mockup pack ready"
            : job.status === "FAILED"
              ? "Mockup pack failed"
              : job.status === "CANCELLED"
                ? "Mockup pack cancelled"
                : "Mockup pack in progress"}
        </h1>
        <p
          className="mt-1.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3"
          data-testid="mockup-job-meta"
        >
          job · {jobId.slice(0, 8)} · set {setId.slice(0, 8)}
        </p>

        {/* Phase 54 — Lineage strip (Phase 53 S8ResultView parity).
         *
         * Operatör in-progress view'ında da "hangi selection / hangi
         * batch / hangi product type üzerinde çalışıyorum?" sorusunun
         * cevabını alır. set load olana kadar strip render edilmez. */}
        {set ? (
          <div
            className="mt-3 flex flex-wrap items-center gap-1.5"
            data-testid="mockup-job-lineage"
          >
            <Link
              href={`/selections/${setId}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-line-soft bg-k-bg-2/60 px-2 py-1",
                "font-mono text-[10.5px] font-semibold uppercase tracking-meta text-ink-2",
                "transition-colors hover:border-k-orange/50 hover:bg-k-orange-soft hover:text-k-orange-ink",
              )}
              data-testid="mockup-job-back-to-selection"
              title="Back to Selection detail"
            >
              ← {set.name}
            </Link>
            {sourceBatchId ? (
              <Link
                href={`/batches/${sourceBatchId}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-line-soft bg-k-bg-2/60 px-2 py-1",
                  "font-mono text-[10.5px] font-semibold uppercase tracking-meta text-ink-2",
                  "transition-colors hover:border-k-orange/50 hover:bg-k-orange-soft hover:text-k-orange-ink",
                )}
                data-testid="mockup-job-source-batch"
                title="Open the source batch this selection came from"
              >
                <Layers className="h-3 w-3" aria-hidden />
                <span>From batch</span>
                <span className="text-ink-3">·</span>
                <span>{sourceBatchId.slice(0, 8)}</span>
              </Link>
            ) : null}
            {productTypeKey ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border border-line-soft bg-paper px-2 py-1",
                  "font-mono text-[10.5px] font-semibold uppercase tracking-meta text-ink-3",
                )}
                data-testid="mockup-job-product-type"
                title="Product type — selection's first item productTypeKey"
              >
                <span>Type</span>
                <span className="text-ink-3">·</span>
                <span className="text-ink-2">{productTypeKey}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* Phase 54 — Progress / state hero card.
       *
       * Tek hero card; tone state'e göre değişir (success/active/etc.).
       * Active'de SVG ring + ETA; success'te check + "Redirecting to
       * results…" hint; aksi halde state-specific message. */}
      <div role="status" aria-live="polite" className="mb-6">
        {isSuccess ? (
          <div
            data-testid="success-feedback"
            className="flex items-start gap-3 rounded-lg border border-success/40 bg-success-soft/40 p-4"
          >
            <CheckCircle2
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-success"
              aria-hidden
            />
            <div className="flex-1">
              <p className="font-semibold leading-tight text-ink">
                Pack ready · {job.successRenders} of {job.actualPackSize}{" "}
                render{job.actualPackSize === 1 ? "" : "s"} succeeded
              </p>
              <p className="mt-1 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                Redirecting to results…
              </p>
            </div>
          </div>
        ) : isActive ? (
          <div
            className="flex items-center gap-5 rounded-lg border border-line bg-paper p-5"
            data-testid="mockup-job-active"
          >
            <div className="relative h-24 w-24 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="rgb(229, 222, 211)"
                  strokeWidth="3"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="rgb(232, 93, 37)"
                  strokeWidth="3"
                  strokeDasharray={`${(job.successRenders / Math.max(1, job.totalRenders)) * 283} 283`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-lg font-bold text-ink tabular-nums">
                    {job.successRenders}
                  </p>
                  <p className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                    of {job.totalRenders}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink">
                Rendering mockups…{" "}
                <span className="tabular-nums text-ink-3">{progressPct}%</span>
              </p>
              <p className="mt-1 text-sm text-ink-2">
                {job.successRenders} of {job.totalRenders} render
                {job.totalRenders === 1 ? "" : "s"} complete
              </p>
              {eta !== null && eta > 0 ? (
                <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                  ~{eta}s remaining (approx.)
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Per-render list */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-ink">Render status</h2>
        <div className="max-h-96 space-y-1.5 overflow-y-auto">
          {job.renders.map((render) => {
            const isS = render.status === "SUCCESS";
            const isR = render.status === "RENDERING";
            const isP = render.status === "PENDING";
            const isF = render.status === "FAILED";
            return (
              <div
                key={render.id}
                className="flex items-center gap-3 rounded-md border border-line bg-paper p-3"
                data-testid="mockup-render-row"
                data-render-status={render.status}
              >
                <div className="flex-shrink-0">
                  {isS ? (
                    <CheckCircle2
                      className="h-4 w-4 text-success"
                      aria-hidden
                    />
                  ) : isR ? (
                    <Loader2
                      className="h-4 w-4 animate-spin text-k-orange"
                      aria-hidden
                    />
                  ) : isF ? (
                    <AlertTriangle
                      className="h-4 w-4 text-danger"
                      aria-hidden
                    />
                  ) : (
                    <div
                      className="h-4 w-4 rounded-full border-2 border-line-strong"
                      aria-hidden
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {render.packPosition !== null
                      ? `${render.packPosition + 1}. `
                      : ""}
                    {render.templateSnapshot?.templateName || "Template"}
                  </p>
                  <p className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                    {render.variantId.substring(0, 8)}
                    {isP ? " · waiting" : ""}
                    {isR ? " · rendering" : ""}
                  </p>
                </div>
                {render.completedAt && render.startedAt ? (
                  <p className="font-mono text-[10.5px] uppercase tracking-meta tabular-nums text-ink-3">
                    {Math.round(
                      (new Date(render.completedAt).getTime() -
                        new Date(render.startedAt).getTime()) /
                        1000,
                    )}
                    s
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Reassurance — queued/running */}
      {isActive ? (
        <div
          className="mb-6 flex items-start gap-2 rounded-md border border-line-soft bg-k-bg-2/40 p-3 text-sm text-ink-2"
          data-testid="mockup-job-reassurance"
        >
          <span
            className="mt-1.5 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-k-orange"
            aria-hidden
          />
          <p>
            You can close this page — the job continues in the background.
            We'll keep your renders ready when you come back.
          </p>
        </div>
      ) : null}

      {/* Failed state */}
      {job.status === "FAILED" ? (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-danger/40 bg-danger/5 p-4"
          data-testid="mockup-job-failed"
        >
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-danger">
            <AlertTriangle className="h-5 w-5" />
            Pack failed to render
          </h2>
          <p className="mb-3 text-sm text-ink-2">
            {job.errorSummary || "Unknown error. Please try again."}
          </p>
          <p className="mb-4 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            Your selection is unaffected — return to Mockup Studio to retry
            with the same set.
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              router.push(`/selection/sets/${setId}/mockup/apply`)
            }
          >
            Back to Mockup Studio
          </Button>
        </div>
      ) : null}

      {/* Cancelled state */}
      {job.status === "CANCELLED" ? (
        <div
          className="mb-6 rounded-lg border border-line-soft bg-k-bg-2/60 p-4"
          data-testid="mockup-job-cancelled"
        >
          <p className="mb-3 text-sm text-ink-2">
            Job cancelled. Any partial renders are discarded; your selection
            is intact.
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              router.push(`/selection/sets/${setId}/mockup/apply`)
            }
          >
            Back to Mockup Studio
          </Button>
        </div>
      ) : null}

      {/* Cancel button — sadece queued/running */}
      {isActive ? (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleCancel}
            disabled={isCancelling}
            data-testid="mockup-job-cancel"
          >
            {isCancelling ? "Cancelling…" : "Cancel job"}
          </Button>
        </div>
      ) : null}
    </main>
  );
}
