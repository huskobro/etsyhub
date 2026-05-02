// Phase 9 V1 Task 16 — POST /api/listings/draft/[id]/generate-meta route handler.
//
// Auth + ownership + Zod body + generateListingMeta service çağrısı.
// Response: { output: { title, description, tags }, providerSnapshot, promptVersion }
//
// Error mapping (withErrorHandling HOF AppError auto-map):
//   ListingMetaListingNotFoundError → 404 (cross-user 404 dahil)
//   ListingMetaProviderNotConfiguredError → 400
//   ListingMetaProviderError → 502
//   ValidationError (Zod) → 400
//
// Auto-save YOK — kullanıcı UI'da output'u görür, ister edit eder, ister
// mevcut PATCH /api/listings/draft/[id] ile save eder.
//
// Phase 9 emsali: src/app/api/listings/draft/[id]/route.ts (PATCH handler).

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  ListingDraftPathSchema,
  GenerateListingMetaSchema,
} from "@/features/listings/schemas";
import { generateListingMeta } from "@/features/listings/server/generate-meta.service";

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();

    const params = ListingDraftPathSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    const json = await req.json().catch(() => ({}));
    const body = GenerateListingMetaSchema.safeParse(json);
    if (!body.success) {
      throw new ValidationError("Geçersiz body", body.error.flatten());
    }

    const result = await generateListingMeta(params.data.id, user.id, {
      productType: body.data.productType,
      toneHint: body.data.toneHint ?? null,
    });

    return NextResponse.json(result);
  },
);
