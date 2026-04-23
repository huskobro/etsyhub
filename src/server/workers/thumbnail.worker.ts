import type { Job } from "bullmq";
import { logger } from "@/lib/logger";

export type ThumbnailPayload = {
  jobId: string;
  assetId: string;
};

export async function handleGenerateThumbnail(job: Job<ThumbnailPayload>) {
  logger.info({ jobId: job.data.jobId, assetId: job.data.assetId }, "thumbnail stub (Phase 2 sonrası genişletilir)");
  return { stub: true };
}
