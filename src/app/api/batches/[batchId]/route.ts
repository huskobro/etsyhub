/**
 * Phase 43 — GET /api/batches/[batchId]
 *
 * Batch detail (items + each item's reference + asset preview).
 * Compose page bu endpoint'i tüketir. User-scoped; cross-user
 * erişim 404'e düşer.
 *
 * Auth: requireUser. NotFoundError → 404 (withErrorHandling
 * middleware).
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { getBatch } from "@/features/batches/server/batch-service";

export const GET = withErrorHandling(
  async (
    _req: Request,
    ctx: { params: Promise<{ batchId: string }> | { batchId: string } },
  ) => {
    const user = await requireUser();
    const { batchId } = await Promise.resolve(ctx.params);
    const batch = await getBatch({ userId: user.id, batchId });
    return NextResponse.json({ batch });
  },
);
