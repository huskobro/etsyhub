/**
 * Phase 43 — POST /api/batches
 *
 * Body: { referenceIds?: string[], label?: string }
 *
 * Yeni DRAFT Batch yaratır. Pool card "New Batch" CTA bu endpoint'i
 * tek reference ile çağırır; compose page'den de boş batch yaratmak
 * mümkün (referenceIds = [] kabul edilir).
 *
 * Response: { batch: { id, label, state, ... } }
 *
 * Auth: requireUser. Schema-zero — yeni surface yok, mevcut
 * /api/batches namespace'ine yalnız route.ts eklenir.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { createDraftBatch } from "@/features/batches/server/batch-service";

const BodySchema = z.object({
  referenceIds: z.array(z.string().min(1)).max(200).optional(),
  label: z.string().max(200).optional(),
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new ValidationError("Invalid input", parsed.error.flatten());
  }
  const batch = await createDraftBatch({
    userId: user.id,
    referenceIds: parsed.data.referenceIds ?? [],
    label: parsed.data.label,
  });
  return NextResponse.json(
    {
      batch: {
        id: batch.id,
        label: batch.label,
        state: batch.state,
        itemCount: batch.items.length,
        createdAt: batch.createdAt,
      },
    },
    { status: 201 },
  );
});
