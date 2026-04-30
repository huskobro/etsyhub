// Phase 7 Task 21 — POST /api/selection/sets/[setId]/items/bulk-delete
//
// Bulk hard-delete endpoint'i. UI Selection Studio'da kullanıcı çoklu item
// silme aksiyonunu TypingConfirmation ("SİL") onayı ile gerçekleştirir.
//
// **TypingConfirmation server-side enforcement** (design Section 7.2):
//   `BulkDeleteInputSchema.confirmation` = `z.literal("SİL")` — Türkçe büyük
//   İ (U+0130 dotted I); case-sensitive; trim YOK. `"SIL"` (ASCII), `"sil"`
//   (küçük), `" SİL "` (whitespace) ve eksik alan zod fail → 400. UI primitive
//   `TypingConfirmation` ile birebir aynı sözleşme.
//
// Sözleşme (plan Task 21):
//   - Auth: requireUser (Phase 5)
//   - body: BulkDeleteInputSchema { itemIds: string[], confirmation: "SİL" }
//   - Success: 200 + { deletedCount } (atomik deleteMany)
//   - Cross-set itemIds → silent filter (`selectionSetId` where; deletedCount
//     sadece eşleşen sayı). Defense in depth.
//   - Cross-user setId → 404 (`requireSetOwnership` Task 17)
//   - Ready/archived set → 409 (`SetReadOnlyError`; `assertSetMutable` Task 4)
//   - Boş itemIds array → 400 (zod min(1))
//
// **ASSET DOKUNULMAZ** (Section 2.3; carry-forward stratejisi):
//   `bulkDelete` (items.service Task 5) yalnız SelectionItem siler — Asset ve
//   GeneratedDesign entity'lerine dokunmaz. Asset cleanup ileri task'lere.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { BulkDeleteInputSchema } from "@/server/services/selection/types";
import { bulkDelete } from "@/server/services/selection/items.service";

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: { setId: string } }) => {
    const user = await requireUser();

    const json = await req.json().catch(() => null);
    const parsed = BulkDeleteInputSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Geçersiz istek", parsed.error.flatten());
    }

    const result = await bulkDelete({
      userId: user.id,
      setId: ctx.params.setId,
      itemIds: parsed.data.itemIds,
    });
    return NextResponse.json(result);
  },
);
