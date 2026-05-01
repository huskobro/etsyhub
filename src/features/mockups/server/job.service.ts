// Phase 8 Task 6 — MockupJob state machine + aggregate roll-up.
//
// Spec §2.3 (docs/plans/2026-05-01-phase8-mockup-studio-design.md):
//   Job:    queued → running → (completed | partial_complete | failed | cancelled)
//   Render: pending → rendering → (success | failed)
//
// Bu modül iki public servis sağlar:
//
//   1. recomputeJobStatus(jobId)
//      Worker (Task 7) her render terminal'e geçtiğinde bu fonksiyonu
//      çağırır. Aggregate roll-up:
//        - CANCELLED kilidi (terminal)
//        - QUEUED → RUNNING transition (en az 1 render PENDING dışına çıkmış)
//        - Tüm render'lar terminal → COMPLETED / PARTIAL_COMPLETE / FAILED
//      Idempotent: aynı state'e tekrar set OK (DB write atlanır).
//
//   2. cancelJob(jobId, userId)
//      Kullanıcı eylemi. QUEUED/RUNNING'den CANCELLED'a tek atımlık geçiş.
//      Pending render'lar (PENDING + RENDERING) FAILED + errorClass:null
//      (kullanıcı eylemi sinyali). SUCCESS render output'ları MinIO'da kalır.
//      BullMQ best-effort kaldırma için Task 7 stub `removeMockupRenderJobs`.
//
// Hata disiplini (Phase 6/7 emsali — src/lib/errors.ts AppError extend):
//   - JobNotFoundError (404)        — yok veya cross-user (varlık sızıntısı yok)
//   - JobAlreadyTerminalError (409) — terminal job cancel girişimi

import type {
  MockupJob,
  MockupJobStatus,
  MockupRender,
  MockupRenderStatus,
  Prisma,
} from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { removeMockupRenderJobs } from "@/jobs/mockup-render.queue";

// ────────────────────────────────────────────────────────────
// Custom hata sınıfları
// ────────────────────────────────────────────────────────────

/** 404 — job yok veya cross-user (varlık sızıntısı yasak). */
export class JobNotFoundError extends AppError {
  constructor(message = "Mockup job bulunamadı") {
    super(message, "JOB_NOT_FOUND", 404);
  }
}

/** 409 — terminal job cancel edilemez (state conflict). */
export class JobAlreadyTerminalError extends AppError {
  constructor(message = "Job zaten terminal durumda; cancel edilemez") {
    super(message, "JOB_ALREADY_TERMINAL", 409);
  }
}

// ────────────────────────────────────────────────────────────
// State helpers (saf — DB'ye dokunmaz)
// ────────────────────────────────────────────────────────────

const TERMINAL_RENDER_STATUSES: ReadonlyArray<MockupRenderStatus> = [
  "SUCCESS",
  "FAILED",
];

const TERMINAL_JOB_STATUSES: ReadonlyArray<MockupJobStatus> = [
  "COMPLETED",
  "PARTIAL_COMPLETE",
  "FAILED",
  "CANCELLED",
];

export function isJobTerminal(status: MockupJobStatus): boolean {
  return TERMINAL_JOB_STATUSES.includes(status);
}

export function isRenderTerminal(status: MockupRenderStatus): boolean {
  return TERMINAL_RENDER_STATUSES.includes(status);
}

// ────────────────────────────────────────────────────────────
// recomputeJobStatus
// ────────────────────────────────────────────────────────────

/**
 * Aggregate roll-up: render terminal durumlarını topla, job status'u eşle.
 *
 * §2.3 kural sırası:
 *   1. Job CANCELLED ise → CANCELLED kalır (terminal lock; counter dokunmaz)
 *   2. Render'lar henüz hepsi terminal değil:
 *      - QUEUED + en az 1 render non-PENDING (RENDERING/SUCCESS/FAILED)
 *        → RUNNING transition + startedAt set
 *      - aksi halde mevcut status'u koru
 *   3. Tüm render'lar terminal (SUCCESS|FAILED):
 *      - successCount === total → COMPLETED
 *      - successCount === 0     → FAILED
 *      - else                   → PARTIAL_COMPLETE
 *      Bütün terminal yollarda completedAt set (idempotent — zaten set'se
 *      tekrar yazılmaz).
 *
 * Idempotent: hesaplanan state mevcut state ile birebir eşitse DB write
 * atlanır (worker bu fonksiyonu birden fazla kez çağırabilir).
 */
