// GENERATE_VARIATIONS worker — Phase 5 §2.3, §4.5
//
// Sözleşme (R15, R17.4):
//   - 1 design = 1 job (paralel kuyruk üst katmanda; user 3 görsel istediyse 3 job)
//   - State: QUEUED → PROVIDER_PENDING → PROVIDER_RUNNING → SUCCESS|FAIL
//   - 3sn polling, 6dk hard timeout (terminal FAIL — partial success YOK)
//   - Otomatik retry YOK; manuel "Yeniden Dene" yeni job açar (Task 11+)
//   - GeneratedDesign create burada DEĞİL — Task 11 route'unda yapılır
//   - Worker yalnız UPDATE eder; promptSnapshot/briefSnapshot/capabilityUsed dokunulmaz
//   - providerTaskId + PROVIDER_RUNNING tek atomic update (race koruması)
//   - Job.error ve design.errorMessage üç fail dalında AYNI string taşır
//     (debugging için tek truth)
//
// Phase 5 closeout hotfix (2026-04-29):
//   - Per-user `kieApiKey` payload'a eklendi (settings-aware).
//   - Provider çağrıları `{ apiKey: payload.kieApiKey }` ile yapılır;
//     env var bağımlılığı kalktı.
//   - Phase 6 review provider ile simetrik pattern.
//
// Phase 6+ carry-forward:
//   - Provider trace metadata (poll attempt count, latency)
//   - Queue payload encryption (BullMQ Redis plain text — Phase 7+ hardening)
import type { Job } from "bullmq";
import { JobStatus, JobType, ProviderKind, VariationState } from "@prisma/client";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { enqueueReviewDesign } from "@/server/services/review/enqueue";
import { getResolvedReviewConfig } from "@/server/services/settings/review.service";
import { getImageProvider } from "@/providers/image/registry";
import type { ImageGenerateInput } from "@/providers/image/types";
import { notifyUser } from "@/server/services/settings/notifications-inbox.service";

export type GenerateVariationsPayload = {
  jobId: string;
  userId: string;
  designId: string;
  providerId: string;
  prompt: string;
  referenceUrls?: string[];
  aspectRatio: ImageGenerateInput["aspectRatio"];
  quality?: "medium" | "high";
  /**
   * Per-user encrypted KIE API key — service katmanı `getUserAiModeSettings`
   * üzerinden decrypt'leyip payload'a koyar (Phase 5 closeout hotfix). Worker
   * provider'a `{ apiKey }` olarak geçer. Boş string YASAK; service tarafı
   * eksik key durumunda enqueue ÖNCE explicit throw eder.
   */
  kieApiKey: string;
};

const POLL_INTERVAL_MS = 3000;
const POLL_MAX = 120; // 6 dakika

