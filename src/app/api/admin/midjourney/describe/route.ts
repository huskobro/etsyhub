// Pass 66 — Admin "Describe" tetikleyici (Pass 65 audit'in düzeltmesi).
//
// Sözleşme:
//   POST /api/admin/midjourney/describe
//   body: { imageUrl: string (HTTPS), sourceAssetId?: string }
//
// Akış:
//   1. requireAdmin
//   2. createMidjourneyDescribeJob → bridge enqueue + DB row + BullMQ
//   3. JSON döner: { jobId, midjourneyJobId, bridgeJobId }
//   4. Worker arka planda poll'u sürdürür; COMPLETED state'te bridge
//      snapshot.mjMetadata.describePrompts[] → DB'ye yansır
//   5. Operatör detail page'de prompt önerilerini görür (Reuse → Test
//      Render hattına aktarır)

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { createMidjourneyDescribeJob } from "@/server/services/midjourney/midjourney.service";
import { BridgeUnreachableError } from "@/server/services/midjourney/bridge-client";

const body = z.object({
  imageUrl: z.string().url().startsWith("https://"),
  // Opsiyonel: hangi MidjourneyAsset'ten describe edildi (lineage).
  // Server-side cross-check: admin sahipliği + asset varlığı.
  sourceAssetId: z.string().min(1).optional(),
});

export const POST = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();

  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz describe isteği",
      parsed.error.flatten().fieldErrors,
    );
  }

  // Lineage cross-check (opsiyonel)
  if (parsed.data.sourceAssetId) {
    const exists = await db.midjourneyAsset.findFirst({
      where: { id: parsed.data.sourceAssetId },
      select: { id: true, midjourneyJob: { select: { userId: true } } },
    });
    if (!exists || exists.midjourneyJob.userId !== admin.id) {
      // Var olmayan veya farklı user'a ait — sourceAssetId yok say
      // (lineage opsiyonel; describe yine çalışır)
      parsed.data.sourceAssetId = undefined;
    }
  }

  try {
    const result = await createMidjourneyDescribeJob({
      userId: admin.id,
      imageUrl: parsed.data.imageUrl,
      sourceAssetId: parsed.data.sourceAssetId,
    });

    await audit({
      actor: admin.id,
      action: "MIDJOURNEY_DESCRIBE",
      targetType: "MidjourneyJob",
      targetId: result.midjourneyJob.id,
      metadata: {
        bridgeJobId: result.bridgeJobId,
        imageUrl: parsed.data.imageUrl.slice(0, 200),
        sourceAssetId: parsed.data.sourceAssetId ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      jobId: result.jobId,
      midjourneyJobId: result.midjourneyJob.id,
      bridgeJobId: result.bridgeJobId,
    });
  } catch (err) {
    if (err instanceof BridgeUnreachableError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: "BRIDGE_UNREACHABLE" },
        { status: 502 },
      );
    }
    throw err;
  }
});
