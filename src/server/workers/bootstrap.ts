import { Worker } from "bullmq";
import { JobType } from "@prisma/client";
import { connection, scheduleRepeatJob } from "@/server/queue";
import { logger } from "@/lib/logger";
import { handleAssetIngestFromUrl } from "./asset-ingest.worker";
import { handleGenerateThumbnail } from "./thumbnail.worker";
import { handleBookmarkPreviewMetadata } from "./bookmark-preview.worker";
import { handleScrapeCompetitor } from "./scrape-competitor.worker";
import { handleFetchNewListings } from "./fetch-new-listings.worker";
import { handleTrendClusterUpdate } from "./trend-cluster-update.worker";
import { handleScanLocalFolder } from "./scan-local-folder.worker";
import { handleGenerateVariations } from "./generate-variations.worker";
import { handleReviewDesign } from "./review-design.worker";
import { handleSelectionEditRemoveBackground } from "./selection-edit.worker";
import { handleSelectionExport } from "./selection-export.worker";
import { handleSelectionExportCleanup } from "./selection-export-cleanup.worker";
import { handleMockupRender } from "./mockup-render.worker";
import { handleMagicEraser } from "./magic-eraser.worker";
import { handleMidjourneyBridge } from "./midjourney-bridge.worker";

/** Günlük FETCH_NEW_LISTINGS repeat için sabit scheduler ID. */
export const FETCH_NEW_LISTINGS_SCHEDULE_ID = "fetch-new-listings-daily";
/** Cron: her gün UTC 06:00. */
export const FETCH_NEW_LISTINGS_CRON = "0 6 * * *";

/** Phase 7 Task 13 — günlük SELECTION_EXPORT_CLEANUP repeat scheduler ID. */
export const SELECTION_EXPORT_CLEANUP_SCHEDULE_ID =
  "selection-export-cleanup-daily";
/**
 * Cron: her gün UTC 04:00. FETCH_NEW_LISTINGS (UTC 06:00)'den 2 saat önce —
 * gün başında storage temizliği FETCH'e zarar vermez (bağımsız subsystem).
 */
export const SELECTION_EXPORT_CLEANUP_CRON = "0 4 * * *";

