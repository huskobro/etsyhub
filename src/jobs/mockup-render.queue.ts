// PHASE 8 TASK 5 STUB — Task 7'de BullMQ producer ile değişir.
//
// Phase 7 emsali: src/server/queue.ts (BullMQ queues + enqueue helper).
// Task 7'de bu pattern Mockup-render queue için birebir uyarlanır
// (JobType.MOCKUP_RENDER enum + queue tanımı + worker).
//
// Şimdilik no-op log; render'ları PENDING durumda bırakır. Task 5 entegrasyon
// testleri queue dispatch'inin handoff'tan kopuk doğrulamasını yapar
// (DB row'ları yaratıldı + queueMockupRenderJobs çağrıldı).

/**
 * Mockup render job'larını render queue'sine dispatch eder.
 *
 * @param jobId - MockupJob.id
 * @param renderIds - MockupRender.id'leri (eager yaratılmış PENDING row'lar)
 *
 * Phase 7 emsali (export-selection-set.queue.ts):
 *   - jobId stable identifier; aynı id ile ikinci enqueue idempotent
 *   - render id'leri job payload içinde geçer; worker DB'den çeker
 *
 * Task 7 implementation kontratı:
 *   - BullMQ queue (`MOCKUP_RENDER` JobType)
 *   - per-render veya per-job dispatch (spec §5.x karara bağlı)
 *   - retry/backoff policy worker tarafında
 */
export async function queueMockupRenderJobs(
  jobId: string,
  renderIds: string[],
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(
    `[mockup-render-queue STUB] job=${jobId} renders=${renderIds.length}`,
  );
}
