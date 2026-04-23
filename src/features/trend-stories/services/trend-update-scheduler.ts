import { JobType, JobStatus } from "@prisma/client";
import { db } from "@/server/db";
import { enqueue } from "@/server/queue";
import { logger } from "@/lib/logger";
import { DEBOUNCE_WINDOW_MS } from "@/features/trend-stories/constants";

/**
 * Task 7 itibarıyla TREND_CLUSTER_UPDATE worker'ı
 * src/server/workers/bootstrap.ts'e kayıt edildi.
 * Enqueue edilen job'lar artık worker tarafından işlenir.
 */

export type EnqueueResult =
  | { status: "enqueued"; jobId: string }
  | { status: "skipped"; reason: "active_job" | "debounced" };

/**
 * NOT: Bu fonksiyon check-then-act pattern kullanır — iki paralel çağrı aynı
 * userId için iki QUEUED job oluşturabilir (DB-level unique constraint yok).
 * MVP için kabul edilen risk; tek kullanıcılı localhost senaryosunda pratik
 * çakışma olası değil. Gerekirse ileride Job tablosuna partial unique index
 * veya advisory lock eklenebilir.
 *
 * Kullanıcı için TREND_CLUSTER_UPDATE job'ını kuyruğa alır.
 *
 * Debounce kuralları:
 * 1. QUEUED veya RUNNING aktif job varsa → skipped (active_job)
 * 2. Son 60sn içinde SUCCESS varsa → skipped (debounced)
 * 3. Aksi hâlde DB'ye job kaydı oluşturur ve BullMQ'ya enqueue eder.
 */
export async function enqueueTrendClusterUpdate(
  userId: string,
): Promise<EnqueueResult> {
  // 1. Aktif QUEUED/RUNNING var mı?
  const active = await db.job.findFirst({
    where: {
      userId,
      type: JobType.TREND_CLUSTER_UPDATE,
      status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] },
    },
    select: { id: true },
  });
  if (active) {
    logger.info({ userId }, "trend enqueue skipped: active job exists");
    return { status: "skipped", reason: "active_job" };
  }

  // 2. Son 60sn içinde SUCCESS var mı?
  const recent = await db.job.findFirst({
    where: {
      userId,
      type: JobType.TREND_CLUSTER_UPDATE,
      status: JobStatus.SUCCESS,
      finishedAt: { gte: new Date(Date.now() - DEBOUNCE_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (recent) {
    logger.info({ userId }, "trend enqueue skipped: debounced");
    return { status: "skipped", reason: "debounced" };
  }

  // 3. Enqueue
  const job = await db.job.create({
    data: {
      userId,
      type: JobType.TREND_CLUSTER_UPDATE,
      metadata: { trigger: "scheduler" },
    },
  });
  const bull = await enqueue(JobType.TREND_CLUSTER_UPDATE, {
    jobId: job.id,
    userId,
  });
  await db.job.update({
    where: { id: job.id },
    data: { bullJobId: bull.id ? String(bull.id) : null },
  });
  return { status: "enqueued", jobId: job.id };
}
