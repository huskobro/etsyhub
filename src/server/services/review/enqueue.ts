// IA-29 (CLAUDE.md Madde V + T) — REVIEW_DESIGN enqueue helper.
//
// Önceki davranış: `enqueue(JobType.REVIEW_DESIGN, ...)` SADECE BullMQ'ya
// yazıyordu; `db.job` tablosuna row INSERT etmiyordu. Lifecycle resolver
// (`resolveReviewLifecycle`) `db.job.findMany` ile arıyor → bulamıyor →
// "not_queued" döndürüyordu. UI'da "Not queued yet" yalan; ops dashboard
// sayaçları sıfır.
//
// Bu helper iki tarafı atomik bağlar:
//   1. `db.job.create` → lifecycle truth (queued/running/ready/failed)
//   2. `enqueue(JobType.REVIEW_DESIGN, ...)` → worker pickup
//
// Worker zaten Job.status'ü running→success/failed olarak güncelliyor
// (review-design.worker.ts başlatma yok; bullmq lifecycle event'leri
// `bootstrap.ts`'te Job row update'leyen handler'a bağlı).
//
// Idempotent değil — caller zaten already-scored guard'la kontrol ediyor.

import { JobStatus, JobType, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { enqueue } from "@/server/queue";

export type ReviewDesignScope =
  | { scope: "design"; generatedDesignId: string }
  | { scope: "local"; localAssetId: string; productTypeKey: string };

export async function enqueueReviewDesign(args: {
  userId: string;
  payload: ReviewDesignScope;
}): Promise<{ jobId: string }> {
  const { userId, payload } = args;
  const metadata: Prisma.InputJsonValue =
    payload.scope === "design"
      ? { generatedDesignId: payload.generatedDesignId, scope: "design" }
      : {
          localAssetId: payload.localAssetId,
          productTypeKey: payload.productTypeKey,
          scope: "local",
        };

  const job = await db.job.create({
    data: {
      userId,
      type: JobType.REVIEW_DESIGN,
      status: JobStatus.QUEUED,
      metadata,
    },
    select: { id: true },
  });

  await enqueue(
    JobType.REVIEW_DESIGN,
    payload.scope === "design"
      ? {
          scope: "design" as const,
          generatedDesignId: payload.generatedDesignId,
          userId,
          jobId: job.id,
        }
      : {
          scope: "local" as const,
          localAssetId: payload.localAssetId,
          productTypeKey: payload.productTypeKey,
          userId,
          jobId: job.id,
        },
  );
  return { jobId: job.id };
}
