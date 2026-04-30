// Phase 7 Task 22 — POST /api/selection/sets/[setId]/archive
//
// Set'i archive et: draft → archived veya ready → archived (design Section 4.3).
// Archive geçişi `assertCanArchive` (Task 4) ile korunur — `archived → archived`
// idempotent değildir; `InvalidStateTransitionError` atılır.
//
// Sözleşme (design Section 4.3, 7.2; plan Task 22):
//   - Auth: requireUser (Phase 5)
//   - Body: BOŞ zorunlu (ArchiveInputSchema .strict())
//   - Success: 200 + { set } (status="archived", archivedAt set)
//   - draft → archived: 200
//   - ready → archived: 200
//   - Already archived → 409 (InvalidStateTransitionError, code
//     INVALID_STATE_TRANSITION)
//   - Extra body field → 400 (zod strict)
//   - Cross-user → 404

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { ArchiveInputSchema } from "@/server/services/selection/types";
import { archiveSet } from "@/server/services/selection/sets.service";

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: { setId: string } }) => {
    const user = await requireUser();

    const json = await req.json().catch(() => ({}));
    const parsed = ArchiveInputSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Geçersiz istek", parsed.error.flatten());
    }

    const set = await archiveSet({
      userId: user.id,
      setId: ctx.params.setId,
    });
    return NextResponse.json({ set });
  },
);
