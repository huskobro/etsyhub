import type { Job } from "bullmq";
import { logger } from "@/lib/logger";

export type BookmarkPreviewPayload = {
  jobId: string;
  bookmarkId: string;
};

export async function handleBookmarkPreviewMetadata(job: Job<BookmarkPreviewPayload>) {
  logger.info({ jobId: job.data.jobId, bookmarkId: job.data.bookmarkId }, "bookmark preview stub (Task 15+'da dolacak)");
  return { stub: true };
}
