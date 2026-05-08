// Pass 89 — Batch Review Studio V1: bulk reset (tüm batch UNDECIDED).
//
// Sözleşme:
//   POST /api/admin/midjourney/batches/[batchId]/review/reset
//   body: {} (boş)
//
// Auth: requireAdmin + service user-scope.
// Audit: MIDJOURNEY_REVIEW_BULK_RESET.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError } from "@/lib/errors";
import { audit } from "@/server/audit";
import {
  resetBatchReviewDecisions,
  ReviewError,
} from "@/server/services/midjourney/review";

export const POST = withErrorHandling(
  async (_req: Request, { params }: { params: { batchId: string } }) => {
    const admin = await requireAdmin();

    try {
      const result = await resetBatchReviewDecisions(params.batchId, admin.id);

      await audit({
        actor: admin.id,
        action: "MIDJOURNEY_REVIEW_BULK_RESET",
        targetType: "MidjourneyBatch",
        targetId: params.batchId,
        metadata: { resetCount: result.resetCount },
      });

      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof ReviewError && err.code === "BATCH_NOT_FOUND") {
        throw new NotFoundError(err.message);
      }
      throw err;
    }
  },
);
