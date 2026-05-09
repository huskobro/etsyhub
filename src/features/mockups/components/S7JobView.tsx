"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMockupJob, mockupJobQueryKey } from "@/features/mockups/hooks/useMockupJob";
import { useMockupJobCompletionToast } from "@/features/mockups/hooks/useMockupJobCompletionToast";
import { Button } from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";

const REDIRECT_FEEDBACK_MS = 400; // 250-500ms aralığı (Spec §5.5)

export function S7JobView({ setId, jobId }: { setId: string; jobId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: job, isLoading, error } = useMockupJob(jobId);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isCancelling, setIsCancelling] = React.useState(false);

  // Phase 8 Task 30 — Job completion/failure toast
  useMockupJobCompletionToast(job);

  // Auto-redirect on terminal success states (Spec §5.5 satır 1304-1311)
  useEffect(() => {
    if (!job) return;
    if (job.status === "COMPLETED" || job.status === "PARTIAL_COMPLETE") {
      // Yumuşatma: kısa success feedback (250-500ms) sonra redirect
      redirectTimerRef.current = setTimeout(() => {
        router.replace(`/selection/sets/${setId}/mockup/jobs/${jobId}/result`);
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

  if (isLoading) return <div className="p-8">Yükleniyor…</div>;
  if (error) return <div role="alert" className="p-8 text-red-600">Job yüklenemedi</div>;
  if (!job) return null;

  const isActive = job.status === "QUEUED" || job.status === "RUNNING";
  const isSuccess = job.status === "COMPLETED" || job.status === "PARTIAL_COMPLETE";
  const eta = job.estimatedCompletionAt
    ? Math.max(0, Math.floor((new Date(job.estimatedCompletionAt).getTime() - Date.now()) / 1000))
    : null;

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Pack Hazırlanıyor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          /selection/sets/{setId}/mockup/jobs/{jobId}
        </p>
      </header>

      {/* Progress ring */}
      <div role="status" aria-live="polite" className="mb-8">
        {isSuccess ? (
          <div data-testid="success-feedback" className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="font-semibold text-green-800">
              ✓ Pack hazır! {job.successRenders}/{job.actualPackSize} render başarılı
            </p>
          </div>
        ) : isActive ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-border)" strokeWidth="2" />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="2"
                    strokeDasharray={`${(job.successRenders / job.totalRenders) * 283} 283`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-lg font-bold">{job.successRenders}</p>
                    <p className="text-xs text-muted-foreground">{job.totalRenders}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">{job.successRenders} render hazır</p>
                <p className="text-sm text-muted-foreground">
                  {job.totalRenders} render toplamında
                </p>
                {eta !== null && eta > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    ~{eta} saniye kaldı (yaklaşık)
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Per-render list */}
      <div className="mb-8">
        <h2 className="font-semibold mb-4">Render Durumu</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {job.renders.map((render) => (
            <div
              key={render.id}
              className="flex items-center gap-3 p-3 rounded border bg-surface"
            >
              <div className="flex-shrink-0 text-lg">
                {render.status === "SUCCESS" && "✓"}
                {render.status === "RENDERING" && "◐"}
                {render.status === "PENDING" && "⊙"}
                {render.status === "FAILED" && "⚠"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {render.packPosition !== null ? `${render.packPosition + 1}. ` : ""}
                  {render.templateSnapshot?.templateName || "şablon"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {render.variantId.substring(0, 8)}
                </p>
              </div>
              {render.completedAt && render.startedAt && (
                <p className="text-xs text-muted-foreground">
                  {Math.round(
                    (new Date(render.completedAt).getTime() - new Date(render.startedAt).getTime()) / 1000
                  )}
                  s
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Güvence metni — queued/running */}
      {isActive && (
        <p className="text-sm text-muted-foreground mb-6 p-3 bg-blue-50 rounded border border-blue-200">
          💡 Bu sayfayı kapatabilirsin. Job arka planda devam eder.
        </p>
      )}

      {/* Failed state */}
      {job.status === "FAILED" && (
        <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Pack hazırlanamadı
          </h2>
          <p className="text-sm text-red-700 mb-4">{job.errorSummary || "Bilinmeyen hata"}</p>
          <Button
            variant="secondary"
            onClick={() => router.push(`/selection/sets/${setId}/mockup/apply`)}
          >
            S3&apos;e dön
          </Button>
        </div>
      )}

      {/* Cancelled state */}
      {job.status === "CANCELLED" && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-700 mb-4">İş iptal edildi.</p>
          <Button
            variant="secondary"
            onClick={() => router.push(`/selection/sets/${setId}/mockup/apply`)}
          >
            S3&apos;e dön
          </Button>
        </div>
      )}

      {/* Cancel button — sadece queued/running */}
      {isActive && (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleCancel}
            disabled={isCancelling}
          >
            {isCancelling ? "İptal ediliyor…" : "İş'i iptal et"}
          </Button>
        </div>
      )}
    </main>
  );
}

// Inline React import fix
import React from "react";
