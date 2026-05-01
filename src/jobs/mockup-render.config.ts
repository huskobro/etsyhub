// Phase 8 Task 7 — BullMQ MOCKUP_RENDER job konfigürasyonu.
//
// Spec §7.5 (docs/plans/2026-05-01-phase8-mockup-studio-design.md):
//   attempts: 1            — auto-retry YOK (Spec §7.2). Manuel retry Task 18'de
//                            render service tarafından eklenir.
//   timeout: 60_000        — RENDER_TIMEOUT cap (Spec §7.1). Worker tarafında
//                            AbortSignal.timeout(60_000) ile defense-in-depth.
//   removeOnComplete: 100  — Son 100 başarılı job DB'de tutulur (debug/audit).
//   removeOnFail: 200      — Son 200 başarısız job DB'de tutulur (debug için
//                            daha uzun retention; failure analizi).
//
// Phase 7 emsali: src/server/queue.ts default removeOnComplete/Fail=1000;
// Phase 8 mockup render daha sık üretilir, daha küçük retention spec gereği.

export const MOCKUP_RENDER_JOB_OPTIONS = {
  attempts: 1,
  // BullMQ v5: timeout option JobsOptions üzerinde yok; AbortSignal worker
  // içinde sağlar. 60s cap worker tarafında garanti edilir.
  removeOnComplete: 100,
  removeOnFail: 200,
} as const;

/**
 * MOCKUP_RENDER job payload.
 *
 * Minimal: yalnız renderId; worker DB'den render + job + binding snapshot
 * çeker. Cross-call idempotency için BullMQ jobId = renderId set edilir
 * (aynı renderId için ikinci enqueue idempotent).
 */
export type MockupRenderJobPayload = {
  /** MockupRender.id — worker DB lookup için */
  renderId: string;
};
