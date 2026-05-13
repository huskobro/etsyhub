/**
 * Phase 46 — DELETE /api/batches/[batchId]/items/[itemId]
 *
 * Queue panel'den tek tıkla item kaldırma. Only DRAFT state'inde izin.
 * Cross-user / non-existent → 404 (withErrorHandling middleware).
 *
 * Auth: requireUser. User isolation service tarafında.
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { removeBatchItem } from "@/features/batches/server/batch-service";

export const DELETE = withErrorHandling(
  async (
    _req: Request,
    ctx: {
      params:
        | Promise<{ batchId: string; itemId: string }>
        | { batchId: string; itemId: string };
    },
  ) => {
    const user = await requireUser();
    const { batchId, itemId } = await Promise.resolve(ctx.params);
    const result = await removeBatchItem({
      userId: user.id,
      batchId,
      itemId,
    });
    return NextResponse.json(result);
  },
);
