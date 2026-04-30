// Phase 7 Task 21 — POST /api/selection/sets/[setId]/items/reorder
//
// Drag-drop sonrası bulk position update endpoint'i. UI Selection Studio'da
// kullanıcı kartları sürükledikçe yeni sıralama atomik kaydedilir.
//
// Sözleşme (design Section 7.2; plan Task 21):
//   - Auth: requireUser (Phase 5)
//   - body: ReorderInputSchema { itemIds: string[] }
//   - Success: 200 + { items: SelectionItem[] } (position 0..N-1, asc sıralı)
//   - Tam eşleşme şartı (service `reorderItems` Task 5):
//     itemIds set'in TÜM item id'lerine birebir eşit (sayı + içerik;
//     duplicate yok). Eksik / fazla / duplicate / cross-set → 400
//     (`ReorderMismatchError`, code "REORDER_MISMATCH").
//   - Cross-user setId → 404 (`requireSetOwnership` Task 17)
//   - Ready/archived set → 409 (`SetReadOnlyError`; `assertSetMutable` Task 4)
//
// Reorder mismatch typed error kararı (Task 21):
//   `reorderItems` service'i mismatch durumunda generic `Error` yerine
//   `ReorderMismatchError extends AppError` (status 400) atar. `withErrorHandling`
//   bu sınıfı 400 + JSON body `{ code: "REORDER_MISMATCH" }` olarak HTTP'ye
//   map eder. İstemci kullanıcıya "input geçersiz, sayfayı yenile" feedback'i
//   verir; generic 500 server hatası değil.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { ReorderInputSchema } from "@/server/services/selection/types";
import { reorderItems } from "@/server/services/selection/items.service";

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: { setId: string } }) => {
    const user = await requireUser();

    const json = await req.json().catch(() => null);
    const parsed = ReorderInputSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Geçersiz istek", parsed.error.flatten());
    }

    const items = await reorderItems({
      userId: user.id,
      setId: ctx.params.setId,
      itemIds: parsed.data.itemIds,
    });
    return NextResponse.json({ items });
  },
);
