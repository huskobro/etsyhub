// Phase 8 Task 21 — GET /api/mockup/jobs/[jobId]/download route handler.
//
// Spec §4.6: Bulk ZIP download — packPosition ASC, cover-first, success only.
//   - Auth: requireUser
//   - Path: jobId Zod cuid
//   - Service: buildMockupZip(jobId, userId)
//   - Response 200: application/zip + Content-Disposition attachment
//   - Errors:
//       JobNotFoundError → 404
//       JobNotDownloadableError → 403

import { z } from "zod";
import { requireUser } from "@/server/session";
import { errorResponse } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  buildMockupZip,
  JobNotDownloadableError,
} from "@/features/mockups/server/download.service";
import { JobNotFoundError } from "@/features/mockups/server/job.service";

const ParamsSchema = z.object({ jobId: z.string().cuid() });

export async function GET(
  _req: Request,
  ctx: { params: { jobId: string } },
) {
  try {
    const user = await requireUser();

    // Validate params
    const params = ParamsSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    // Service
    const { buffer, filename } = await buildMockupZip(
      params.data.jobId,
      user.id,
    );

    // Return ZIP
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
