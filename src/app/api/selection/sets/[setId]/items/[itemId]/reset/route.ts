// Phase 7 Task 22 — POST /api/selection/sets/[setId]/items/[itemId]/reset
//
// Item'ı orijinal asset'e (sourceAssetId) sıfırlar.
//
// Sözleşme (design Section 4.5, 7.2; plan Task 22):
//   - Auth: requireUser (Phase 5)
//   - Body yok / boş.
//   - Success: 200 + { item } (editedAssetId=null, lastUndoableAssetId=null,
//     editHistoryJson=[])
//   - Ready set → 409 (SetReadOnlyError)
//   - Cross-user setId/itemId → 404 (`requireItemOwnership`)
//
// Asset cleanup: orphan edit asset'leri DB'de kalır — `asset-orphan-cleanup`
// carry-forward kapsamı (design Section 4.5).

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { resetItem } from "@/server/services/selection/edit.service";

export const POST = withErrorHandling(
  async (
    _req: Request,
    ctx: { params: { setId: string; itemId: string } },
  ) => {
    const user = await requireUser();
    const item = await resetItem({
      userId: user.id,
      setId: ctx.params.setId,
      itemId: ctx.params.itemId,
    });
    return NextResponse.json({ item });
  },
);
