"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMockupJob,
  type MockupRenderView,
  type MockupJobView,
} from "@/features/mockups/hooks/useMockupJob";
import { useCreateListingDraft } from "@/features/listings/hooks/useCreateListingDraft";
import { useSelectionSet } from "@/features/selection/queries";
import { resolveSourceBatchId } from "@/lib/selection-lineage";
import { Button } from "@/components/ui/Button";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  Layers,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CoverSwapModal } from "./CoverSwapModal";
import { PerRenderActions } from "./PerRenderActions";

/**
 * S8ResultView — Mockup job result + Listing handoff surface.
 *
 * Phase 53 — Studio polish:
 *   - **EN parity**: TR copy temizlendi (Phase 15 baseline catch-up).
 *   - **CTA hierarchy düzeltildi**: Phase 8'de "Bulk download ZIP"
 *     primary, "Listing'e gönder" secondary'di — ürün omurgası açısından
 *     yanlış. Operatör mockup'ları product/Etsy zincirine taşımak için
 *     buraya iniyor; download yan-aksiyon. Phase 53 hierarchy:
 *       - **Primary**: "Create listing draft →" (orange, ana akış)
 *       - **Secondary**: "Download ZIP" (yan-aksiyon)
 *   - **Source context lineage strip**: useSelectionSet hook ile set
 *     name + back-link + (varsa) batch chip + product type chip. Phase
 *     52 SetSummaryCard pattern parity.
 *   - **Listing creation feedback**: mutation isError → operatöre net
 *     error mesajı + retry guidance. Önceden silent fail (yalnız spinner
 *     kayboluyordu, kullanıcı "şey oldu mu?" sorusunda kalıyordu).
 *   - **Pending sub-states**: Pack hazır status'ünden bağımsız warning
 *     korundu (partial = success + failed renders).
 */

const ERROR_LABELS: Record<string, { label: string; actions: string[] }> = {
  RENDER_TIMEOUT: { label: "Render timeout", actions: ["retry"] },
  TEMPLATE_INVALID: { label: "Template invalid", actions: ["swap"] },
  SAFE_AREA_OVERFLOW: { label: "Design didn't fit", actions: ["swap"] },
  SOURCE_QUALITY: {
    label: "Source quality too low",
    actions: ["swap", "phase7-link"],
  },
  PROVIDER_DOWN: { label: "Provider unreachable", actions: ["retry"] },
};

// Phase 55 — Inline helper @/lib/selection-lineage'a taşındı (DRY).

