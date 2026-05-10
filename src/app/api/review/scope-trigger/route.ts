// IA Phase 18 — POST /api/review/scope-trigger
//
// Manual review trigger for a scope (folder or batch). Operator
// requests "score every undecided & not-yet-scored item in this
// scope". Already-scored guard still applies — no double-billing.
//
// Body (discriminated union):
//   { scope: "folder", folderName, productTypeKey } — local
//   { scope: "batch", batchId }                    — design (AI)
//
// Response:
//   { requested, enqueueSucceeded, skippedAlreadyScored, skippedNoTarget,
//     enqueueErrors }
//
// Authorization: requireUser. Multi-tenant — caller must own the scope.

import { NextResponse } from "next/server";
import { z } from "zod";
import { JobType } from "@prisma/client";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { enqueue } from "@/server/queue";
import { logger } from "@/lib/logger";

const BodySchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("folder"),
    folderName: z.string().min(1).max(512),
    productTypeKey: z.string().min(1),
  }),
  z.object({
    scope: z.literal("batch"),
    batchId: z.string().min(1).max(120),
  }),
]);

const MAX_PER_TRIGGER = 200;

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError(
      "Invalid scope trigger payload",
      parsed.error.flatten(),
    );
  }

  if (parsed.data.scope === "folder") {
    // Local — collect undecided + never-scored asset ids in folder.
    const candidates = await db.localLibraryAsset.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        isUserDeleted: false,
        folderName: parsed.data.folderName,
        // Operator wants undecided rows (PENDING / NEEDS_REVIEW);
        // KEPT/REJECTED ones are excluded. Already-scored guard
        // (reviewProviderSnapshot present) excludes those further
        // — no double-billing.
        reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
        reviewProviderSnapshot: null,
      },
      select: { id: true },
      take: MAX_PER_TRIGGER,
    });
    if (candidates.length === 0) {
      return NextResponse.json({
        scope: "folder",
        folderName: parsed.data.folderName,
        requested: 0,
        enqueueSucceeded: 0,
        skippedAlreadyScored: 0,
        skippedNoTarget: 0,
        enqueueErrors: 0,
      });
    }
    const productTypeKey = parsed.data.productTypeKey;
    const results = await Promise.all(
      candidates.map(async (c) => {
        try {
          await enqueue(JobType.REVIEW_DESIGN, {
            scope: "local" as const,
            localAssetId: c.id,
            userId: user.id,
            productTypeKey,
          });
          return { ok: true as const };
        } catch (err) {
          logger.error(
            {
              assetId: c.id,
              userId: user.id,
              err: err instanceof Error ? err.message : String(err),
            },
            "scope-trigger folder: enqueue failed",
          );
          return { ok: false as const };
        }
      }),
    );
    const errors = results.filter((r) => !r.ok).length;
    return NextResponse.json({
      scope: "folder",
      folderName: parsed.data.folderName,
      requested: candidates.length,
      enqueueSucceeded: candidates.length - errors,
      skippedAlreadyScored: 0,
      skippedNoTarget: 0,
      enqueueErrors: errors,
    });
  }

  // Batch — collect undecided + never-scored design ids in batch.
  // Job.metadata.batchId; client-side filter (defensive — Prisma
  // JSON path equals is fine but the same matching strategy used
  // by next-scope.ts is already client-side).
  const targetBatchId = parsed.data.batchId;
  const variationJobs = await db.job.findMany({
    where: {
      userId: user.id,
      type: JobType.GENERATE_VARIATIONS,
    },
    select: { id: true, metadata: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const batchJobs = variationJobs.filter((j) => {
    const md = j.metadata as Record<string, unknown> | null;
    return md && typeof md === "object" && md.batchId === targetBatchId;
  });
  if (batchJobs.length === 0) {
    return NextResponse.json({
      scope: "batch",
      batchId: targetBatchId,
      requested: 0,
      enqueueSucceeded: 0,
      skippedAlreadyScored: 0,
      skippedNoTarget: 0,
      enqueueErrors: 0,
    });
  }
  const candidates = await db.generatedDesign.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      jobId: { in: batchJobs.map((j) => j.id) },
      reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
      reviewProviderSnapshot: null,
    },
    select: { id: true },
    take: MAX_PER_TRIGGER,
  });
  if (candidates.length === 0) {
    return NextResponse.json({
      scope: "batch",
      batchId: targetBatchId,
      requested: 0,
      enqueueSucceeded: 0,
      skippedAlreadyScored: 0,
      skippedNoTarget: 0,
      enqueueErrors: 0,
    });
  }
  const results = await Promise.all(
    candidates.map(async (c) => {
      try {
        await enqueue(JobType.REVIEW_DESIGN, {
          scope: "design" as const,
          generatedDesignId: c.id,
          userId: user.id,
        });
        return { ok: true as const };
      } catch (err) {
        logger.error(
          {
            designId: c.id,
            userId: user.id,
            err: err instanceof Error ? err.message : String(err),
          },
          "scope-trigger batch: enqueue failed",
        );
        return { ok: false as const };
      }
    }),
  );
  const errors = results.filter((r) => !r.ok).length;
  return NextResponse.json({
    scope: "batch",
    batchId: parsed.data.batchId,
    requested: candidates.length,
    enqueueSucceeded: candidates.length - errors,
    skippedAlreadyScored: 0,
    skippedNoTarget: 0,
    enqueueErrors: errors,
  });
});