export async function startWorkers() {
  const specs = [
    { name: JobType.ASSET_INGEST_FROM_URL, handler: handleAssetIngestFromUrl },
    { name: JobType.GENERATE_THUMBNAIL, handler: handleGenerateThumbnail },
    { name: JobType.BOOKMARK_PREVIEW_METADATA, handler: handleBookmarkPreviewMetadata },
    { name: JobType.SCRAPE_COMPETITOR, handler: handleScrapeCompetitor },
    { name: JobType.FETCH_NEW_LISTINGS, handler: handleFetchNewListings },
    { name: JobType.TREND_CLUSTER_UPDATE, handler: handleTrendClusterUpdate },
    { name: JobType.SCAN_LOCAL_FOLDER, handler: handleScanLocalFolder },
    { name: JobType.GENERATE_VARIATIONS, handler: handleGenerateVariations },
    { name: JobType.REVIEW_DESIGN, handler: handleReviewDesign },
    // Phase 7 Task 10 — selection edit heavy op (bg-remove). Concurrency 2:
    // bg-remove imgly model inference CPU-heavy, item-level DB lock paralel
    // güvenliği sağlar.
    { name: JobType.REMOVE_BACKGROUND, handler: handleSelectionEditRemoveBackground },
    // Phase 7 Task 12 — selection ZIP export. Concurrency 2: CPU+I/O karışık
    // (storage download + archiver + storage upload). Set-level DB update
    // yalnız completed anında; aynı set için iki paralel job'da son
    // tamamlanan'ın lastExportedAt'i yazar (race koruması yok — sadece
    // metadata; veri kaybı yaratmaz).
    { name: JobType.EXPORT_SELECTION_SET, handler: handleSelectionExport },
    // Phase 7 Task 13 — selection export ZIP cleanup. Concurrency 1: cleanup
    // serileştirilir (paralel iki run race yaratmasın). Daily UTC 04:00 cron.
    {
      name: JobType.SELECTION_EXPORT_CLEANUP,
      handler: handleSelectionExportCleanup,
    },
    // Phase 8 Task 7 — mockup render worker. Concurrency 2: Sharp render
    // CPU+I/O karışık (Phase 7 selection-export ve selection-edit emsali);
    // per-render attempts=1 (Spec §7.2 auto-retry yok), 60s timeout cap
    // AbortSignal worker tarafında.
    { name: JobType.MOCKUP_RENDER, handler: handleMockupRender },
    // Pass 29 — Magic Eraser inpainting worker. Concurrency 1:
    // Python LaMa subprocess RAM-heavy (4096×4096 ~1-2GB peak) + cold
    // start ~5-15s. Daha fazla concurrency OOM riski yaratır;
    // serileştirme güvenli.
    { name: JobType.MAGIC_ERASER_INPAINT, handler: handleMagicEraser },
    // Pass 42 — Midjourney Web Bridge polling worker. Concurrency 1:
    // bridge tek browser + tek MJ oturumu ile çalışır; paralel polling
    // worker'lar bridge'i strain etmez ama gereksiz (her job kendi
    // bridgeJobId'si ile zaten ayrı).
    { name: JobType.MIDJOURNEY_BRIDGE, handler: handleMidjourneyBridge },
  ] as const;

  for (const s of specs) {
    // Concurrency: GENERATE_VARIATIONS provider HTTP I/O bound — kullanıcı 6 görsele
    // kadar paralel kuyruk açabilir (R17.4); REVIEW_DESIGN paralel Gemini HTTP
    // çağrıları için 4; FETCH_NEW_LISTINGS daily repeat, serileştirilir;
    // geri kalan default 2.
    //
    // BullMQ retry: blanket retry policy YOK (Worker default 1 attempt).
    // Permanent error'lar (api key yok, image too large, Zod fail) tek seferde
    // fail; transient retry (429/503) ayrı follow-up'a bırakıldı.
    const concurrency =
      s.name === JobType.FETCH_NEW_LISTINGS
        ? 1
        : s.name === JobType.SELECTION_EXPORT_CLEANUP
          ? 1
          : // Pass 29 — magic-eraser concurrency 1 (Python LaMa RAM-heavy + cold start).
            s.name === JobType.MAGIC_ERASER_INPAINT
            ? 1
            : s.name === JobType.GENERATE_VARIATIONS
              ? 4
              : s.name === JobType.REVIEW_DESIGN
                ? 4
                : 2;
    const worker = new Worker(s.name, s.handler as unknown as (job: unknown) => Promise<unknown>, {
      connection,
      concurrency,
    });
    worker.on("failed", (job, err) => {
      logger.error({ job: job?.id, name: s.name, err: err?.message }, "job failed");
    });
    worker.on("completed", (job) => {
      logger.info({ job: job.id, name: s.name }, "job completed");
    });
  }

  // Repeat scheduler: test ortamında Redis'e yazmaktan kaçın.
  if (process.env.NODE_ENV !== "test") {
    try {
      const result = await scheduleRepeatJob(
        JobType.FETCH_NEW_LISTINGS,
        {},
        {
          jobId: FETCH_NEW_LISTINGS_SCHEDULE_ID,
          pattern: FETCH_NEW_LISTINGS_CRON,
        },
      );
      logger.info(
        {
          jobId: FETCH_NEW_LISTINGS_SCHEDULE_ID,
          pattern: FETCH_NEW_LISTINGS_CRON,
          alreadyScheduled: result.alreadyScheduled,
        },
        "FETCH_NEW_LISTINGS repeat scheduler kaydedildi",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      logger.error(
        { err: message },
        "FETCH_NEW_LISTINGS repeat scheduler kaydedilemedi",
      );
    }

    // Phase 7 Task 13 — günlük SELECTION_EXPORT_CLEANUP repeat scheduler.
    try {
      const result = await scheduleRepeatJob(
        JobType.SELECTION_EXPORT_CLEANUP,
        {},
        {
          jobId: SELECTION_EXPORT_CLEANUP_SCHEDULE_ID,
          pattern: SELECTION_EXPORT_CLEANUP_CRON,
        },
      );
      logger.info(
        {
          jobId: SELECTION_EXPORT_CLEANUP_SCHEDULE_ID,
          pattern: SELECTION_EXPORT_CLEANUP_CRON,
          alreadyScheduled: result.alreadyScheduled,
        },
        "SELECTION_EXPORT_CLEANUP repeat scheduler kaydedildi",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      logger.error(
        { err: message },
        "SELECTION_EXPORT_CLEANUP repeat scheduler kaydedilemedi",
      );
    }
  }

  logger.info({ active: specs.map((s) => s.name) }, "workers started");
}
