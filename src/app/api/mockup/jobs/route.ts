// Phase 8 Task 16 — POST /api/mockup/jobs route handler.
//
// Spec §4.1: Task 5 createMockupJob (handoff service) HTTP'ye expose edilir.
//   - Auth: requireUser (Phase 7 emsali — UnauthorizedError 401 otomatik)
//   - Body: CreateJobBodySchema (Task 3, src/features/mockups/schemas.ts)
//       { setId: string, categoryId: "canvas", templateIds: string[] (1..8) }
//   - Service: createMockupJob (Task 5 — atomic SelectionSet → MockupJob handoff)
//   - Response 202 Accepted: { jobId } (async BullMQ dispatch tamamlandı,
//     render lifecycle Task 7 worker'da koşar)
//   - Error mapping: withErrorHandling HOF AppError.statusCode otomatik map.
//     Task 5 custom errors zaten AppError extend; status alanları
//     errorResponse helper'ı tarafından NextResponse.status'a kopyalanır:
//       SetNotFoundError       → 404 (cross-user dahil)
//       InvalidSetError        → 409 (status≠ready, set-level aspect fail)
//       InvalidTemplatesError  → 400 (templateIds eksik/fazla/inactive)
//       TemplateInvalidError   → 409 (binding yok / aspect uyumsuz)
//       ValidationError (Zod)  → 400 (body shape ihlali)
//
// Phase 7 emsali: src/app/api/selection/sets/[setId]/finalize/route.ts.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { CreateJobBodySchema } from "@/features/mockups/schemas";
import { createMockupJob } from "@/features/mockups/server/handoff.service";

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();

  // Body parse fail → boş obje fallback (Phase 7 emsali). Zod safeParse
  // sonra eksik alanları zaten reddeder.
  const json = await req.json().catch(() => ({}));
  const parsed = CreateJobBodySchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }

  const { jobId } = await createMockupJob({
    userId: user.id,
    setId: parsed.data.setId,
    categoryId: parsed.data.categoryId,
    templateIds: parsed.data.templateIds,
    // Phase 80 — Studio slot-mapped operator assignment (opsiyonel).
    // Apply view (S3ApplyView submit) field'ı göndermez; backward-compat.
    ...(parsed.data.slotAssignments
      ? { slotAssignments: parsed.data.slotAssignments }
      : {}),
  });

  // Spec §4.1: 202 Accepted — async job dispatch.
  return NextResponse.json({ jobId }, { status: 202 });
});
