import type { Job } from "bullmq";
import { logger } from "@/lib/logger";

export type AssetIngestPayload = {
  jobId: string;
  userId: string;
  sourceUrl: string;
};

export async function handleAssetIngestFromUrl(job: Job<AssetIngestPayload>) {
  logger.info({ jobId: job.data.jobId, url: job.data.sourceUrl }, "asset-ingest stub (Task 14'te dolacak)");
  return { stub: true };
}