export async function recomputeJobStatus(
  jobId: string,
): Promise<MockupJobStatus> {
  const job = await db.mockupJob.findUnique({
    where: { id: jobId },
    include: { renders: true },
  });

  if (!job) throw new JobNotFoundError();

  // 1) CANCELLED terminal lock — geri dönüş yok, counter dokunmaz.
  if (job.status === "CANCELLED") return "CANCELLED";

  const total = job.renders.length;
  const successCount = job.renders.filter(
    (r: MockupRender) => r.status === "SUCCESS",
  ).length;
  const failCount = job.renders.filter(
    (r: MockupRender) => r.status === "FAILED",
  ).length;
  const terminalCount = successCount + failCount;
  const allTerminal = total > 0 && terminalCount === total;

  let nextStatus: MockupJobStatus = job.status;
  let nextStartedAt: Date | null = job.startedAt;
  let nextCompletedAt: Date | null = job.completedAt;

  if (!allTerminal) {
    // 2) Bazı render'lar henüz terminal değil → QUEUED→RUNNING transition kontrolü.
    const someStarted = job.renders.some(
      (r: MockupRender) => r.status !== "PENDING",
    );
    if (job.status === "QUEUED" && someStarted) {
      nextStatus = "RUNNING";
      nextStartedAt = job.startedAt ?? new Date();
    }
  } else {
    // 3) Aggregate roll-up — tüm render'lar terminal.
    if (successCount === total) {
      nextStatus = "COMPLETED";
    } else if (successCount === 0) {
      nextStatus = "FAILED";
    } else {
      nextStatus = "PARTIAL_COMPLETE";
    }
    nextCompletedAt = job.completedAt ?? new Date();
  }

  // Idempotent: hiçbir alan değişmediyse DB write atla.
  const dirty =
    nextStatus !== job.status ||
    successCount !== job.successRenders ||
    failCount !== job.failedRenders ||
    nextStartedAt !== job.startedAt ||
    nextCompletedAt !== job.completedAt;

  if (dirty) {
    await db.mockupJob.update({
      where: { id: jobId },
      data: {
        status: nextStatus,
        successRenders: successCount,
        failedRenders: failCount,
        startedAt: nextStartedAt,
        completedAt: nextCompletedAt,
      },
    });
  }

  return nextStatus;
}

// ────────────────────────────────────────────────────────────
// cancelJob
// ────────────────────────────────────────────────────────────

/**
 * Kullanıcı job'u iptal eder.
 *
 * §2.3:
 *   - Yalnız QUEUED veya RUNNING cancel edilebilir (terminal'se 409).
 *   - Pending render'lar (PENDING + RENDERING) FAILED'a geçer:
 *       errorClass: null  (kullanıcı eylemi, sistem hatası değil)
 *       errorDetail: "Kullanıcı tarafından iptal edildi"
 *   - SUCCESS render'lar dokunulmaz; output'ları MinIO'da kalır (kullanıcı
 *     geri dönüp kısmi sonuçlara erişebilir).
 *   - Job status → CANCELLED, completedAt = now.
 *   - Atomic transaction (renders + job birlikte ya hep ya hiç).
 *
 * Cross-user: JobNotFoundError (404 disiplini Phase 6/7 emsali — varlık
 * sızıntısı yasak; "var ama senin değil" ile "yok" istemciden ayırt edilemez).
 *
 * BullMQ kaldırma: Task 7 stub `removeMockupRenderJobs` çağrılır. DB-side
 * status'lar zaten FAILED'a çekildiği için kuyrukta artık iş yapamayan
 * orphan job'lar dururken sorun değil — best-effort cleanup.
 */
export async function cancelJob(jobId: string, userId: string): Promise<void> {
  const job = await db.mockupJob.findUnique({
    where: { id: jobId },
    select: { id: true, userId: true, status: true },
  });

  if (!job || job.userId !== userId) throw new JobNotFoundError();

  if (isJobTerminal(job.status)) {
    throw new JobAlreadyTerminalError(
      `Job zaten ${job.status} durumda; cancel edilemez`,
    );
  }

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Pending + Rendering → FAILED (kullanıcı eylemi, errorClass null).
    await tx.mockupRender.updateMany({
      where: { jobId, status: { in: ["PENDING", "RENDERING"] } },
      data: {
        status: "FAILED",
        errorClass: null,
        errorDetail: "Kullanıcı tarafından iptal edildi",
      },
    });

    // Job status → CANCELLED.
    await tx.mockupJob.update({
      where: { id: jobId },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
      },
    });
  });

  // BullMQ kaldırma (Task 7 stub şu an no-op log).
  await removeMockupRenderJobs(jobId);
}

// MockupJob ihracı — diğer servislerin tip referansı için.
export type { MockupJob };
