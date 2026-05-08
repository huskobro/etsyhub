// Pass 86 — Retry-failed-only V1 endpoint.
//
// POST /api/admin/midjourney/batches/[batchId]/retry-failed
//   body: { aspectRatio?, submitStrategy? }
//   200 → {
//     newBatchId, newBatchCreatedAt, retryOfBatchId,
//     totalRetried, totalSubmitted, totalFailed,
//     results[] (Pass 80 BatchPerJobResult + retrySourceJobId)
//   }
//   400 → invalid body / source batch'de FAILED yok / template snapshot yok
//   404 → source batch bulunamadı veya cross-user
//   502 → BridgeUnreachable
//
// Akış:
//   1. requireAdmin
//   2. Path param batchId resolve
//   3. retryFailedJobsFromBatch service:
//      - getBatchSummary(sourceBatchId, userId) — user-scoped
//      - failed subset filter
//      - aynı template + failed variables → yeni batch
//      - retryLineage metadata her job'a yazılır
//   4. Audit log MIDJOURNEY_BATCH_RETRY_FAILED
//   5. Response (UI yeni batch detail page'e redirect)

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import {
  retryFailedJobsFromBatch,
  NoFailedJobsError,
  BatchTemplateMissingError,
} from "@/server/services/midjourney/batches";
import { BridgeUnreachableError } from "@/server/services/midjourney/bridge-client";

const aspectRatioEnum = z.enum([
  "1:1",
  "2:3",
  "3:2",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
]);

const body = z.object({
  aspectRatio: aspectRatioEnum.optional(),
  submitStrategy: z.enum(["auto", "api-first", "dom-first"]).optional(),
});

export const POST = withErrorHandling(
  async (
    req: Request,
    ctx: { params: Promise<{ batchId: string }> },
  ) => {
    const admin = await requireAdmin();
    const { batchId } = await ctx.params;

    if (!batchId || batchId.length < 1) {
      throw new ValidationError("Geçersiz batchId");
    }

    // Empty body olabilir (default aspect/strategy)
    const text = await req.text();
    let parsedBody: { aspectRatio?: string; submitStrategy?: string } = {};
    if (text.trim()) {
      try {
        parsedBody = JSON.parse(text);
      } catch {
        throw new ValidationError("Geçersiz JSON");
      }
    }
    const parsed = body.safeParse(parsedBody);
    if (!parsed.success) {
      throw new ValidationError(
        "Geçersiz retry body",
        parsed.error.flatten().fieldErrors,
      );
    }

    try {
      const result = await retryFailedJobsFromBatch({
        userId: admin.id,
        sourceBatchId: batchId,
        aspectRatio: parsed.data.aspectRatio,
        submitStrategy: parsed.data.submitStrategy,
      });

      await audit({
        actor: admin.id,
        action: "MIDJOURNEY_BATCH_RETRY_FAILED",
        targetType: "MidjourneyBatch",
        targetId: batchId,
        metadata: {
          retryOfBatchId: batchId,
          newBatchId: result.newBatchId,
          totalRetried: result.totalRetried,
          totalSubmitted: result.totalSubmitted,
          totalFailed: result.totalFailed,
          aspectRatio: parsed.data.aspectRatio ?? "1:1",
          submitStrategy: parsed.data.submitStrategy ?? "auto",
        },
      });

      return NextResponse.json({
        ok: true,
        newBatchId: result.newBatchId,
        newBatchCreatedAt: result.newBatchCreatedAt.toISOString(),
        retryOfBatchId: result.retryOfBatchId,
        totalRetried: result.totalRetried,
        totalSubmitted: result.totalSubmitted,
        totalFailed: result.totalFailed,
        results: result.results,
      });
    } catch (err) {
      if (err instanceof NoFailedJobsError) {
        return NextResponse.json(
          { ok: false, error: err.message, code: "NO_FAILED_JOBS" },
          { status: 400 },
        );
      }
      if (err instanceof BatchTemplateMissingError) {
        return NextResponse.json(
          {
            ok: false,
            error: err.message,
            code: "TEMPLATE_SNAPSHOT_MISSING",
          },
          { status: 400 },
        );
      }
      if (err instanceof BridgeUnreachableError) {
        return NextResponse.json(
          { ok: false, error: err.message, code: "BRIDGE_UNREACHABLE" },
          { status: 502 },
        );
      }
      throw err;
    }
  },
);
