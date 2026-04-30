// Phase 7 Task 22 — POST /api/selection/sets/[setId]/finalize
//
// Set'i `draft → ready` state'ine geçirir. Phase 4'te tanımlı state machine
// guard'ları service katmanında uygulanır (`finalizeSet` Task 4):
//   - Set zaten `ready` veya `archived` → SetReadOnlyError (gate'ten önce)
//   - 0 selected item → FinalizeGateError
//
// Sözleşme (design Section 4.3, 7.2; plan Task 22):
//   - Auth: requireUser (Phase 5)
//   - Body: BOŞ zorunlu (FinalizeInputSchema .strict() — extra alan reject)
//   - Success: 200 + { set } (status="ready", finalizedAt set)
//   - 0 selected → 409 (FinalizeGateError, code FINALIZE_GATE)
//   - Already ready → 409 (SetReadOnlyError, code SET_READ_ONLY)
//   - Extra body field → 400 (zod strict reject)
//   - Cross-user → 404 (NotFoundError; `requireSetOwnership`)
//
// Body parse: `req.json()` parse fail → empty obj fallback. `.strict()` schema
// extra alanları reddeder; eksik alan yok (boş schema).

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { FinalizeInputSchema } from "@/server/services/selection/types";
import { finalizeSet } from "@/server/services/selection/state";

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: { setId: string } }) => {
    const user = await requireUser();

    const json = await req.json().catch(() => ({}));
    const parsed = FinalizeInputSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Geçersiz istek", parsed.error.flatten());
    }

    const set = await finalizeSet({
      userId: user.id,
      setId: ctx.params.setId,
    });
    return NextResponse.json({ set });
  },
);
