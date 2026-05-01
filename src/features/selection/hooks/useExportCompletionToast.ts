"use client";

// Phase 7 Task 39 — Export completion/failure → page-level Toast.
//
// Spec Section 3.3 + Section 6.6 (activeExport sözleşmesi). ExportButton
// 4-state inline UI ana yüzey; toast page-level fail-safe.
//
// State machine (`activeExport.status`):
//   - Processing: queued | running.
//   - Terminal: completed | failed.
//
// Transition processing → terminal:
//   - completed → success toast.
//   - failed → error toast (failedReason).
//
// `prevProcessingRef` + `prevStatusRef` ile transition tespiti. Aynı
// terminal state'te (ör. completed → completed re-render) re-push olmaz
// (status değişmedi → guard).

import { useEffect, useRef } from "react";
import { useSelectionStudioToasts } from "../stores/toast-store";
import type { ActiveExportView } from "../queries";

export function useExportCompletionToast(
  activeExport: ActiveExportView,
): void {
  const push = useSelectionStudioToasts((s) => s.push);
  const prevProcessingRef = useRef<boolean>(false);
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    const isProcessing =
      activeExport?.status === "queued" || activeExport?.status === "running";
    const wasProcessing = prevProcessingRef.current;
    const currentStatus = activeExport?.status ?? null;
    const prevStatus = prevStatusRef.current;

    // Transition: processing → terminal (completed/failed) ve status değişti
    if (
      wasProcessing &&
      !isProcessing &&
      currentStatus !== prevStatus
    ) {
      if (currentStatus === "completed") {
        push({
          tone: "success",
          message: "Export hazır — indirebilirsiniz",
          source: "export",
        });
      } else if (currentStatus === "failed") {
        push({
          tone: "error",
          message: `Export başarısız: ${
            activeExport?.failedReason ?? "bilinmeyen hata"
          }`,
          source: "export",
        });
      }
    }

    prevProcessingRef.current = isProcessing;
    prevStatusRef.current = currentStatus;
  }, [activeExport, push]);
}
