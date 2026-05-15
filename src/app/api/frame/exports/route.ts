// Phase 100 — Frame export history endpoint (sözleşme #11 + #13.F).
//
// GET /api/frame/exports — operator'ün son N Frame export'unu listeler
// (default 20, max 100). Studio history viewer + Product handoff
// picker UI bu endpoint'i kullanır.
//
// Auth: requireUser (cross-user isolation; service.userId match
// hardline). Madde V parity.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { listFrameExports } from "@/server/services/frame/frame-export.service";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  selectionSetId: z.string().optional(),
});

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get("limit"),
    selectionSetId: url.searchParams.get("selectionSetId") ?? undefined,
  });
  const limit = parsed.success ? parsed.data.limit : undefined;
  const selectionSetId = parsed.success
    ? parsed.data.selectionSetId
    : undefined;
  const items = await listFrameExports({
    userId: user.id,
    ...(limit ? { limit } : {}),
    ...(selectionSetId ? { selectionSetId } : {}),
  });
  return NextResponse.json({ items }, { status: 200 });
});
