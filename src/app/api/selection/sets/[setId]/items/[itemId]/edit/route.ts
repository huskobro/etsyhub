// Phase 7 Task 22 — POST /api/selection/sets/[setId]/items/[itemId]/edit
//
// Instant edit op endpoint'i. Selection Studio'da kullanıcı bir item üzerinde
// crop / transparent-check gibi senkron edit'leri tek istekle uygular.
//
// Sözleşme (design Section 5, 5.1, 7.2; plan Task 22):
//   - Auth: requireUser (Phase 5)
//   - body: EditOpInputSchema discriminated union
//       { op: "crop", params: { ratio } } | { op: "transparent-check" }
//       | { op: "background-remove" }    ← bu route'ta REJECT (heavy op)
//   - Success: 200 + { item } (güncel SelectionItem; orchestrator return)
//   - background-remove → 400 (heavy op; client `/edit/heavy` kullanmalı)
//   - Invalid op / crop without params → 400 (zod reject)
//   - Ready set → 409 (SetReadOnlyError; service layer)
//   - Cross-user setId/itemId → 404 (`requireItemOwnership`)
//
// Heavy op double-guard kararı (plan Task 22 risk uyarısı):
//   `applyEdit` orchestrator'ı `background-remove` durumunda generic Error
//   atıyor — HTTP 500'e map olur. Route boundary'de explicit zod check
//   sonrası ek `if` ile typed `ValidationError` (400) atılır; istemci için
//   doğru sinyal: "yanlış endpoint, /edit/heavy kullan".

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { EditOpInputSchema } from "@/server/services/selection/types";
import { applyEdit } from "@/server/services/selection/edit.service";

export const POST = withErrorHandling(
  async (
    req: Request,
    ctx: { params: { setId: string; itemId: string } },
  ) => {
    const user = await requireUser();

    const json = await req.json().catch(() => null);
    const parsed = EditOpInputSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Geçersiz istek", parsed.error.flatten());
    }

    // Heavy op double-guard: orchestrator zaten reject ediyor (generic Error
    // → 500); route boundary'de explicit 400 daha temiz istemci sinyali.
    if (parsed.data.op === "background-remove") {
      throw new ValidationError(
        "background-remove heavy op — /edit/heavy endpoint kullan",
        {
          formErrors: [],
          fieldErrors: {
            op: ["background-remove heavy op — /edit/heavy endpoint kullan"],
          },
        },
      );
    }

    const item = await applyEdit({
      userId: user.id,
      setId: ctx.params.setId,
      itemId: ctx.params.itemId,
      op: parsed.data,
    });
    return NextResponse.json({ item });
  },
);