function AllFailedView({
  setId,
  job,
}: {
  setId: string;
  job: MockupJobView;
}) {
  const router = useRouter();
  /* Phase 54 — All-failed state'te de operator selection context'ini
   * kaybetmemeli. useSelectionSet ile set adı + lineage chip strip
   * gösterir (Phase 53 S8ResultView başarı path'i parity).
   * Set load olana kadar lineage strip render edilmez. */
  const { data: set } = useSelectionSet(setId);
  const sourceBatchId = set ? resolveSourceBatchId(set.sourceMetadata) : null;
  const productTypeKey =
    (set as { items?: Array<{ productTypeKey?: string | null }> } | undefined)
      ?.items?.[0]?.productTypeKey ?? null;

  return (
    <main
      className="mx-auto max-w-2xl p-8"
      data-testid="mockup-result-all-failed"
    >
      {/* Phase 54 — Lineage strip (failed state'te de context korunur) */}
      {set ? (
        <div
          className="mb-4 flex flex-wrap items-center gap-1.5"
          data-testid="mockup-result-all-failed-lineage"
        >
          <Link
            href={`/selections/${setId}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-line-soft bg-k-bg-2/60 px-2 py-1",
              "font-mono text-[10.5px] font-semibold uppercase tracking-meta text-ink-2",
              "transition-colors hover:border-k-orange/50 hover:bg-k-orange-soft hover:text-k-orange-ink",
            )}
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
            >
              <span>Type</span>
              <span className="text-ink-3">·</span>
              <span className="text-ink-2">{productTypeKey}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        role="alert"
        className="rounded-lg border border-danger/40 bg-danger/5 p-6"
      >
        <h1 className="mb-2 flex items-center gap-2 text-xl font-bold text-danger">
          <AlertTriangle className="h-6 w-6" />
          Pack failed to render
        </h1>
        <p className="mb-3 text-sm text-ink-2">
          {job.errorSummary ||
            "All renders failed. Try again or swap templates."}
        </p>
        <p className="mb-4 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          Your selection is intact — retry with the same set or pick a different
          template pack.
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
    </main>
  );
}

function CoverSlot({
  render,
  jobId,
  otherSuccessRenders,
}: {
  render: MockupRenderView;
  jobId: string;
  otherSuccessRenders: MockupRenderView[];
}) {
  const [showCoverSwap, setShowCoverSwap] = useState(false);

  return (
    <>
      {/* Phase 55 — Cover tile DS migration.
       *   - border-accent → border-k-orange (Kivasy primary)
       *   - bg-gray-100 → bg-k-bg-2 (paper-friendly neutral)
       *   - text-gray-400 → text-ink-3
       *   - bg-accent badge → bg-k-orange + uppercase mono tracking-meta */}
      <div className="group relative overflow-hidden rounded-lg border-2 border-k-orange shadow-lg">
        <div className="flex aspect-square items-center justify-center bg-k-bg-2">
          {render.outputKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/mockup/jobs/${jobId}/renders/${render.id}/download`}
              alt="cover"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-ink-3">No image</span>
          )}
        </div>

        {/* Cover badge — Kivasy DS mono recipe (Phase 51 status badge parity) */}
        <div className="absolute left-2 top-2 rounded-md bg-k-orange px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-meta text-white shadow-sm">
          ★ Cover
        </div>

        {/* Hover actions */}
        <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 rounded bg-black/60 p-4 opacity-0 transition-opacity group-hover:opacity-100">
          {otherSuccessRenders.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowCoverSwap(true)}
              className="w-full"
            >
              Swap cover
            </Button>
          )}
          <a
            href={`/api/mockup/jobs/${jobId}/renders/${render.id}/download`}
            className="w-full"
            download
          >
            <Button size="sm" variant="secondary" className="w-full">
              Download
            </Button>
          </a>
        </div>
      </div>

      <CoverSwapModal
        open={showCoverSwap}
        onOpenChange={setShowCoverSwap}
        jobId={jobId}
        currentCoverRenderId={render.id}
        alternatives={otherSuccessRenders}
      />
    </>
  );
}

