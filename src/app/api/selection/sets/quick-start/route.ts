// Phase 7 Task 19 — POST /api/selection/sets/quick-start
//
// Selection Studio "quick start": kullanıcı bir variation batch'inden tek
// tıkla yeni SelectionSet + items oluşturur (canonical entry point).
//
// Sözleşme (design Section 2.1, 7.2; plan Task 19):
//   - Auth: requireUser (Phase 5)
//   - body: QuickStartInputSchema {
//       source: "variation-batch", referenceId, batchId, productTypeId
//     }
//   - Success: 201 + { setId } — UI redirect için minimal payload.
//   - Cross-user reference / batch / olmayan id → 404 (NotFoundError;
//     varlık sızıntısı yok, Phase 6 disiplini).
//   - Boş batch (variant 0) → 400 (EmptyBatchError; service throw eder).
//   - Source unsupported / missing field → 400 (ValidationError; zod fail).
//
// Phase 6 paterni: `safeParse` + `throw new ValidationError`. Service
// `quickStartFromBatch` zaten `NotFoundError` ve `EmptyBatchError` (Task 19)
// atar — `withErrorHandling` typed AppError'ları otomatik HTTP'ye map eder.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { quickStartFromBatch } from "@/server/services/selection/sets.service";
import { QuickStartInputSchema } from "@/server/services/selection/types";

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();

  const json = await req.json().catch(() => null);
  const parsed = QuickStartInputSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }

  const result = await quickStartFromBatch({
    userId: user.id,
    referenceId: parsed.data.referenceId,
    batchId: parsed.data.batchId,
    productTypeId: parsed.data.productTypeId,
  });

  return NextResponse.json({ setId: result.set.id }, { status: 201 });
});
