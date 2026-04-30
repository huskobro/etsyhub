// Phase 7 Task 20 — PATCH /api/selection/sets/[setId]/items/[itemId]
//
// Tek item status değişimi. Selection state machine (design Section 4.4)
// pending↔selected, pending↔rejected, selected↔rejected — tüm 6 geçiş valid.
// Tek invariant: ready/archived set'te item mutation yasak.
//
// Sözleşme (design Section 4.4, 7.2; plan Task 20):
//   - Auth: requireUser (Phase 5)
//   - body: UpdateItemStatusInputSchema { status: enum }
//   - Success: 200 + { item } (güncel SelectionItem row)
//   - Cross-user setId/itemId → 404 (`requireItemOwnership` Task 17 — set
//     ownership önce kontrol; cross-user item bile set kontrolünde 404'e
//     gizlenir, varlık sızdırılmaz)
//   - Cross-set itemId (item başka set'in) → 404 (item.selectionSetId filter
//     ile)
//   - Ready/archived set → 409 (`SetReadOnlyError`; `assertSetMutable` Task 4)
//   - Invalid status enum → 400 (zod reject)
//
// Phase 6 paterni: `safeParse` + `throw new ValidationError`; service
// (`updateItemStatus` Task 5) typed AppError'ları `withErrorHandling`
// üzerinden HTTP'ye otomatik map.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { UpdateItemStatusInputSchema } from "@/server/services/selection/types";
import { updateItemStatus } from "@/server/services/selection/items.service";

export const PATCH = withErrorHandling(
  async (
    req: Request,
    ctx: { params: { setId: string; itemId: string } },
  ) => {
    const user = await requireUser();

    const json = await req.json().catch(() => null);
    const parsed = UpdateItemStatusInputSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Geçersiz istek", parsed.error.flatten());
    }

    const item = await updateItemStatus({
      userId: user.id,
      setId: ctx.params.setId,
      itemId: ctx.params.itemId,
      status: parsed.data.status,
    });
    return NextResponse.json({ item });
  },
);
