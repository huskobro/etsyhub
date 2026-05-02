// Phase 8 Task 20 — POST /api/mockup/jobs/[jobId]/cover route handler.
//
// Spec §4.8: atomic slot swap, cover invariant preservation.
// Request: { renderId: string } (new cover render id)
// Response 200: { jobId, coverRenderId }
// Error codes: INVALID_RENDER, RENDER_NOT_SUCCESS, ALREADY_COVER, JOB_NOT_FOUND

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { swapCover } from "@/features/mockups/server/cover.service";

const ParamsSchema = z.object({ jobId: z.string().cuid() });
const BodySchema = z.object({ renderId: z.string().cuid() });

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: { jobId: string } }) => {
    const user = await requireUser();

    // Validate params
    const params = ParamsSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    // Validate body
    const json = await req.json().catch(() => ({}));
    const body = BodySchema.safeParse(json);
    if (!body.success) {
      throw new ValidationError("Geçersiz body", body.error.flatten());
    }

    // Call service
    const { coverRenderId } = await swapCover(
      params.data.jobId,
      body.data.renderId,
      user.id,
    );

    return NextResponse.json(
      {
        jobId: params.data.jobId,
        coverRenderId,
      },
      { status: 200 },
    );
  },
);
