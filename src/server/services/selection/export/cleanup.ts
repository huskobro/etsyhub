// Phase 7 Task 13 — Selection export ZIP cleanup service.
//
// Sözleşme (design Section 6.5):
//   - 7 günden eski (lastModified) export ZIP'leri silinir.
//   - `exports/` global prefix'i altında çalışır (kullanıcı bazlı sub-prefix
//     `exports/{userId}/{setId}/{jobId}.zip` — pattern Task 12'de tanımlı).
//   - Her object başına best-effort delete: tek failure pipeline'ı durdurmaz,
//     log + continue.
//   - `now` parametresi test için; default new Date().
//
// İmza:
//   cleanupExpiredExports(now?: Date) → { deletedCount, totalScanned }
//
// Cron handler tarafından çağrılır (UTC 04:00 günlük). Bkz.
// `selection-export-cleanup.worker.ts` ve `bootstrap.ts`.

import { getStorage } from "@/providers/storage";
import { logger } from "@/lib/logger";

/** 7 gün cutoff (Section 6.5). */
export const EXPORT_CLEANUP_AGE_MS = 7 * 24 * 3600 * 1000;
/** Cleanup taraması root prefix'i. Task 12 ZIP path: `exports/{userId}/{setId}/{jobId}.zip`. */
export const EXPORT_PREFIX = "exports/";

export type CleanupResult = {
  deletedCount: number;
  totalScanned: number;
};

/**
 * `EXPORT_PREFIX` altındaki object'leri listeler ve `lastModified` 7 günden
 * eski olanları siler.
 *
 * Best-effort: tek bir delete failure'ı pipeline'ı durdurmaz. Hata logger ile
 * raporlanır (warn level) ve loop devam eder.
 */
export async function cleanupExpiredExports(
  now: Date = new Date(),
): Promise<CleanupResult> {
  const storage = getStorage();
  const objects = await storage.list(EXPORT_PREFIX);
  const cutoff = now.getTime() - EXPORT_CLEANUP_AGE_MS;

  let deletedCount = 0;
  for (const obj of objects) {
    if (obj.lastModified.getTime() < cutoff) {
      try {
        await storage.delete(obj.key);
        deletedCount++;
        logger.info(
          { key: obj.key, lastModified: obj.lastModified },
          "export cleanup deleted",
        );
      } catch (err) {
        logger.warn(
          {
            key: obj.key,
            err: err instanceof Error ? err.message : String(err),
          },
          "export cleanup delete failed",
        );
        // Continue — best-effort cleanup, single failure pipeline'ı durdurmasın.
      }
    }
  }
  return { deletedCount, totalScanned: objects.length };
}