function SuccessRenderSlot({
  render,
  jobId,
}: {
  render: MockupRenderView;
  jobId: string;
}) {
  /* Phase 55 — Success render tile DS migration:
   *   - border → border-line (Kivasy DS line token)
   *   - shadow → shadow-sm (paper-friendly)
   *   - bg-gray-100 → bg-k-bg-2
   *   - text-gray-400 → text-ink-3
   *   - bottom variant ID overlay bg-black/70 → bg-ink/85 */
  return (
    <div className="group relative overflow-hidden rounded-lg border border-line shadow-sm">
      <div className="flex aspect-square items-center justify-center bg-k-bg-2">
        {render.outputKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/mockup/jobs/${jobId}/renders/${render.id}/download`}
            alt="render"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-ink-3">No image</span>
        )}
      </div>

      {/* Hover actions */}
      <PerRenderActions render={render} jobId={jobId} isCover={false} />

      {/* Variant ID — Phase 55 DS overlay: ink/85 + mono uppercase */}
      <div className="absolute bottom-0 left-0 right-0 bg-ink/85 px-2 py-1.5 font-mono text-[10px] uppercase tracking-meta text-white">
        {render.variantId.substring(0, 12)}
      </div>
    </div>
  );
}

function FailedRenderSlot({
  render,
  jobId,
}: {
  render: MockupRenderView;
  jobId: string;
}) {
  const errorClass = render.errorClass || "PROVIDER_DOWN";
  const errorInfo =
    ERROR_LABELS[errorClass] || { label: "Unknown error", actions: [] };

  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-danger/40 bg-danger/5 shadow">
      <div className="flex aspect-square items-center justify-center bg-danger/10">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-danger" />
          <p className="text-xs text-danger">{errorInfo.label}</p>
        </div>
      </div>

      {/* Hover actions */}
      <PerRenderActions render={render} jobId={jobId} isCover={false} />

      {/* Error detail — Phase 55 DS overlay (ink/85 + mono) */}
      <div className="absolute bottom-0 left-0 right-0 bg-ink/85 px-2 py-1.5 font-mono text-[10px] tracking-meta text-white">
        <p className="truncate">{render.errorDetail || "No detail"}</p>
      </div>
    </div>
  );
}

export function S8ResultView({
  setId,
  jobId,
}: {
  setId: string;
  jobId: string;
}) {
  const router = useRouter();
  const { data: job, isLoading } = useMockupJob(jobId);
  /* Phase 53 — Source set lineage. Mockup result page'ine direct deep-link
   * de gelinebilir; setId üzerinden set adı + sourceMetadata fetch'i
   * context'i korur. useSelectionSet React Query hook'u zaten cache var
   * (Selection detail / Apply view ile aynı key). */
  const { data: set } = useSelectionSet(setId);
  const createListingMutation = useCreateListingDraft();
  const [isCreatingListing, setIsCreatingListing] = useState(false);

  const handleCreateListing = async () => {
    try {
      setIsCreatingListing(true);
      const result = await createListingMutation.mutateAsync({
        mockupJobId: jobId,
      });
      // R5 — Selection → Product handoff: mockup job listing draft yarattı,
      // operatörü Product detail'a (Kivasy A5) götür. Legacy /listings/draft/
      // [id] hâlâ erişilebilir (listings/* navigasyon altında); ana ürün
      // yüzeyi /products/[id]'dir.
      router.push(`/products/${result.listingId}`);
    } finally {
      setIsCreatingListing(false);
    }
  };

  // Status guard: ∉ {COMPLETED, PARTIAL_COMPLETE} → S7'e geri yolla
  useEffect(() => {
    if (!job) return;
    if (job.status !== "COMPLETED" && job.status !== "PARTIAL_COMPLETE") {
      router.replace(`/selection/sets/${setId}/mockup/jobs/${jobId}`);
    }
  }, [job?.status, jobId, setId, router]);

  if (isLoading) return <div className="p-8">Loading…</div>;
  if (!job) return null;
  if (job.status !== "COMPLETED" && job.status !== "PARTIAL_COMPLETE")
    return null;

  // All failed (success=0): recovery layout
  if (job.successRenders === 0) {
    return <AllFailedView setId={setId} job={job} />;
  }

  // Organize renders
  const successRenders = job.renders.filter((r) => r.status === "SUCCESS");
  const failedRenders = job.renders.filter((r) => r.status === "FAILED");
  const cover = successRenders.find((r) => r.id === job.coverRenderId);
  const others = successRenders
    .filter((r) => r.id !== job.coverRenderId)
    .sort((a, b) => (a.packPosition ?? 0) - (b.packPosition ?? 0));

  // Phase 53 — Source context lineage.
  const sourceBatchId = set ? resolveSourceBatchId(set.sourceMetadata) : null;
  const productTypeKey = (set as { items?: Array<{ productTypeKey?: string | null }> } | undefined)
    ?.items?.[0]?.productTypeKey ?? null;

  return (
    <main className="mx-auto max-w-6xl p-8" data-testid="mockup-result-view">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="k-display text-[24px] font-semibold leading-none tracking-tight text-ink">
              Mockup pack ready
            </h1>
            <p
              className="mt-1.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3"
              data-testid="mockup-result-counts"
            >
              {job.successRenders} of {job.actualPackSize} render
              {job.actualPackSize === 1 ? "" : "s"} succeeded
              {failedRenders.length > 0 ? (
                <>
                  {" · "}
                  <span className="text-danger">
                    {failedRenders.length} failed
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        {/* Phase 53 — Source context lineage strip.
         *
         * Operatör mockup result'a indikten sonra "bu hangi selection,
         * hangi batch'ten geldi?" sorusuna anında cevap alır. SetSummaryCard
         * (Phase 52) pattern parity: back-link + batch chip + product type
         * chip. set load olana kadar strip render edilmez (graceful). */}
        {set ? (
          <div
            className="mt-3 flex flex-wrap items-center gap-1.5"
            data-testid="mockup-result-lineage"
          >
            <Link
              href={`/selections/${setId}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-line-soft bg-k-bg-2/60 px-2 py-1",
                "font-mono text-[10.5px] font-semibold uppercase tracking-meta text-ink-2",
                "transition-colors hover:border-k-orange/50 hover:bg-k-orange-soft hover:text-k-orange-ink",
              )}
              data-testid="mockup-result-back-to-selection"
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
                data-testid="mockup-result-source-batch"
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
                data-testid="mockup-result-product-type"
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

      {/* Warning — failed renders */}
      {failedRenders.length > 0 && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft/40 p-4"
          data-testid="mockup-result-partial-warning"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
          <div className="text-sm text-ink">
            <strong>{failedRenders.length} render{failedRenders.length === 1 ? "" : "s"}</strong>{" "}
            failed. Hover the failed tiles below to retry or swap templates.
            You can still proceed with the {job.successRenders} successful
            mockup{job.successRenders === 1 ? "" : "s"}.
          </div>
        </div>
      )}

      {/* Phase 53 — Actions row with proper hierarchy.
       *
       * Primary: "Create listing draft →" (orange) — ana akış, operatör
       *   product/Etsy zincirine taşınır.
       * Secondary: "Download ZIP" — yan-aksiyon.
       *
       * isError → kırmızı alert + retry hint (operatör 'butona bastım,
       * sanırım bir şey oldu' hissinden kurtulur). */}
      <div
        className="mb-6 flex flex-wrap items-center gap-3"
        data-testid="mockup-result-actions"
      >
        <Button
          onClick={handleCreateListing}
          disabled={isCreatingListing || createListingMutation.isPending}
          variant="primary"
          data-testid="mockup-result-create-listing"
        >
          {isCreatingListing || createListingMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating listing draft…
            </>
          ) : (
            <>
              Create listing draft
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </>
          )}
        </Button>
        <a
          href={`/api/mockup/jobs/${jobId}/download`}
          download
          className="inline-flex"
          data-testid="mockup-result-download-zip"
        >
          <Button variant="secondary">
            <Download className="mr-2 h-4 w-4" aria-hidden />
            Download ZIP ({job.successRenders})
          </Button>
        </a>
        <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          Next · Product/listing prep
        </span>
      </div>

      {/* Phase 53 — Listing creation error feedback.
       *
       * createListingMutation.isError → operatöre net mesaj + retry
       * yönergesi. Önceden silent fail (spinner kayboluyordu, kullanıcı
       * sayfa donmuş gibi hissediyordu). */}
      {createListingMutation.isError ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 p-4"
          data-testid="mockup-result-listing-error"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger"
            aria-hidden
          />
          <div className="flex-1 text-sm text-ink">
            <div className="font-medium text-danger">
              Couldn&apos;t create listing draft
            </div>
            <p className="mt-1 text-ink-2">
              {(createListingMutation.error as Error)?.message ??
                "An unexpected error occurred."}
            </p>
            <p className="mt-1 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              Try again — your mockup renders are unaffected.
            </p>
          </div>
        </div>
      ) : null}

      {/* Phase 53 — Optional success hint (operator confidence).
       *
       * Mockup job COMPLETED ve hiç failed render yoksa operatöre
       * "all clean" sinyali ver. Sessiz başarı değil. */}
      {failedRenders.length === 0 && !createListingMutation.isError ? (
        <div
          className="mb-6 flex items-start gap-2 rounded-lg border border-success/40 bg-success-soft/40 p-3 text-sm text-ink"
          data-testid="mockup-result-success-hint"
        >
          <CheckCircle2
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-success"
            aria-hidden
          />
          <div>
            All {job.successRenders} mockup{job.successRenders === 1 ? "" : "s"}{" "}
            rendered successfully. Ready to create the listing draft.
          </div>
        </div>
      ) : null}

      {/* Grid layout — cover first, 3-column */}
      <div className="grid grid-cols-3 gap-4">
        {cover && (
          <div className="col-span-1 row-span-2">
            <CoverSlot
              render={cover}
              jobId={jobId}
              otherSuccessRenders={others}
            />
          </div>
        )}

        {/* Success slots */}
        {others.map((r) => (
          <SuccessRenderSlot key={r.id} render={r} jobId={jobId} />
        ))}

        {/* Failed slots */}
        {failedRenders.map((r) => (
          <FailedRenderSlot key={r.id} render={r} jobId={jobId} />
        ))}
      </div>
    </main>
  );
}
