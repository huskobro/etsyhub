// R7 — GET /api/settings/cost-summary
//
// AI Providers pane'in 4-stat row'u için gerçek backing.
// Schema dokunmaz; CostUsage + Job aggregations'dan derive.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { getCostSummary } from "@/server/services/settings/cost-summary.service";

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const summary = await getCostSummary({ userId: user.id });
  return NextResponse.json({ summary });
});
