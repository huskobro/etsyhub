// Phase 5 §4 — variation-jobs retry endpoint.
//
// Sözleşme:
//   - Yalnız FAIL state design retry'lanır (R15)
//   - Eski FAIL row DOKUNULMAZ (audit trail)
//   - Yeni design birebir snapshot kopyası: providerId, capabilityUsed,
//     promptSnapshot, briefSnapshot, aspectRatio, quality, promptVersionId
//   - providerTaskId / resultUrl / errorMessage NULL (yeni hayat)
//   - Yeni Job + enqueue; metadata.retryOf = eski design id
//
// R17.4 sessiz default fallback YOK:
//   - Eski row aspectRatio NULL ise (Phase 5 öncesi) → 500 fail-fast
//     "bu kayıt retry desteklenmiyor". Sessizce default'a düşmek YASAK.
import { NextResponse } from "next/server";
import {
  JobStatus,
  JobType,
  VariationCapability,
  VariationState,
} from "@prisma/client";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { enqueue } from "@/server/queue";
import type { ImageGenerateInput } from "@/providers/image/types";

type Ctx = { params: { id: string } };

export async function POST(_req: Request, ctx: Ctx) {
  let user: { id: string };
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Ownership + state guard tek findFirst.
  const failed = await db.generatedDesign.findFirst({
    where: { id: ctx.params.id, userId: user.id, state: VariationState.FAIL },
    include: { reference: { include: { asset: true } } },
  });
  if (!failed) {
    return NextResponse.json(
      { error: "not found or not in FAIL state" },
      { status: 404 },
    );
  }

  // R17.4 — sessiz default fallback yok. Phase 5 öncesi rows aspectRatio NULL.
  if (!failed.aspectRatio) {
    return NextResponse.json(
      {
        error:
          "Eski FAIL row aspectRatio missing — bu kayıt Phase 5 öncesi; retry desteklenmiyor.",
      },
      { status: 500 },
    );
  }

  // R15 — yeni design birebir snapshot kopyası. Eski row dokunulmaz.
  const fresh = await db.generatedDesign.create({
    data: {
      userId: user.id,
      referenceId: failed.referenceId,
      assetId: failed.assetId,
      productTypeId: failed.productTypeId,
      providerId: failed.providerId,
      capabilityUsed: failed.capabilityUsed,
      promptSnapshot: failed.promptSnapshot,
      briefSnapshot: failed.briefSnapshot,
      promptVersionId: failed.promptVersionId,
      state: VariationState.QUEUED,
      aspectRatio: failed.aspectRatio,
      quality: failed.quality,
      // providerTaskId / resultUrl / errorMessage default null — yeni hayat.
    },
  });

  const job = await db.job.create({
    data: {
      type: JobType.GENERATE_VARIATIONS,
      status: JobStatus.QUEUED,
      userId: user.id,
      progress: 0,
      metadata: { designId: fresh.id, retryOf: failed.id },
    },
  });

  // Worker payload: i2i ise asset.sourceUrl referenceUrls olarak geçer.
  // capability TEXT_TO_IMAGE ise referenceUrls undefined (provider t2i'a düşer).
  const isI2I = failed.capabilityUsed === VariationCapability.IMAGE_TO_IMAGE;
  const referenceUrls =
    isI2I && failed.reference.asset.sourceUrl
      ? [failed.reference.asset.sourceUrl]
      : undefined;

  await enqueue(JobType.GENERATE_VARIATIONS, {
    jobId: job.id,
    userId: user.id,
    designId: fresh.id,
    providerId: failed.providerId!,
    prompt: failed.promptSnapshot!,
    referenceUrls,
    aspectRatio: failed.aspectRatio as ImageGenerateInput["aspectRatio"],
    quality: (failed.quality ?? undefined) as
      | ImageGenerateInput["quality"]
      | undefined,
  });

  return NextResponse.json({ designId: fresh.id });
}
