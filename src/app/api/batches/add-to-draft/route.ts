/**
 * Phase 45 — POST /api/batches/add-to-draft
 *
 * Body: { referenceIds: string[] }
 *
 * Mevcut DRAFT batch varsa onu kullan; yoksa yeni yarat. addReferencesToCurrentDraft
 * iki davranışı tek service çağrısı olarak sunar.
 *
 * Pool card "Add to Draft" + bulk-bar "Add N to Draft" CTA'ları tek
 * endpoint'i çağırır. UI'da operatör "active draft" karmaşası yaşamaz
 * — sistem her zaman doğru hedefe yazar.
 *
 * Response: { batch: BatchWithItems } — caller queue panel'ini bu
 * payload ile refresh edebilir.
 *
 * Auth: requireUser. Schema-zero.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { addReferencesToCurrentDraft } from "@/features/batches/server/batch-service";

const BodySchema = z.object({
  referenceIds: z.array(z.string().min(1)).min(1).max(200),
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new ValidationError("Invalid input", parsed.error.flatten());
  }
  const batch = await addReferencesToCurrentDraft({
    userId: user.id,
    referenceIds: parsed.data.referenceIds,
  });
  return NextResponse.json({ batch });
});
