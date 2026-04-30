// Phase 7 Task 21 — PATCH /api/selection/sets/[setId]/items/bulk
//
// Bulk status update endpoint'i. UI Selection Studio'da kullanıcı çoklu seçim
// yapıp tek aksiyonla "selected" / "rejected" / "pending" işaretler.
//
// Sözleşme (design Section 7.2; plan Task 21):
//   - Auth: requireUser (Phase 5)
//   - body: BulkUpdateStatusInputSchema { itemIds: string[], status: enum }
//   - Success: 200 + { updatedCount } (atomik updateMany)
//   - Cross-set itemIds → silent filter (`selectionSetId` where; itemler
//     dokunulmaz, updatedCount sadece eşleşen sayı). Defense in depth.
//   - Cross-user setId → 404 (`requireSetOwnership` Task 17)
//   - Ready/archived set → 409 (`SetReadOnlyError`; `assertSetMutable` Task 4)
//   - Boş itemIds array → 400 (zod min(1))
//   - Invalid status enum → 400 (zod reject)
//
// Phase 6 paterni: `safeParse` + `throw new ValidationError`; AppError alt-
// sınıfları `withErrorHandling` üzerinden HTTP'ye otomatik map.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { BulkUpdateStatusInputSchema } from "@/server/services/selection/types";
import { bulkUpdateStatus } from "@/server/services/selection/items.service";

export const PATCH = withErrorHandling(
  async (req: Request, ctx: { params: { setId: string } }) => {
    const user = await requireUser();

    const json = await req.json().catch(() => null);
    const parsed = BulkUpdateStatusInputSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Geçersiz istek", parsed.error.flatten());
    }

    const result = await bulkUpdateStatus({
      userId: user.id,
      setId: ctx.params.setId,
      itemIds: parsed.data.itemIds,
      status: parsed.data.status,
    });
    return NextResponse.json(result);
  },
);
