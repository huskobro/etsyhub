/**
 * Phase 45 — GET /api/batches/current-draft
 *
 * Operatör'ün queue/staging mental model'inin "active cart" eşdeğeri.
 * En son updatedAt taşıyan DRAFT batch'i döner; yoksa { batch: null }.
 *
 * UI consumer: References sayfasındaki BatchQueuePanel.
 *   - polling: 8s React Query refetchInterval (Pool aksiyonları sonrası
 *     queue panel'i canlı güncellenir)
 *   - cache: stale-while-revalidate; mutation invalidate eder
 *
 * Auth: requireUser. User isolation service tarafında.
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { getCurrentDraftBatch } from "@/features/batches/server/batch-service";

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const batch = await getCurrentDraftBatch({ userId: user.id });
  return NextResponse.json({ batch });
});
