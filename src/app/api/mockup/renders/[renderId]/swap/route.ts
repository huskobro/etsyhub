// Phase 8 Task 19 — POST /api/mockup/renders/[renderId]/swap route handler.
//
// Spec §4.4: Manuel render swap (deterministic hata sınıfları için).
//   - Auth: requireUser (UnauthorizedError 401 otomatik)
//   - Path param: renderId
//   - Body: boş (pack deterministik; swap alternative pair algoritması)
//   - Service: swapRender(renderId, userId) — Task 18
//     Kontroller:
//       - Render FAILED durumunda mı? (RenderNotFailedError 409)
//       - Cross-user / yok → RenderNotFoundError (404)
//     Aksiyon:
//       - Eski render: packPosition=null (arşivlenir)
//       - Pack'te yeni (variantId, bindingId) pair seç (deterministik)
//       - Yeni render: PENDING, aynı packPosition, aynı selectionReason
//       - BullMQ queue'ya dispatch
//     Hata: NoAlternativePairError (409) — pack'te kalan pair yok
//   - Response 200: { status: "PENDING", newRenderId } (swap başlatıldı)
//   - Error mapping: withErrorHandling HOF AppError.statusCode → HTTP.
//
// Phase 7 emsali: src/app/api/selection/...
// Phase 8 Task 18: src/features/mockups/server/render.service.ts

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { swapRender } from "@/features/mockups/server/render.service";

export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: { renderId: string } }) => {
    const user = await requireUser();

    // Task 18: swapRender atomic transaction + AppError throw.
    // Hatalar:
    //   - RenderNotFoundError (404)
    //   - RenderNotFailedError (409)
    //   - NoAlternativePairError (409)
    const result = await swapRender(ctx.params.renderId, user.id);

    return NextResponse.json(
      { status: result.status, newRenderId: result.newRenderId },
      { status: 200 }
    );
  }
);
