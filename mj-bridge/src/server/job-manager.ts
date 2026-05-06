// Job manager — bridge job lifecycle ownership.
//
// State persistence:
//   - In-memory Map (hızlı GET /jobs/:id)
//   - JSONL append (data/jobs/{id}.log) — restart sonrası resume mümkün
//
// Concurrency:
//   - Pass 42 V1: 1 paralel job (tek browser, tek MJ oturumu).
//     Daha fazla queue üretilirse FIFO sırada bekler.
//   - Min interval: jobs arasında 10sn (Pass 41 doc §8.2 rate limit önleme).
//
// Driver çağrısı:
//   - Driver `executeJob` async; job manager `onProgress` callback'i yazma
//     işini üstlenir (in-memory mutate + JSONL append).
//   - Driver throw ederse job FAILED state.
//   - AbortSignal `cancelJob` ile tetiklenir.

import { randomUUID } from "node:crypto";
import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { BridgeDriver } from "../drivers/types.js";
import {
  isTerminal,
  type CreateJobRequest,
  type JobBlockReason,
  type JobSnapshot,
  type JobState,
} from "../types.js";

export type JobManagerConfig = {
  driver: BridgeDriver;
  jobLogDir: string;
  /** Aktif job için min başlangıç aralığı (rate limit önleme). */
  minJobIntervalMs?: number;
};

type InternalJob = JobSnapshot & {
  abort: AbortController;
};

export class JobManager {
  private jobs = new Map<string, InternalJob>();
  private queue: string[] = [];
  private currentJobId: string | null = null;
  private lastJobStartedAt = 0;
  private cfg: JobManagerConfig;

  constructor(cfg: JobManagerConfig) {
    this.cfg = cfg;
  }

  /** Yeni job enqueue + lifecycle başlatma. */
  async enqueue(request: CreateJobRequest): Promise<JobSnapshot> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const job: InternalJob = {
      id,
      state: "QUEUED",
      request,
      enqueuedAt: now,
      abort: new AbortController(),
    };
    this.jobs.set(id, job);
    this.queue.push(id);
    await this.appendLog(id, { type: "enqueued", at: now, request });

    // Async olarak worker'ı tetikle (caller HTTP cevabı bekleten kuyruğa
    // takılmasın).
    void this.tick();

    return this.snapshot(job);
  }

  /** Tek job snapshot. */
  get(id: string): JobSnapshot | null {
    const job = this.jobs.get(id);
    return job ? this.snapshot(job) : null;
  }

  /** Tüm jobs (admin liste için, en son N). */
  list(limit = 50): JobSnapshot[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => (a.enqueuedAt < b.enqueuedAt ? 1 : -1))
      .slice(0, limit)
      .map((j) => this.snapshot(j));
  }

  /** Job iptal — current ise abort, queued ise sil. */
  async cancel(id: string): Promise<JobSnapshot | null> {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (isTerminal(job.state)) return this.snapshot(job);

    job.abort.abort();
    job.state = "CANCELLED";
    job.finishedAt = new Date().toISOString();
    job.lastMessage = "Manuel iptal";
    this.queue = this.queue.filter((q) => q !== id);
    if (this.currentJobId === id) this.currentJobId = null;
    await this.appendLog(id, {
      type: "cancelled",
      at: job.finishedAt,
    });
    void this.tick();
    return this.snapshot(job);
  }

  /** Sayaçlar — health endpoint için. */
  counts() {
    let queued = 0;
    let running = 0;
    let blocked = 0;
    let completed = 0;
    let failed = 0;
    for (const j of this.jobs.values()) {
      switch (j.state) {
        case "QUEUED":
          queued++;
          break;
        case "OPENING_BROWSER":
        case "AWAITING_LOGIN":
        case "SUBMITTING_PROMPT":
        case "WAITING_FOR_RENDER":
        case "COLLECTING_OUTPUTS":
        case "DOWNLOADING":
        case "IMPORTING":
          running++;
          break;
        case "AWAITING_CHALLENGE":
          blocked++;
          break;
        case "COMPLETED":
          completed++;
          break;
        case "FAILED":
        case "CANCELLED":
          failed++;
          break;
      }
    }
    return { queued, running, blocked, completed, failed };
  }

  /** Worker tick — queue boş değilse ve currentJob yoksa bir sonrakini başlat. */
  private async tick(): Promise<void> {
    if (this.currentJobId !== null) return;
    if (this.queue.length === 0) return;

    // Rate limit — design doc §8.2 (10sn min interval).
    const minInterval = this.cfg.minJobIntervalMs ?? 10_000;
    const elapsed = Date.now() - this.lastJobStartedAt;
    if (this.lastJobStartedAt > 0 && elapsed < minInterval) {
      const waitMs = minInterval - elapsed;
      setTimeout(() => void this.tick(), waitMs);
      return;
    }

    const id = this.queue.shift()!;
    const job = this.jobs.get(id);
    if (!job || isTerminal(job.state)) {
      void this.tick();
      return;
    }
    this.currentJobId = id;
    this.lastJobStartedAt = Date.now();
    job.startedAt = new Date().toISOString();
    await this.appendLog(id, { type: "started", at: job.startedAt });

    try {
      await this.cfg.driver.executeJob(
        { id: job.id, request: job.request },
        (update) => {
          this.applyUpdate(job, update);
          void this.appendLog(id, {
            type: "progress",
            at: new Date().toISOString(),
            update,
          });
        },
        job.abort.signal,
      );
      // Driver dönerse ve state terminal değilse default COMPLETED — ama
      // driver'ın `onProgress({state: "COMPLETED"})` çağırması beklenir.
      if (!isTerminal(job.state)) {
        this.applyUpdate(job, { state: "COMPLETED" });
        await this.appendLog(id, {
          type: "auto-completed",
          at: new Date().toISOString(),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.applyUpdate(job, {
        state: "FAILED",
        blockReason: "internal-error",
        message: msg,
      });
      await this.appendLog(id, {
        type: "error",
        at: new Date().toISOString(),
        message: msg,
      });
    } finally {
      job.finishedAt = new Date().toISOString();
      this.currentJobId = null;
      void this.tick();
    }
  }

  private applyUpdate(
    job: InternalJob,
    update: {
      state: JobState;
      blockReason?: JobBlockReason;
      message?: string;
      mjJobId?: string;
      mjMetadata?: Record<string, unknown>;
      outputs?: JobSnapshot["outputs"];
    },
  ): void {
    job.state = update.state;
    if (update.blockReason !== undefined) job.blockReason = update.blockReason;
    if (update.message !== undefined) job.lastMessage = update.message;
    if (update.mjJobId !== undefined) job.mjJobId = update.mjJobId;
    if (update.mjMetadata !== undefined) job.mjMetadata = update.mjMetadata;
    if (update.outputs !== undefined) job.outputs = update.outputs;
  }

  private snapshot(job: InternalJob): JobSnapshot {
    // abort field'ını dışarı sızdırma — internal-only.
    const { abort: _, ...rest } = job;
    return rest;
  }

  private async appendLog(jobId: string, entry: object): Promise<void> {
    const file = join(this.cfg.jobLogDir, `${jobId}.log`);
    try {
      await mkdir(dirname(file), { recursive: true });
      await appendFile(file, JSON.stringify(entry) + "\n", "utf8");
    } catch (err) {
      // Log fail kritik değil — bridge çalışmaya devam etsin.
      // eslint-disable-next-line no-console
      console.warn("[mj-bridge] log append failed", jobId, err);
    }
  }
}
