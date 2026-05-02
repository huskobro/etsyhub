"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMockupJob, type MockupRenderView, type MockupJobView } from "@/features/mockups/hooks/useMockupJob";
import { Button } from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";
import { CoverSwapModal } from "./CoverSwapModal";
import { PerRenderActions } from "./PerRenderActions";

const ERROR_LABELS: Record<
  string,
  { label: string; actions: string[] }
> = {
  RENDER_TIMEOUT: { label: "Zaman aşımı", actions: ["retry"] },
  TEMPLATE_INVALID: { label: "Şablon geçersiz", actions: ["swap"] },
  SAFE_AREA_OVERFLOW: { label: "Tasarım sığmadı", actions: ["swap"] },
  SOURCE_QUALITY: { label: "Kaynak yetersiz", actions: ["swap", "phase7-link"] },
  PROVIDER_DOWN: { label: "Motor erişilemez", actions: ["retry"] },
};

function AllFailedView({ setId, job }: { setId: string; job: MockupJobView }) {
  const router = useRouter();

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <div role="alert" className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h1 className="text-xl font-bold text-red-800 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6" />
          Pack üretilemedi
        </h1>
        <p className="text-sm text-red-700 mb-4">
          {job.errorSummary || "Tüm render'ler başarısız oldu. Lütfen tekrar dene."}
        </p>
        <Button
          variant="secondary"
          onClick={() => router.push(`/selection/sets/${setId}/mockup/apply`)}
        >
          S3'e dön
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
      <div className="relative group rounded-lg overflow-hidden shadow-lg border-2 border-accent">
        <div className="aspect-square bg-gray-100 flex items-center justify-center">
          {render.outputKey ? (
            <img src={render.outputKey} alt="cover" className="w-full h-full object-cover" />
          ) : (
            <span className="text-gray-400">Görsel yok</span>
          )}
        </div>

        {/* Cover badge */}
        <div className="absolute top-2 left-2 bg-accent text-white px-2 py-1 rounded text-xs font-bold">
          ★ COVER
        </div>

        {/* Hover actions */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded flex flex-col items-center justify-end p-4 gap-2">
          {otherSuccessRenders.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowCoverSwap(true)}
              className="w-full"
            >
              Cover'ı Değiştir
            </Button>
          )}
          <a
            href={`/api/mockup/jobs/${jobId}/renders/${render.id}/download`}
            className="w-full"
          >
            <Button size="sm" variant="secondary" className="w-full">
              İndir
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

function SuccessRenderSlot({ render, jobId }: { render: MockupRenderView; jobId: string }) {
  return (
    <div className="relative group rounded-lg overflow-hidden shadow border">
      <div className="aspect-square bg-gray-100 flex items-center justify-center">
        {render.outputKey ? (
          <img src={render.outputKey} alt="render" className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-400">Görsel yok</span>
        )}
      </div>

      {/* Hover actions */}
      <PerRenderActions render={render} jobId={jobId} isCover={false} />

      {/* Variant ID */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-2">
        {render.variantId.substring(0, 12)}
      </div>
    </div>
  );
}

function FailedRenderSlot({ render, jobId }: { render: MockupRenderView; jobId: string }) {
  const errorClass = render.errorClass || "PROVIDER_DOWN";
  const errorInfo = ERROR_LABELS[errorClass] || { label: "Bilinmeyen hata", actions: [] };

  return (
    <div className="relative rounded-lg overflow-hidden shadow border-2 border-red-200 bg-red-50">
      <div className="aspect-square bg-red-100 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-xs text-red-700">{errorInfo.label}</p>
        </div>
      </div>

      {/* Hover actions */}
      <PerRenderActions render={render} jobId={jobId} isCover={false} />

      {/* Error detail */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-2">
        <p className="truncate">{render.errorDetail || "Detay yok"}</p>
      </div>
    </div>
  );
}

export function S8ResultView({ setId, jobId }: { setId: string; jobId: string }) {
  const router = useRouter();
  const { data: job, isLoading } = useMockupJob(jobId);

  // Status guard: ∉ {COMPLETED, PARTIAL_COMPLETE} → S7'e geri yolla
  useEffect(() => {
    if (!job) return;
    if (job.status !== "COMPLETED" && job.status !== "PARTIAL_COMPLETE") {
      router.replace(`/selection/sets/${setId}/mockup/jobs/${jobId}`);
    }
  }, [job?.status, jobId, setId, router]);

  if (isLoading) return <div className="p-8">Yükleniyor…</div>;
  if (!job) return null;
  if (job.status !== "COMPLETED" && job.status !== "PARTIAL_COMPLETE") return null;

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

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">
          Pack hazır: {job.successRenders}/{job.actualPackSize} görsel
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          /selection/sets/{setId}/mockup/jobs/{jobId}/result
        </p>
      </header>

      {/* Warning — failed renders */}
      {failedRenders.length > 0 && (
        <div role="alert" className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            ⚠ {failedRenders.length} render başarısız oldu. Tekrar dene veya swap yap.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <a
          href={`/api/mockup/jobs/${jobId}/download`}
          download
          className="inline-flex"
        >
          <Button>
            ⬇ Bulk download ZIP ({job.successRenders} görsel)
          </Button>
        </a>
        <Button
          disabled
          title="Phase 9'da listing builder eklenecek"
          variant="secondary"
        >
          Listing'e gönder →
        </Button>
      </div>

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
