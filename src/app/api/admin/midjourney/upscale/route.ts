// Pass 60 — Admin upscale tetikleyici.
//
// Sözleşme:
//   POST /api/admin/midjourney/upscale
//   body: { midjourneyAssetId: string, mode?: "subtle" | "creative" }
//   200 → { ok, jobId, midjourneyJobId, bridgeJobId, parentMjJobId, gridIndex, mode }
//   400 → invalid body / parent asset GRID değil
//   404 → MidjourneyAsset bulunamadı
//   502 → BridgeUnreachable
//
// MVP: mode default "subtle". Detail page'de her grid altında tek
// "⤴ Upscale (Subtle)" buton. Creative ileride eklenir.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import { createMidjourneyUpscaleJob } from "@/server/services/midjourney/upscale";
import { BridgeUnreachableError } from "@/server/services/midjourney/bridge-client";

const body = z.object({
  midjourneyAssetId: z.string().min(1),
  mode: z.enum(["subtle", "creative"]).default("subtle"),
  // Pass 78 — Universal submit strategy
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
      "Geçersiz upscale body",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const result = await createMidjourneyUpscaleJob({
      actorUserId: admin.id,
      parentMidjourneyAssetId: parsed.data.midjourneyAssetId,
      mode: parsed.data.mode,
      // Pass 78 — strategy forward
      submitStrategy: parsed.data.submitStrategy,
    });

    await audit({
      actor: admin.id,
      action: "MIDJOURNEY_UPSCALE",
      targetType: "MidjourneyAsset",
      targetId: parsed.data.midjourneyAssetId,
      metadata: {
        mode: parsed.data.mode,
        bridgeJobId: result.bridgeJobId,
        midjourneyJobId: result.midjourneyJob.id,
        parentMjJobId: result.parentMjJobId,
        gridIndex: result.gridIndex,
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
