// Phase 7 Task 20 — POST /api/selection/sets/[setId]/items
//
// Drawer ile çoklu item ekleme endpoint'i. UI "Selection drawer"dan kullanıcı
// review queue/library'den seçtiği design'ları aktif sete batch olarak ekler.
//
// Sözleşme (design Section 2.2, 7.2; plan Task 20):
//   - Auth: requireUser (Phase 5)
//   - body: AddItemsInputSchema { items: [{ generatedDesignId }] } (zod min(1))
//   - Success: 201 + { items } — yalnız yeni eklenen rows (skip edilenler hariç)
//   - Duplicate generatedDesignId (set'te zaten var) → silent skip (service
//     `addItems` Task 5 kontratı; UX uyumluluğu için throw yerine filter)
//   - Cross-user generatedDesign → silent skip (aynı politika)
//   - Cross-user / olmayan setId → 404 (`requireSetOwnership` Task 17)
//   - Ready/archived set → 409 (`SetReadOnlyError`; `assertSetMutable` Task 4)
//   - Boş items array → 400 (zod min(1))
//
// Phase 6 paterni: `safeParse` + `throw new ValidationError`; AppError alt-
// sınıfları `withErrorHandling` üzerinden HTTP'ye otomatik map.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { AddItemsInputSchema } from "@/server/services/selection/types";
import { addItems } from "@/server/services/selection/items.service";

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: { setId: string } }) => {
    const user = await requireUser();

    const json = await req.json().catch(() => null);
    const parsed = AddItemsInputSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Geçersiz istek", parsed.error.flatten());
    }

    const items = await addItems({
      userId: user.id,
      setId: ctx.params.setId,
      items: parsed.data.items,
    });
    return NextResponse.json({ items }, { status: 201 });
  },
);
