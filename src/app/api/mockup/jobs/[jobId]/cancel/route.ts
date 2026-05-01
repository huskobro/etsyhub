// Phase 8 Task 19 — POST /api/mockup/jobs/[jobId]/cancel route handler.
//
// Spec §5.2: Kullanıcı tarafından job iptal etme.
//   - Auth: requireUser (UnauthorizedError 401 otomatik)
//   - Path param: jobId
//   - Service: cancelJob(jobId, userId) — Task 6
//     Kurallar:
//       - QUEUED/RUNNING → CANCELLED (idempotent state transition)
//       - Terminal job → JobAlreadyTerminalError (409)
//       - Cross-user / yok → JobNotFoundError (404)
//   - Response 200: { status: "CANCELLED" } (job.status sync)
//   - Error mapping: withErrorHandling HOF AppError.statusCode → HTTP.
//
// Phase 7 emsali: src/app/api/selection/sets/[setId]/finalize/route.ts.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { cancelJob } from "@/features/mockups/server/job.service";

export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: { jobId: string } }) => {
    const user = await requireUser();

    // Task 6: cancelJob atomic transaction + AppError throw.
    // Hata: JobNotFoundError (404), JobAlreadyTerminalError (409).
    await cancelJob(ctx.params.jobId, user.id);

    return NextResponse.json(
      { status: "CANCELLED" },
      { status: 200 }
    );
  }
);
