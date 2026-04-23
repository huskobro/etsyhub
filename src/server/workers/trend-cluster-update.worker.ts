import { JobStatus } from "@prisma/client";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { recomputeTrendClustersForUser } from "@/features/trend-stories/services/cluster-service";

export type TrendClusterUpdatePayload = {
  jobId: string;
  userId: string;
};

/**
 * TREND_CLUSTER_UPDATE job handler.
 *
 * Kullanıcıya ait tüm zaman pencerelerinde trend cluster'larını yeniden
 * hesaplar. Job durumu RUNNING → SUCCESS / FAILED olarak güncellenir.
 *
 * Handler doğrudan çağrılabilir (integration test için BullMQ round-trip
 * gerekmez) — `job.data` shape dışında BullMQ'ya bağımlı değildir.
 */
export async function handleTrendClusterUpdate(job: {
  data: TrendClusterUpdatePayload;
}): Promise<void> {
  const { jobId, userId } = job.data;

  await db.job.update({
    where: { id: jobId },
    data: { status: JobStatus.RUNNING, startedAt: new Date() },
  });

  try {
    await recomputeTrendClustersForUser(userId);

    await db.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.SUCCESS,
        finishedAt: new Date(),
        progress: 100,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    logger.error(
      { jobId, userId, err: message },
      "trend cluster update failed",
    );
    await db.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        finishedAt: new Date(),
        error: message,
      },
    });
    throw err;
  }
}
