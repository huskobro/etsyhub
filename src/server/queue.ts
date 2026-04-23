import { Queue } from "bullmq";
import IORedis from "ioredis";
import { JobType } from "@prisma/client";
import { env } from "@/lib/env";

export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const allJobTypes = Object.values(JobType);

export const queues = Object.fromEntries(
  allJobTypes.map((t) => [t, new Queue(t, { connection })]),
) as Record<JobType, Queue>;

export type EnqueueOptions = {
  jobId?: string;
  repeat?: { pattern: string };
};

/**
 * Tek seferlik iş kuyruğa alır. Repeat job için `scheduleRepeatJob` kullan.
 */
export async function enqueue<T extends Record<string, unknown>>(
  type: JobType,
  payload: T,
  opts?: EnqueueOptions,
) {
  return queues[type].add(type, payload, {
    jobId: opts?.jobId,
    repeat: opts?.repeat,
    removeOnComplete: 1000,
    removeOnFail: 1000,
  });
}

/**
 * BullMQ repeat job'ı idempotent şekilde programlar.
 *
 * Davranış:
 * - Aynı `jobId` + `pattern` kombinasyonu Queue'da zaten varsa hiçbir şey yapmaz
 *   (duplicate repeat meta engellenir).
 * - Yoksa yeni repeat entry oluşturur.
 * - `jobId` farklı değişmeyen (stable) olmalı; aynı scheduler uygulama
 *   açılışında birden fazla kez çağrılsa bile duplicate yaratmaz.
 */
export async function scheduleRepeatJob(
  type: JobType,
  payload: Record<string, unknown>,
  opts: { jobId: string; pattern: string },
) {
  const queue = queues[type];
  const existing = await queue.getRepeatableJobs();
  const match = existing.find(
    (r) => r.id === opts.jobId && r.pattern === opts.pattern,
  );
  if (match) {
    return { id: opts.jobId, alreadyScheduled: true as const };
  }
  const job = await queue.add(type, payload, {
    jobId: opts.jobId,
    repeat: { pattern: opts.pattern },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  });
  return { id: job.id ?? opts.jobId, alreadyScheduled: false as const };
}

/**
 * `jobId` ile programlanmış repeat entry'lerini temizler.
 * Bulamadığı jobId'leri sessizce atlar (idempotent).
 */
export async function cancelRepeatJob(
  type: JobType,
  jobId: string,
): Promise<boolean> {
  const queue = queues[type];
  const existing = await queue.getRepeatableJobs();
  const match = existing.find((r) => r.id === jobId);
  if (!match) return false;
  return queue.removeRepeatableByKey(match.key);
}
