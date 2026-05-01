// Phase 8 Task 17 — GET /api/mockup/jobs/[jobId] route handler.
//
// Spec §4.2: S7 Job UI polling endpoint'i. Job durum + render listesi +
// cover + ETA döner. Cross-user 404 disiplini (Phase 6/7 emsali).
//
// Service katmanı: direct Prisma query (Task 6 recomputeJobStatus style;
// scope minimal). Read-only operasyon, transaction gerekmiyor.
//
// Phase 7 emsali: src/app/api/selection/sets/[setId]/route.ts.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { db } from "@/server/db";
import { JobNotFoundError } from "@/features/mockups/server/job.service";
import type { MockupRender } from "@prisma/client";

/**
 * ETA hesabı V1 (Spec §4.2):
 *   - successRenders === 0 → null (henüz başarılı render yok)
 *   - totalRenders === successRenders → null (hepsi tamam)
 *   - else: (totalRenders - successRenders) * avgRenderTime
 *   - avgRenderTime: SUCCESS render'ların completedAt - startedAt ortalaması
 *   - completedAt veya startedAt null'sa skip
 *
 * UI (Task 28) bu değeri "~X saniye" tilde ile gösterir (CLAUDE.md
 * "approximate, fake precision yok").
 */
function computeEstimatedCompletionAt(
  totalRenders: number,
  successRenders: number,
  renders: MockupRender[],
): Date | null {
  if (successRenders === 0) return null;
  if (totalRenders === successRenders) return null; // hepsi tamam

  const successDurations = renders
    .filter((r) => r.status === "SUCCESS" && r.completedAt && r.startedAt)
    .map((r) => r.completedAt!.getTime() - r.startedAt!.getTime());

  if (successDurations.length === 0) return null;

  const avgMs =
    successDurations.reduce((a, b) => a + b, 0) / successDurations.length;
  const remaining = totalRenders - successRenders;
  return new Date(Date.now() + avgMs * remaining);
}

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: { jobId: string } }) => {
    const user = await requireUser();

    const job = await db.mockupJob.findUnique({
      where: { id: ctx.params.jobId },
      include: {
        renders: {
          orderBy: { packPosition: "asc" },
        },
      },
    });

    if (!job || job.userId !== user.id) {
      throw new JobNotFoundError();
    }

    const estimatedCompletionAt = computeEstimatedCompletionAt(
      job.totalRenders,
      job.successRenders,
      job.renders,
    );

    return NextResponse.json({
      id: job.id,
      status: job.status,
      packSize: job.packSize,
      actualPackSize: job.actualPackSize,
      totalRenders: job.totalRenders,
      successRenders: job.successRenders,
      failedRenders: job.failedRenders,
      coverRenderId: job.coverRenderId,
      errorSummary: job.errorSummary,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      estimatedCompletionAt,
      renders: job.renders.map((r) => ({
        id: r.id,
        packPosition: r.packPosition,
        selectionReason: r.selectionReason,
        status: r.status,
        outputKey: r.outputKey,
        thumbnailKey: r.thumbnailKey,
        errorClass: r.errorClass,
        errorDetail: r.errorDetail,
        templateSnapshot: r.templateSnapshot, // denormalized templateName + aspectRatios
        variantId: r.variantId,
        retryCount: r.retryCount,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
      })),
    });
  },
);
