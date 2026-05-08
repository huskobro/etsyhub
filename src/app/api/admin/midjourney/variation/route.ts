// Pass 83 — Admin variation tetikleyici.
//
// Sözleşme:
//   POST /api/admin/midjourney/variation
//   body: {
//     midjourneyAssetId: string (parent GRID asset),
//     mode?: "subtle" | "strong" (default "subtle"),
//     submitStrategy?: "auto" | "api-first" | "dom-first"
//   }
//   200 → { ok, jobId, midjourneyJobId, bridgeJobId, parentMjJobId,
//           gridIndex, mode }
//   400 → invalid body / parent asset GRID değil
//   404 → MidjourneyAsset bulunamadı
//   502 → BridgeUnreachable
//
// Pass 83 capture-doğrulanmış MJ V8 web kontratı:
//   /api/submit-jobs body { f, channelId, metadata (all null), t:"vary",
//     strong:bool, id:<parentMjJobId>, index:<0..3> }
//   → response success[].job_id (yeni 4-grid render)

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import { createMidjourneyVariationJob } from "@/server/services/midjourney/variation";
import { BridgeUnreachableError } from "@/server/services/midjourney/bridge-client";

const body = z.object({
  midjourneyAssetId: z.string().min(1),
  // Pass 83 capture: subtle (strong:false) | strong (strong:true)
  mode: z.enum(["subtle", "strong"]).default("subtle"),
  submitStrategy: z.enum(["auto", "api-first", "dom-first"]).optional(),
});

export const POST = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();

  const text = await req.text();
  if (!text.trim()) throw new ValidationError("Boş body");
  let parsed;
  try {
    parsed = body.safeParse(JSON.parse(text));
  } catch {
    throw new ValidationError("Geçersiz JSON");
  }
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz variation body",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const result = await createMidjourneyVariationJob({
      actorUserId: admin.id,
      parentMidjourneyAssetId: parsed.data.midjourneyAssetId,
      mode: parsed.data.mode,
      submitStrategy: parsed.data.submitStrategy,
    });

    await audit({
      actor: admin.id,
      action: "MIDJOURNEY_VARIATION",
      targetType: "MidjourneyAsset",
      targetId: parsed.data.midjourneyAssetId,
      metadata: {
        mode: parsed.data.mode,
        bridgeJobId: result.bridgeJobId,
        midjourneyJobId: result.midjourneyJob.id,
        parentMjJobId: result.parentMjJobId,
        gridIndex: result.gridIndex,
        submitStrategy: parsed.data.submitStrategy ?? "auto",
      },
    });

    return NextResponse.json({
      ok: true,
      jobId: result.jobId,
      midjourneyJobId: result.midjourneyJob.id,
      bridgeJobId: result.bridgeJobId,
      parentMjJobId: result.parentMjJobId,
      gridIndex: result.gridIndex,
      mode: parsed.data.mode,
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
