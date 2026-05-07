// Pass 42 — Midjourney Web Bridge worker.
//
// Sözleşme (generate-variations.worker.ts emsali; provider polling pattern):
//   - JobType: MIDJOURNEY_BRIDGE
//   - Bridge'e enqueue earlier (createMidjourneyJob). Bu worker yalnız
//     polling'i yürütür: state senkronize, terminal'de finalize.
//   - Polling interval: 3sn (mock için yeterli; real driver MJ render
//     30-90sn olduğu için ortalama 10-30 poll).
//   - Hard timeout: 8 dakika (MJ render + manuel intervention payı).
//     Aşılırsa MJ job FAILED + blockReason "render-timeout".
//
// Bridge unreachable: pollAndUpdate FAILED + blockReason "browser-crashed".

import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import {
  pollAndUpdate,
} from "@/server/services/midjourney/midjourney.service";

export type MidjourneyBridgeJobPayload = {
  userId: string;
  midjourneyJobId: string;
  jobId: string; // EtsyHub Job entity id (bullJobId crosslink)
  /**
   * Pass 60 — Upscale lineage. createMidjourneyUpscaleJob bunu set eder;
   * generate akışında undefined. `pollAndUpdate` → `ingestOutputs`'a
   * iletilir; orada yeni MidjourneyAsset.parentAssetId + variantKind=UPSCALE
   * yazılır.
   */
  upscaleParentAssetId?: string;
};

const POLL_INTERVAL_MS = 3000;
const POLL_MAX = 160; // 8 dakika

export async function handleMidjourneyBridge(
  job: Job<MidjourneyBridgeJobPayload>,
): Promise<void> {
  const { userId, midjourneyJobId, jobId } = job.data;
  logger.info(
    { userId, midjourneyJobId, jobId, bullJobId: job.id },
    "midjourney bridge worker start",
  );

  // BullMQ job → EtsyHub Job link.
  // Pass 51 — `bullJobId` Job tablosunda unique; BullMQ ID'leri ise
  // queue-scoped ("1", "2"…) dolayısıyla cross-queue collision olur.
  // `${queueName}:${job.id}` ile global unique yapıyoruz.
  const compositeBullId = `${job.queueName}:${job.id}`;
  await db.job.update({
    where: { id: jobId },
    data: { bullJobId: compositeBullId, startedAt: new Date() },
  });

  for (let attempt = 0; attempt < POLL_MAX; attempt++) {
    // Worker abort'a duyarlı — BullMQ token-based cancellation V1'de yok.
    // Pass 60 — upscaleParentAssetId payload'dan iletilir; ingestOutputs
    // upscale-aware (variantKind=UPSCALE + parentAssetId).
    const result = await pollAndUpdate(
      midjourneyJobId,
      undefined,
      job.data.upscaleParentAssetId,
    );
    if (result.isTerminal) {
      logger.info(
        { midjourneyJobId, finalState: result.state, attempts: attempt + 1 },
        "midjourney bridge worker finished",
      );
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  // Timeout — terminal state'e ulaşmadı.
  logger.warn(
    { midjourneyJobId, attempts: POLL_MAX },
    "midjourney bridge worker timeout",
  );
  await db.midjourneyJob.update({
    where: { id: midjourneyJobId },
    data: {
      state: "FAILED",
      blockReason: "render-timeout",
      failedReason: `${POLL_MAX} polling iterations × ${POLL_INTERVAL_MS}ms — bridge yanıt vermedi`,
      failedAt: new Date(),
    },
  });
  await db.job.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      error: "Worker timeout — bridge state ilerlemedi",
      finishedAt: new Date(),
    },
  });
}
