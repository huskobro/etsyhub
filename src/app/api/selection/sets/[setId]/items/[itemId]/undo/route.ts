// Phase 7 Task 22 — POST /api/selection/sets/[setId]/items/[itemId]/undo
//
// Tek-seviye undo endpoint'i. Item'ın son asset-üreten edit'ini geri alır.
//
// Sözleşme (design Section 4.5, 7.2; plan Task 22):
//   - Auth: requireUser (Phase 5)
//   - Body yok / boş — herhangi bir validation gerekmez.
//   - Success: 200 + { item } (editedAssetId ↔ lastUndoableAssetId swap;
//     lastUndoable null'a düşer; history son op pop edilir)
//   - lastUndoable yok → 409 (UndoableNotAvailableError; Task 22 typed error)
//   - Ready set → 409 (SetReadOnlyError)
//   - Cross-user setId/itemId → 404 (`requireItemOwnership`)
//
// Typed `UndoableNotAvailableError` kararı (Task 22):
//   `undoEdit` service'i daha önce generic `Error("Undo edilebilecek edit
//   yok")` atıyordu — route boundary'de HTTP 500'e map olurdu. Task 22
//   kapsamında typed sınıf eklendi (status 409, code "UNDOABLE_NOT_AVAILABLE");
//   istemci için doğru sinyal: "geri alacak edit yok, sayfayı yenile" değil
//   "state invariant — orijinal halinde, geri alma anlamsız".

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { undoEdit } from "@/server/services/selection/edit.service";

export const POST = withErrorHandling(
  async (
    _req: Request,
    ctx: { params: { setId: string; itemId: string } },
  ) => {
    const user = await requireUser();
    const item = await undoEdit({
      userId: user.id,
      setId: ctx.params.setId,
      itemId: ctx.params.itemId,
    });
    return NextResponse.json({ item });
  },
);
