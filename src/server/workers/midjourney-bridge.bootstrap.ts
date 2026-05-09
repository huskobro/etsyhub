// Pass 70 — MIDJOURNEY_BRIDGE worker lazy bootstrap.
//
// Pass 69 carry-over bug #1: `startWorkers` (src/server/workers/bootstrap.ts)
// hiçbir yerde çağrılmıyordu → kuyrukta birikme.
//
// İlk denemede Next.js 14 instrumentation hook'u kullanmaya çalıştım
// ama BullMQ + bridge handler'ı tarafından import edilen `node:crypto` /
// `node:path` modülleri webpack bundle'a alınıyor ve build kırılıyor.
// Çözüm: **lazy idempotent worker init** — service'in `createMjJob` ve
// `createMjDescribeJob` çağrılarının başında `ensureMidjourneyBridgeWorker()`.
//
// Avantajlar:
//   - Webpack bundle dışı (her API route Node runtime'da çalışır)
//   - Idempotent: ilk çağrıda Worker oluşturulur, sonrakilerde no-op
//   - Sadece kullanılan kod yolu tetikler (lazy)
//   - Diğer worker'lar (selection/mockup/magic-eraser) etkilenmez

import { Worker } from "bullmq";
import { JobType } from "@prisma/client";
import { connection } from "@/server/queue";
import { logger } from "@/lib/logger";
import { handleMidjourneyBridge } from "./midjourney-bridge.worker";

let started = false;

/**
 * MIDJOURNEY_BRIDGE worker'ını idempotent olarak başlatır. İlk çağrıda
 * Worker constructor'u çalıştırır + event handler'ları register eder;
 * sonraki çağrılarda no-op. Service `createMidjourneyJob` /
 * `createMidjourneyDescribeJob` başında çağrılır.
 */
export function ensureMidjourneyBridgeWorker(): void {
  if (started) return;
  started = true;

  // Concurrency 1 — bridge tek browser + tek MJ oturumu (Pass 42 nota).
  const worker = new Worker(
    JobType.MIDJOURNEY_BRIDGE,
    // BullMQ Worker generic'i with handler signature mismatch — runtime
    // güvenli (job.data shape worker tarafında zod-parse). `unknown` cast
    // explicit `any` yerine; @typescript-eslint plugin yüklü değil.
    handleMidjourneyBridge as unknown as (
      job: unknown,
    ) => Promise<unknown>,
    { connection, concurrency: 1 },
  );
  worker.on("failed", (job, err) => {
    logger.error(
      { job: job?.id, name: JobType.MIDJOURNEY_BRIDGE, err: err?.message },
      "MIDJOURNEY_BRIDGE job failed",
    );
  });
  worker.on("completed", (job) => {
    logger.info(
      { job: job.id, name: JobType.MIDJOURNEY_BRIDGE },
      "MIDJOURNEY_BRIDGE job completed",
    );
  });
  logger.info(
    { name: JobType.MIDJOURNEY_BRIDGE, concurrency: 1 },
    "MIDJOURNEY_BRIDGE worker started (lazy ensure)",
  );
}