export async function handleGenerateVariations(
  job: Job<GenerateVariationsPayload>,
): Promise<void> {
  const {
    jobId,
    designId,
    providerId,
    prompt,
    referenceUrls,
    aspectRatio,
    quality,
    kieApiKey,
  } = job.data;
  const provider = getImageProvider(providerId);

  await db.job.update({
    where: { id: jobId },
    data: { status: JobStatus.RUNNING, startedAt: new Date() },
  });
  await db.generatedDesign.update({
    where: { id: designId },
    data: { state: VariationState.PROVIDER_PENDING },
  });

  let providerTaskId: string;
  try {
    const out = await provider.generate(
      { prompt, referenceUrls, aspectRatio, quality },
      { apiKey: kieApiKey },
    );
    providerTaskId = out.providerTaskId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "provider generate failed";
    await failDesign(designId, jobId, msg);
    throw err;
  }

  // ATOMIC: providerTaskId ve PROVIDER_RUNNING tek update — race koruması.
  // ASLA bu sırayı bölme (önce providerTaskId, sonra ayrı state update YOK).
  await db.generatedDesign.update({
    where: { id: designId },
    data: { providerTaskId, state: VariationState.PROVIDER_RUNNING },
  });

  for (let i = 0; i < POLL_MAX; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const r = await provider.poll(providerTaskId, { apiKey: kieApiKey });
    if (r.state === VariationState.SUCCESS) {
      await db.generatedDesign.update({
        where: { id: designId },
        data: {
          state: VariationState.SUCCESS,
          resultUrl: r.imageUrls?.[0] ?? null,
        },
      });
      await db.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.SUCCESS,
          progress: 100,
          finishedAt: new Date(),
        },
      });

      // R10 — CostUsage write (KIE midjourney baseline 24¢/call).
      // Best-effort; CostUsage hatası variation success'i geri almaz.
      try {
        await db.costUsage.create({
          data: {
            userId: job.data.userId,
            providerKind: ProviderKind.AI,
            providerKey: "kie",
            model: "kie/midjourney-v7",
            jobId,
            units: 1,
            costCents: 24,
            periodKey: new Date().toISOString().slice(0, 7),
          },
        });
      } catch (err) {
        logger.warn(
          {
            jobId,
            err: (err as Error).message,
          },
          "variation CostUsage write failed (non-fatal)",
        );
      }

      // R10 — notifications inbox dispatch (preference-aware).
      // Best-effort; notifyUser dahili try/catch'lı.
      await notifyUser({
        userId: job.data.userId,
        kind: "batchCompleted",
        title: "Variation generated",
        body: `Design ${designId.slice(0, 8)} ready · ${r.imageUrls?.[0] ? "image cached" : "no preview"}`,
        href: `/library?days=recent`,
      }).catch(() => undefined);

      // Phase 6 Task 9 — auto-enqueue REVIEW_DESIGN.
      //
      // IA-39 (CLAUDE.md Madde U): automation.aiAutoEnqueue flag'i
      // admin panel'inde toggle edilebilir. Disabled ise enqueue yapılmaz;
      // design not_queued / auto_enqueue_disabled olarak kalır.
      //
      // Cross-job rollback YASAK (kullanıcı kararı): variation generation
      // SUCCESS olarak commit'lendi; review enqueue hatası variation'ı geri
      // almaz. Hata olursa design.reviewStatus PENDING/SYSTEM (default)
      // olarak kalır. Carry-forward: review-enqueue-recovery /
      // missing-review-job-backfill (Task 19+).
      try {
        const reviewConfig = await getResolvedReviewConfig(job.data.userId);
        if (!reviewConfig.automation.aiAutoEnqueue) {
          logger.info(
            { designId, userId: job.data.userId },
            "review auto-enqueue skipped: aiAutoEnqueue disabled in Settings → Review",
          );
        } else {
          // IA-29 — central helper writes db.job row + BullMQ enqueue
          // atomically so lifecycle UI gets truthy queued/running/ready.
          await enqueueReviewDesign({
            userId: job.data.userId,
            payload: { scope: "design", generatedDesignId: designId },
          });
        }
      } catch (enqueueErr) {
        logger.error(
          {
            designId,
            userId: job.data.userId, // multi-tenant log filtresi (CLAUDE.md ilkesi)
            jobId,
            err:
              enqueueErr instanceof Error
                ? enqueueErr.message
                : String(enqueueErr),
          },
          "review auto-enqueue failed; design stays PENDING/SYSTEM",
        );
        // Variation generation SUCCESS olarak kalır — throw YOK.
      }
      return;
    }
    if (r.state === VariationState.FAIL) {
      await failDesign(designId, jobId, r.error ?? "provider failed");
      return;
    }
    // PROVIDER_PENDING / PROVIDER_RUNNING → continue polling
  }

  await failDesign(designId, jobId, "polling timeout");
}

async function failDesign(designId: string, jobId: string, msg: string): Promise<void> {
  // Job.error ve design.errorMessage AYNI mesaj — debugging tek truth.
  const design = await db.generatedDesign.update({
    where: { id: designId },
    data: { state: VariationState.FAIL, errorMessage: msg },
  });
  await db.job.update({
    where: { id: jobId },
    data: { status: JobStatus.FAILED, error: msg, finishedAt: new Date() },
  });
  // R10 — notifications inbox (batchFailed preference).
  await notifyUser({
    userId: design.userId,
    kind: "batchFailed",
    title: "Variation failed",
    body: `Design ${designId.slice(0, 8)} · ${msg.slice(0, 80)}`,
    href: `/batches`,
  }).catch(() => undefined);
}
