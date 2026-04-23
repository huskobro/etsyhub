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

export async function enqueue<T extends Record<string, unknown>>(
  type: JobType,
  payload: T,
  opts?: { jobId?: string },
) {
  return queues[type].add(type, payload, {
    jobId: opts?.jobId,
    removeOnComplete: 1000,
    removeOnFail: 1000,
  });
}
