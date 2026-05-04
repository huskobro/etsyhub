// V1 final completion — Per-render PNG/JPG download.
//
// UI: S8ResultView hover "İndir" butonu (cover image + grid item'larda)
// bu URL'e link ediyor. Backend daha önce eksikti (dead CTA → 404);
// release-readiness "Phase 9.1+ carry-forward" listesinden V1'e alındı.
//
// Spec emsali: bulk ZIP endpoint (Phase 8 Task 21) — aynı ownership +
// status guard pattern. Tek fark: bütün ZIP yerine tek PNG/JPG döner.
//
// Auth: requireUser
// Path: jobId + renderId Zod cuid
// Service: downloadSingleRender(jobId, renderId, userId)
// Response 200: image/png|image/jpeg + Content-Disposition attachment
// Errors:
//   RenderNotFoundError → 404 (yok / cross-user / job mismatch)
//   RenderNotDownloadableError → 409 (status SUCCESS değil veya outputKey null)

import { z } from "zod";
import { requireUser } from "@/server/session";
import { errorResponse } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { downloadSingleRender } from "@/features/mockups/server/download.service";

const ParamsSchema = z.object({
  jobId: z.string().cuid(),
  renderId: z.string().cuid(),
});

export async function GET(
  _req: Request,
  ctx: { params: { jobId: string; renderId: string } },
) {
  try {
    const user = await requireUser();

    const params = ParamsSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    const { buffer, filename, contentType } = await downloadSingleRender(
      params.data.jobId,
      params.data.renderId,
      user.id,
    );

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
