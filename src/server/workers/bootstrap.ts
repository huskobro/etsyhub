import { Worker } from "bullmq";
import { JobType } from "@prisma/client";
import { connection } from "@/server/queue";
import { logger } from "@/lib/logger";
import { handleAssetIngestFromUrl } from "./asset-ingest.worker";
import { handleGenerateThumbnail } from "./thumbnail.worker";
import { handleBookmarkPreviewMetadata } from "./bookmark-preview.worker";
import { handleScrapeCompetitor } from "./scrape-competitor.worker";

export function startWorkers() {
  const specs = [
    { name: JobType.ASSET_INGEST_FROM_URL, handler: handleAssetIngestFromUrl },
    { name: JobType.GENERATE_THUMBNAIL, handler: handleGenerateThumbnail },
    { name: JobType.BOOKMARK_PREVIEW_METADATA, handler: handleBookmarkPreviewMetadata },
    { name: JobType.SCRAPE_COMPETITOR, handler: handleScrapeCompetitor },
  ] as const;

  for (const s of specs) {
    const worker = new Worker(s.name, s.handler as unknown as (job: unknown) => Promise<unknown>, {
      connection,
      concurrency: 2,
    });
    worker.on("failed", (job, err) => {
      logger.error({ job: job?.id, name: s.name, err: err?.message }, "job failed");
    });
    worker.on("completed", (job) => {
      logger.info({ job: job.id, name: s.name }, "job completed");
    });
  }

  logger.info({ active: specs.map((s) => s.name) }, "workers started");
}
