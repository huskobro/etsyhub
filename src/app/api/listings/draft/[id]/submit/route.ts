// Phase 9 V1 Task 17 — POST /api/listings/draft/[id]/submit endpoint.
//
// Auth + ownership + status guard + service çağrısı + AppError auto-map.
// Honest fail: Etsy not configured → 503; connection yoksa → 400; token
// expired → 401; readiness missing fields → 422; provider HTTP error → 502.
//
// V1 SÖZLEŞMESI: UI bağlantısı YOK — endpoint reachable ama "Taslak Gönder"
// button ListingDraftView'da hâlâ disabled (Phase 9 V1 sözleşmesi: kullanıcı
// önce Etsy bağlantısı kurmalı, sonra UI button aktive olur).
//
// Test edilebilir: integration test'ler 404/409/422/503/400 path'ini doğrular;
// happy path (mock provider) PUBLISHED state'e çekildiği doğrulanır.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  ListingDraftPathSchema,
  SubmitListingDraftSchema,
} from "@/features/listings/schemas";
import { submitListingDraft } from "@/features/listings/server/submit.service";

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();

    const params = ListingDraftPathSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    const json = await req.json().catch(() => ({}));
    const body = SubmitListingDraftSchema.safeParse(json);
    if (!body.success) {
      throw new ValidationError("Geçersiz body", body.error.flatten());
    }

    const result = await submitListingDraft(params.data.id, user.id);

    return NextResponse.json(result);
  },
);
