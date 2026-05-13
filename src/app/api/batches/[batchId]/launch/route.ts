/**
 * Phase 44 — POST /api/batches/[batchId]/launch
 *
 * DRAFT batch'i QUEUED'a transition eder + createVariationJobs ile
 * gerçek variation jobs üretir. Job.metadata.batchId = Batch.id
 * yazılır (synthetic ve real uzaylar birleşir).
 *
 * Body:
 *   {
 *     providerId: string,
 *     aspectRatio: "1:1" | "2:3" | "3:2",
 *     quality?: "medium" | "high",
 *     count: number (1-6),
 *     brief?: string
 *   }
 *
 * Response: { batchId, designIds, failedDesignIds, state }
 *
 * Hata davranışları (ValidationError → 400):
 *   - Batch DRAFT değilse (zaten launch'lanmış)
 *   - Items boşsa
 *   - Reference URL public değilse
 *   - Provider i2i desteklemiyorsa
 *   - Provider bilinmiyorsa
 *
 * Phase 44 scope: tek-reference path canonical (Pool card "New Batch"
 * → 1 reference). Multi-reference batch için Phase 44+.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { launchBatch } from "@/features/batches/server/batch-service";

const BodySchema = z.object({
  providerId: z.string().min(1),
  aspectRatio: z.enum(["1:1", "2:3", "3:2"]),
  quality: z.enum(["medium", "high"]).optional(),
  count: z.number().int().min(1).max(6),
  brief: z.string().max(500).optional(),
});

export const POST = withErrorHandling(
  async (
    req: Request,
    ctx: { params: Promise<{ batchId: string }> | { batchId: string } },
  ) => {
    const user = await requireUser();
    const { batchId } = await Promise.resolve(ctx.params);
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Invalid input", parsed.error.flatten());
    }
    const result = await launchBatch({
      userId: user.id,
      batchId,
      ...parsed.data,
    });
    return NextResponse.json(result);
  },
);
