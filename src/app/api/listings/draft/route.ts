// Phase 9 V1 Task 13 — POST /api/listings/draft route handler.
//
// Spec §6.2: createListingDraftFromMockupJob (Task 3) HTTP'ye expose.
//   - Auth: requireUser
//   - Body: CreateListingDraftSchema
//       { mockupJobId: string }
//   - Service: createListingDraftFromMockupJob
//   - Response 202: { listingId }
//   - Error mapping (withErrorHandling HOF AppError auto-map):
//       ListingHandoffJobNotFoundError → 404
//       ListingHandoffJobNotTerminalError → 409
//       ListingHandoffJobAllFailedError → 409
//       ValidationError (Zod) → 400
//
// Phase 8 emsali: src/app/api/mockup/jobs/route.ts.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { CreateListingDraftSchema } from "@/features/listings/schemas";
import { createListingDraftFromMockupJob } from "@/features/listings/server/handoff.service";

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();

  const json = await req.json().catch(() => ({}));
  const parsed = CreateListingDraftSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }

  const { listingId } = await createListingDraftFromMockupJob(
    parsed.data.mockupJobId,
    user.id,
  );

  return NextResponse.json({ listingId }, { status: 202 });
});
