// Phase 8 Task 19 — POST /api/mockup/renders/[renderId]/retry route handler.
//
// Spec §4.5: Manuel render retry (transient hata sınıfları için).
//   - Auth: requireUser (UnauthorizedError 401 otomatik)
//   - Path param: renderId
//   - Body: boş (retryCount ve cap kontrolü service'de)
//   - Service: retryRender(renderId, userId) — Task 18
//     Kontroller:
//       - Render FAILED durumunda mı? (RenderNotFailedError 409)
//       - retryCount < 3? (RetryCapExceededError 409)
//       - errorClass retry-able mi? (RenderNotRetryableError 409)
//       - Cross-user / yok → RenderNotFoundError (404)
//     Aksiyon: retryCount++, status → PENDING, BullMQ queue'ya re-dispatch.
//   - Response 200: { status: "PENDING", retryCount } (retry başlatıldı)
//   - Error mapping: withErrorHandling HOF AppError.statusCode → HTTP.
//
// Phase 7 emsali: src/app/api/selection/...
// Phase 8 Task 18: src/features/mockups/server/render.service.ts

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { retryRender } from "@/features/mockups/server/render.service";

export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: { renderId: string } }) => {
    const user = await requireUser();

    // Task 18: retryRender atomic transaction + AppError throw.
    // Hatalar:
    //   - RenderNotFoundError (404)
    //   - RenderNotFailedError (409)
    //   - RetryCapExceededError (409)
    //   - RenderNotRetryableError (409)
    const result = await retryRender(ctx.params.renderId, user.id);

    return NextResponse.json(
      { status: result.status, retryCount: result.retryCount },
      { status: 200 }
    );
  }
);
