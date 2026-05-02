// Phase 8 Task 20 — cover.service.ts
//
// Spec §4.8: atomic slot swap, cover invariant (packPosition=0 ⇔ coverRenderId).
//
// Cover swap (not per-render swap):
//   - Two existing renders trade packPosition slots (atomic transaction)
//   - No new renders created
//   - job.coverRenderId updated (new cover id)
//   - Invariant: cover render always packPosition=0

import { db } from "@/server/db";
import { AppError } from "@/lib/errors";

// ────────────────────────────────────────────────────────────
// Custom error classes
// ────────────────────────────────────────────────────────────

export class InvalidRenderError extends AppError {
  constructor() {
    super("Render bu job'a ait değil", "INVALID_RENDER", 400);
  }
}

export class RenderNotSuccessError extends AppError {
  constructor() {
    super("Yalnız başarılı render cover olabilir", "RENDER_NOT_SUCCESS", 400);
  }
}

export class AlreadyCoverError extends AppError {
  constructor() {
    super("Bu render zaten cover", "ALREADY_COVER", 400);
  }
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

/**
 * Atomic cover swap: two renders trade packPosition slots.
 *
 * Invariant preservation:
 *   - Before: newCover.packPosition = X, oldCover.packPosition = 0
 *   - After:  newCover.packPosition = 0, oldCover.packPosition = X
 *   - job.coverRenderId = newCover.id (pointer update)
 *
 * Transaction (3-step):
 *   1. oldCover → newCover's old position
 *   2. newCover → 0
 *   3. job.coverRenderId → newCover.id
 *
 * @param jobId - MockupJob id
 * @param newCoverRenderId - MockupRender id (must be in this job, SUCCESS status)
 * @param userId - calling user id (authorization check)
 * @returns { coverRenderId: string } — new cover id
 * @throws InvalidRenderError if render not in job
 * @throws RenderNotSuccessError if render status ≠ SUCCESS
 * @throws AlreadyCoverError if render is already cover (no-op)
 * @throws JobNotFoundError if job not found or cross-user
 */
export async function swapCover(
  jobId: string,
  newCoverRenderId: string,
  userId: string,
): Promise<{ coverRenderId: string }> {
  // Fetch job with all renders
  const job = await db.mockupJob.findUnique({
    where: { id: jobId },
    include: { renders: true },
  });

  if (!job || job.userId !== userId) {
    // Import JobNotFoundError from job.service
    const { JobNotFoundError } = await import("./job.service");
    throw new JobNotFoundError();
  }

  // Find new cover render in this job
  const newCover = job.renders.find((r) => r.id === newCoverRenderId);
  if (!newCover) {
    throw new InvalidRenderError();
  }

  // Check status
  if (newCover.status !== "SUCCESS") {
    throw new RenderNotSuccessError();
  }

  // No-op rejection: if already cover, explicitly reject
  if (job.coverRenderId === newCoverRenderId) {
    throw new AlreadyCoverError();
  }

  // Find old cover render (must exist — job created with coverRenderId set)
  const oldCover = job.renders.find((r) => r.id === job.coverRenderId);
  if (!oldCover) {
    // Defensive: job should always have cover. If missing, fail fast.
    throw new AppError(500, "INTERNAL_ERROR", "Job has no cover render");
  }

  // Save old cover's position (for swap)
  const oldCoverPosition = newCover.packPosition;

  // Atomic transaction: 3-step slot swap + pointer update
  await db.$transaction([
    // Step 1: oldCover → newCover's old position
    db.mockupRender.update({
      where: { id: oldCover.id },
      data: { packPosition: oldCoverPosition },
    }),
    // Step 2: newCover → packPosition 0
    db.mockupRender.update({
      where: { id: newCover.id },
      data: { packPosition: 0 },
    }),
    // Step 3: job.coverRenderId → newCover.id
    db.mockupJob.update({
      where: { id: jobId },
      data: { coverRenderId: newCover.id },
    }),
  ]);

  return { coverRenderId: newCover.id };
}
