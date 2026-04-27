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

/** Günlük FETCH_NEW_LISTINGS repeat için sabit scheduler ID. */
export const FETCH_NEW_LISTINGS_SCHEDULE_ID = "fetch-new-listings-daily";
/** Cron: her gün UTC 06:00. */
export const FETCH_NEW_LISTINGS_CRON = "0 6 * * *";

export async function startWorkers() {
  const specs = [
    { name: JobType.ASSET_INGEST_FROM_URL, handler: handleAssetIngestFromUrl },
    { name: JobType.GENERATE_THUMBNAIL, handler: handleGenerateThumbnail },
    { name: JobType.BOOKMARK_PREVIEW_METADATA, handler: handleBookmarkPreviewMetadata },
    { name: JobType.SCRAPE_COMPETITOR, handler: handleScrapeCompetitor },
    { name: JobType.FETCH_NEW_LISTINGS, handler: handleFetchNewListings },
    { name: JobType.TREND_CLUSTER_UPDATE, handler: handleTrendClusterUpdate },
    { name: JobType.SCAN_LOCAL_FOLDER, handler: handleScanLocalFolder },
  ] as const;

  for (const s of specs) {
    const worker = new Worker(s.name, s.handler as unknown as (job: unknown) => Promise<unknown>, {
      connection,
      concurrency: s.name === JobType.FETCH_NEW_LISTINGS ? 1 : 2,
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
  }

  logger.info({ active: specs.map((s) => s.name) }, "workers started");
}
