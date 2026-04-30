// Phase 7 Task 13 — Selection export cleanup BullMQ worker.
//
// Sözleşme (design Section 6.5):
//   - JobType: SELECTION_EXPORT_CLEANUP (Phase 7 yeni enum value).
//   - Repeat: günlük UTC 04:00 (bootstrap.ts'te scheduleRepeatJob).
//   - Concurrency 1: cleanup serileştirilir (paralel iki run garip race
//     yaratmasın).
//   - Handler ince: cleanupExpiredExports() çağrısı + log + return.
//
// Phase 6 emsal: `fetch-new-listings.worker.ts` daily repeat patterni.

import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { cleanupExpiredExports } from "@/server/services/selection/export/cleanup";

export type SelectionExportCleanupJobResult = {
  deletedCount: number;
  totalScanned: number;
};

/**
 * BullMQ worker handler — eski export ZIP'lerini siler.
 *
 * Failure path: cleanupExpiredExports kendi içinde delete failure'larını
 * yutar (best-effort). Yine de unexpected throw olursa BullMQ FAILED state'e
 * düşer; cron schedule bozulmaz (BullMQ repeat per-fire bağımsızdır).
 */
export async function handleSelectionExportCleanup(
  job: Job,
): Promise<SelectionExportCleanupJobResult> {
  logger.info({ jobId: job.id }, "selection export cleanup started");
  const result = await cleanupExpiredExports();
  logger.info(
    {
      jobId: job.id,
      deletedCount: result.deletedCount,
      totalScanned: result.totalScanned,
    },
    "selection export cleanup completed",
  );
  return result;
}
