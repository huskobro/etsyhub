// Phase 8 Task 7 — Mockup render worker (BullMQ).
//
// Sözleşme (Spec §2.3 + §7.5):
//   - JobType: MOCKUP_RENDER (Phase 8 Task 7 partial'da eklendi).
//   - Lifecycle: PENDING → RENDERING → SUCCESS/FAILED.
//   - Status transition: ilk render başladığında recomputeJobStatus
//     QUEUED → RUNNING; tüm render'lar terminal olduğunda aggregate
//     roll-up (Task 6).
//   - Cancellation race: cancelJob (Task 6) render'ları FAILED'a çeker
//     + queue'dan WAITING/DELAYED kaldırır; ACTIVE worker dequeue ettikten
//     sonra job.status === "CANCELLED" görürse no-op döner.
//
// Sharp render Task 9-10'da gerçek implementation alacak; şu an
// localSharpProvider.render() NOT_IMPLEMENTED throw eder. Worker bu throw'u
// yakalayıp errorClass: "PROVIDER_DOWN" ile FAILED'a çeker (Task 11'de
// tam classifier eklenir; şimdilik minimal switch).
//
// Phase 7 emsali: src/server/workers/selection-export.worker.ts (handler
// export pattern, payload Zod parse, BullMQ Job<T> tip), bootstrap.ts'e
// kayıt edilir.

import type { Job } from "bullmq";
import { z } from "zod";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { getProvider } from "@/providers/mockup";
import type {
  RenderInput,
  RenderOutput,
  RenderSnapshot,
} from "@/providers/mockup";
import { recomputeJobStatus } from "@/features/mockups/server/job.service";
import { recomputePackOnRenderComplete } from "@/features/mockups/server/pack-selection.service";
import { classifyRenderError } from "@/features/mockups/server/error-classifier.service";
import type { MockupRenderJobPayload } from "@/jobs/mockup-render.config";

// ────────────────────────────────────────────────────────────
// Payload sözleşmesi
// ────────────────────────────────────────────────────────────

const PayloadSchema = z.object({
  renderId: z.string().min(1),
});

// ────────────────────────────────────────────────────────────
// Error classifier — Task 11'de dedicated service'e taşındı
// ────────────────────────────────────────────────────────────

/**
 * Hata sınıflandırması Task 11'de
 * `@/features/mockups/server/error-classifier.service`'e taşındı (Spec §7.1
 * tam 5-class: TEMPLATE_INVALID / RENDER_TIMEOUT / SOURCE_QUALITY /
 * SAFE_AREA_OVERFLOW / PROVIDER_DOWN). Worker doğrudan service'i import
 * eder; mevcut worker testleri için backward-compat re-export aşağıda.
 */
export { classifyRenderError };

// ────────────────────────────────────────────────────────────
// Worker handler
// ────────────────────────────────────────────────────────────

/**
 * BullMQ MOCKUP_RENDER handler — tek render execution.
 *
 * Pipeline:
 *   1. Payload Zod parse
 *   2. Render fetch (job + variant relations)
 *   3. Job CANCELLED guard (Task 6 race koruması)
 *   4. Status PENDING → RENDERING + startedAt + recomputeJobStatus
 *      (QUEUED → RUNNING transition)
 *   5. Provider render çağrısı (localSharpProvider Task 9-10'da gerçek)
 *   6. SUCCESS: outputKey + thumbnailKey + completedAt
 *      FAILED: errorClass + errorDetail + completedAt
 *   7. recomputeJobStatus (aggregate roll-up; tüm render terminal'se
 *      job COMPLETED/PARTIAL_COMPLETE/FAILED)
 *
 * Failure path: provider throw → errorClass classify → DB update.
 * Worker DB write hatası ise BullMQ FAILED state (job.status DB'de
 * RENDERING kalır; recomputeJobStatus aggregate'i etkilenmez çünkü
 * non-terminal render). Bu kabul edilebilir; manuel retry Task 18'de
 * render service tarafında çözülür.
 */
export async function handleMockupRender(
  job: Job<MockupRenderJobPayload>,
): Promise<void> {
  // 1) Payload Zod parse — boş renderId → ZodError throw.
  const { renderId } = PayloadSchema.parse(job.data);

  // 2) Render + job fetch.
  const render = await db.mockupRender.findUniqueOrThrow({
    where: { id: renderId },
    include: { job: true },
  });

  // 3) Job CANCELLED guard — cancelJob (Task 6) race koruması.
  if (render.job.status === "CANCELLED") {
    logger.info(
      { renderId, jobId: render.jobId },
      "mockup render skipped (job CANCELLED)",
    );
    return;
  }

  // Variant + assets ayrı fetch (relation include 2-step, Phase 7 emsali).
  // Asset key fallback: editedAsset varsa o, yoksa sourceAsset (Task 5
  // resolveAssetKey emsali).
  const variant = await db.selectionItem.findUniqueOrThrow({
    where: { id: render.variantId },
    include: {
      sourceAsset: true,
      editedAsset: true,
      generatedDesign: true,
    },
  });
  const designKey =
    variant.editedAsset?.storageKey ?? variant.sourceAsset.storageKey;

  // 4) PENDING → RENDERING + startedAt.
  await db.mockupRender.update({
    where: { id: renderId },
    data: {
      status: "RENDERING",
      startedAt: new Date(),
    },
  });

  // recomputeJobStatus (QUEUED → RUNNING transition; Task 6).
  await recomputeJobStatus(render.jobId);

  // 5) Provider render çağrısı.
  try {
    const snapshot = render.templateSnapshot as unknown as RenderSnapshot;
    const provider = getProvider(snapshot.providerId);

    const input: RenderInput = {
      renderId,
      // V1: storageKey direkt (storage URL signing render() içinde hallolur).
      designUrl: designKey,
      designAspectRatio: variant.generatedDesign.aspectRatio ?? "2:3",
      snapshot,
      // 60s cap defense-in-depth (Spec §7.1 RENDER_TIMEOUT).
      signal: AbortSignal.timeout(60_000),
    };

    const output: RenderOutput = await provider.render(input);

    // 6a) SUCCESS.
    await db.mockupRender.update({
      where: { id: renderId },
      data: {
        status: "SUCCESS",
        outputKey: output.outputKey,
        thumbnailKey: output.thumbnailKey,
        completedAt: new Date(),
      },
    });

    logger.info(
      { renderId, jobId: render.jobId, outputKey: output.outputKey },
      "mockup render completed",
    );
  } catch (err) {
    // 6b) FAILED + classify.
    const errorClass = classifyRenderError(err);
    const errorDetail = err instanceof Error ? err.message : String(err);

    await db.mockupRender.update({
      where: { id: renderId },
      data: {
        status: "FAILED",
        errorClass,
        errorDetail,
        completedAt: new Date(),
      },
    });

    logger.warn(
      {
        renderId,
        jobId: render.jobId,
        errorClass,
        errorDetail,
      },
      "mockup render failed",
    );
  }

  // 7) Cover-fail fallback (K10 — review-2 gözlemi).
  //    Cover render kendisi FAILED ise atomic slot swap yap (yeni cover =
  //    ilk success render). recomputeJobStatus'tan ÖNCE çağrılmalı çünkü
  //    swap durumunda coverRenderId değişiyor; aggregate hesabı sırasında
  //    bu değişiklik tutarlı olmalı. Idempotent.
  await recomputePackOnRenderComplete(render.jobId);

  // 8) Aggregate roll-up (Task 6).
  await recomputeJobStatus(render.jobId);
}
