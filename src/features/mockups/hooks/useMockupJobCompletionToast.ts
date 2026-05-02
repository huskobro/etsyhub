"use client";

// Phase 8 Task 30 — Mockup job completion/failure → page-level Toast.
//
// Phase 7 Task 39 (useExportCompletionToast) emsali. Spec §5.5 + §6.6.
// S7JobView polling sırasında job terminal state'e ulaştığında kullanıcıya
// başarı/hata toast bildirimi gönderir.
//
// State machine (`job.status`):
//   - Processing: QUEUED | RUNNING.
//   - Terminal: COMPLETED | PARTIAL_COMPLETE | FAILED | CANCELLED.
//
// Transition processing → terminal:
//   - COMPLETED → success toast (successRenders / actualPackSize).
//   - PARTIAL_COMPLETE → success toast (kısmi sayım).
//   - FAILED → error toast (errorSummary).
//   - CANCELLED → toast YOK (kullanıcı kendi iptal etti, UI feedback yeterli).
//
// `prevProcessingRef` + `prevStatusRef` ile transition tespiti. Aynı
// terminal state'te (ör. COMPLETED → COMPLETED re-render) re-push olmaz.

import { useEffect, useRef } from "react";
import { useSelectionStudioToasts } from "@/features/selection/stores/toast-store";
import type { MockupJobView } from "./useMockupJob";

const PROCESSING_STATUSES: MockupJobView["status"][] = ["QUEUED", "RUNNING"];

export function useMockupJobCompletionToast(
  job: MockupJobView | undefined,
): void {
  const push = useSelectionStudioToasts((s) => s.push);
  const prevProcessingRef = useRef<boolean>(false);
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    const currentStatus = job?.status ?? null;
    const isProcessing =
      currentStatus !== null &&
      (PROCESSING_STATUSES as string[]).includes(currentStatus);
    const wasProcessing = prevProcessingRef.current;
    const prevStatus = prevStatusRef.current;

    // Transition: processing → terminal (completion/failure) ve status değişti
    if (
      wasProcessing &&
      !isProcessing &&
      currentStatus !== prevStatus &&
      currentStatus !== null
    ) {
      if (currentStatus === "COMPLETED") {
        push({
          tone: "success",
          message: `Pack hazır: ${job?.successRenders ?? 0} görsel — Sonucu gör`,
          source: "mockup-job",
        });
      } else if (currentStatus === "PARTIAL_COMPLETE") {
        push({
          tone: "success",
          message: `Pack hazır: ${job?.successRenders ?? 0}/${job?.actualPackSize ?? 0} görsel — Sonucu gör`,
          source: "mockup-job",
        });
      } else if (currentStatus === "FAILED") {
        push({
          tone: "error",
          message: `Pack hazırlanamadı: ${job?.errorSummary ?? "bilinmeyen hata"}`,
          source: "mockup-job",
        });
      }
      // CANCELLED → toast emit edilmez (kullanıcı kendi eylemiyle iptal etti;
      // S7JobView UI feedback yeterli)
    }

    prevProcessingRef.current = isProcessing;
    prevStatusRef.current = currentStatus;
  }, [job?.status, job?.successRenders, job?.actualPackSize, job?.errorSummary, push]);
}
