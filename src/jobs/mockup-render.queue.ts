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

// ────────────────────────────────────────────────────────────
// PHASE 8 TASK 6 STUB — Task 7'de BullMQ producer kaldırma çağrısıyla değişir.
//
// `cancelJob` (job.service.ts) bu fonksiyonu çağırır. DB-side render
// status'ları cancel transaction'ı içinde zaten FAILED'a çekildiği için
// kuyrukta kalan orphan job'lar daha fazla iş yapamaz (worker `findUnique`
// ile DB row'unu çeker, status FAILED görür ve no-op döner — Task 7'de
// worker invariant'ı bu yönde tasarlanacak). Yine de queue temizliği iyi
// hijyen; Task 7'de gerçek implementation:
//   - bullMQ queue.remove(jobId) ya da getJobs + remove döngüsü
//   - retry'ları cancel etmek için active/waiting set'lerini tara
// ────────────────────────────────────────────────────────────

/**
 * Belirtilen MockupJob'a ait kuyruktaki render iş kayıtlarını kaldırır
 * (best-effort). Cancel akışında çağrılır; DB-side status guard zaten
 * worker'ın no-op'a gitmesini sağlar.
 *
 * @param jobId - MockupJob.id
 */
export async function removeMockupRenderJobs(jobId: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[mockup-render-queue STUB] removeMockupRenderJobs job=${jobId}`);
}
