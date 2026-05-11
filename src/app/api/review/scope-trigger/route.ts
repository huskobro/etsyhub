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
import { enqueueReviewDesign } from "@/server/services/review/enqueue";
import { getActiveLocalRootFilter } from "@/server/services/local-library/active-root";
import { getUserLocalLibrarySettings } from "@/features/settings/local-library/service";
import { resolveLocalFolder } from "@/features/settings/local-library/folder-mapping";
import { logger } from "@/lib/logger";

const BodySchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("folder"),
    folderName: z.string().min(1).max(512),
    // IA-30 — UI artık hardcoded productTypeKey GÖNDERMEZ. Server
    // folderProductTypeMap (alias) veya convention'dan resolve eder;
    // mapping yoksa 400 döner ve operatöre mapping atamasını söyler.
    productTypeKey: z.string().min(1).optional(),
  }),
  z.object({
    scope: z.literal("batch"),
    batchId: z.string().min(1).max(120),
  }),
  // IA Phase 22 — reference scope (AI design). All variations under
  // a Reference share the scope identity; trigger fires every
  // pending + never-scored design row.
  z.object({
    scope: z.literal("reference"),
    referenceId: z.string().min(1).max(120),
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
    // IA-29 — scope-trigger folder branch also honours active root.
    // Operator may have a stale folder ref from picker; backend
    // defends.
    const rootFilter = await getActiveLocalRootFilter(user.id);
    const candidates = await db.localLibraryAsset.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        isUserDeleted: false,
        folderName: parsed.data.folderName,
        ...rootFilter,
        // Operator wants undecided rows (PENDING / NEEDS_REVIEW);
        // KEPT/REJECTED ones are excluded. Already-scored guard
        // (reviewProviderSnapshot present) excludes those further
        // — no double-billing.
        reviewStatus: "PENDING",
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
    // IA-30 — productTypeKey resolve: body override → folderProductTypeMap
    // → convention. Mapping yoksa rerun yapamayız.
    let productTypeKey: string | null = parsed.data.productTypeKey ?? null;
    if (!productTypeKey) {
      const settings = await getUserLocalLibrarySettings(user.id);
      const r = resolveLocalFolder({
        folderName: parsed.data.folderName,
        folderMap: settings.folderProductTypeMap ?? {},
      });
      if (r.kind === "mapped") productTypeKey = r.productTypeKey;
    }
    if (!productTypeKey) {
      throw new ValidationError(
        `No productType mapping for folder "${parsed.data.folderName}". Assign one in Settings → Review → Local library, or include productTypeKey in the request body.`,
      );
    }
    const results = await Promise.all(
      candidates.map(async (c) => {
        try {
          await enqueueReviewDesign({
            userId: user.id,
            payload: { scope: "local", localAssetId: c.id, productTypeKey },
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

  if (parsed.data.scope === "reference") {
    // IA Phase 22 — reference scope. All variations under the
    // reference; same already-scored guard applies.
    const targetReferenceId = parsed.data.referenceId;
    const candidates = await db.generatedDesign.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        referenceId: targetReferenceId,
        reviewStatus: "PENDING",
        reviewProviderSnapshot: null,
      },
      select: { id: true },
      take: MAX_PER_TRIGGER,
    });
    if (candidates.length === 0) {
      return NextResponse.json({
        scope: "reference",
        referenceId: targetReferenceId,
        requested: 0,
        enqueueSucceeded: 0,
        skippedAlreadyScored: 0,
        skippedNoTarget: 0,
        enqueueErrors: 0,
      });
    }
    const refResults = await Promise.all(
      candidates.map(async (c) => {
        try {
          await enqueueReviewDesign({
            userId: user.id,
            payload: { scope: "design", generatedDesignId: c.id },
          });
          return { ok: true as const };
        } catch (err) {
          logger.error(
            {
              designId: c.id,
              userId: user.id,
              err: err instanceof Error ? err.message : String(err),
            },
            "scope-trigger reference: enqueue failed",
          );
          return { ok: false as const };
        }
      }),
    );
    const refErrors = refResults.filter((r) => !r.ok).length;
    return NextResponse.json({
      scope: "reference",
      referenceId: targetReferenceId,
      requested: candidates.length,
      enqueueSucceeded: candidates.length - refErrors,
      skippedAlreadyScored: 0,
      skippedNoTarget: 0,
      enqueueErrors: refErrors,
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
      reviewStatus: "PENDING",
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
        await enqueueReviewDesign({
          userId: user.id,
          payload: { scope: "design", generatedDesignId: c.id },
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
