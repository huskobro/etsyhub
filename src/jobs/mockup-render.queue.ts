// Phase 8 Task 7 — MOCKUP_RENDER queue producer (gerçek BullMQ).
//
// Task 5+6'da stub idi (no-op log); Task 7'de central queue
// (src/server/queue.ts) üzerinden gerçek dispatch + cleanup.
//
// Phase 7 emsali: src/server/queue.ts central JobType-indexed Queue map.
// MOCKUP_RENDER enum'u Task 7 partial'da eklendi (commit 05835e8); queue
// otomatik registered.

import { JobType } from "@prisma/client";
import { queues } from "@/server/queue";
import { db } from "@/server/db";
import {
  MOCKUP_RENDER_JOB_OPTIONS,
  type MockupRenderJobPayload,
} from "./mockup-render.config";

/**
 * Task 5 handoff service N render için BullMQ job dispatch eder.
 *
 * Spec §3.4: her MockupRender için 1 BullMQ job (parallel-safe; attempts=1
 * Spec §7.2). BullMQ jobId = renderId — idempotent re-dispatch (aynı
 * renderId ikinci kez enqueue edilirse mevcut job kullanılır).
 */
export async function queueMockupRenderJobs(
  jobId: string,
  renderIds: string[],
): Promise<void> {
  // jobId arg debug/log için tutuluyor (worker DB'den render üzerinden
  // job'a ulaşır; payload'da gerek yok).
  void jobId;

  const queue = queues[JobType.MOCKUP_RENDER];
  await Promise.all(
    renderIds.map((renderId) =>
      queue.add(
        JobType.MOCKUP_RENDER,
        { renderId } satisfies MockupRenderJobPayload,
        {
          jobId: renderId,
          ...MOCKUP_RENDER_JOB_OPTIONS,
        },
      ),
    ),
  );
}

/**
 * Task 6 cancelJob çağırır: queue'da bekleyen render'ları best-effort kaldır.
 *
 * Render status FAILED'a cancelJob transaction'ında çekildi (errorClass=null,
 * kullanıcı eylemi). Worker zaten dequeue edince job.status === "CANCELLED"
 * gördüğünde no-op döner (race koruması Task 6 disiplini). Bu fonksiyon
 * yalnız WAITING/DELAYED job'ları temizler — ACTIVE worker'lar tamamlasın.
 */
export async function removeMockupRenderJobs(jobId: string): Promise<void> {
  const queue = queues[JobType.MOCKUP_RENDER];
  const renders = await db.mockupRender.findMany({
    where: { jobId },
    select: { id: true },
  });

  await Promise.all(
    renders.map(async (r) => {
      const job = await queue.getJob(r.id);
      if (!job) return;
      const state = await job.getState();
      if (state === "waiting" || state === "delayed") {
        await job.remove();
      }
    }),
  );
}
