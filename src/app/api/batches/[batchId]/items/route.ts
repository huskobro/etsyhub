/**
 * Phase 43 — Batch items endpoints.
 *
 * POST /api/batches/[batchId]/items
 *   Body: { referenceIds: string[] }
 *   Reference ekler (yalnız DRAFT state'inde). Idempotent — aynı
 *   reference ikinci kez eklendiğinde sessizce skip.
 *
 * GET /api/batches/[batchId]
 *   (top-level [batchId]/route.ts — sonra eklenir)
 *
 * Auth: requireUser. User isolation service tarafında.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { addReferencesToBatch } from "@/features/batches/server/batch-service";

const BodySchema = z.object({
  referenceIds: z.array(z.string().min(1)).min(1).max(200),
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
    const result = await addReferencesToBatch({
      userId: user.id,
      batchId,
      referenceIds: parsed.data.referenceIds,
    });
    return NextResponse.json(result);
  },
);
