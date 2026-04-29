// Phase 5 §4 — variation-jobs retry endpoint.
//
// Sözleşme:
//   - Yalnız FAIL state design retry'lanır (R15)
//   - Eski FAIL row DOKUNULMAZ (audit trail)
//   - Yeni design birebir snapshot kopyası: providerId, capabilityUsed,
//     promptSnapshot, briefSnapshot, aspectRatio, quality, promptVersionId
//   - providerTaskId / resultUrl / errorMessage NULL (yeni hayat)
//   - Yeni Job + enqueue; metadata.retryOf = eski design id
//   - Design + Job DB writes tek transaction (atomicity)
//   - Enqueue dış kaynak — fail durumunda design + job FAIL'a düşürülür
//     (silent stuck QUEUED YASAK)
//
// R17.4 sessiz default fallback YOK:
//   - Eski row aspectRatio NULL → 500 fail-fast
//   - Eski row aspectRatio geçersiz format ("9:16-foo") → 500 fail-fast
//     (runtime zod enum guard, `as` cast YOK)
//   - Eski row providerId / promptSnapshot NULL → 500 fail-fast
//     (downstream tip yalan söyleyemez)
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
import { AspectRatioSchema, QualitySchema } from "@/features/variation-generation/schemas";
import { failDesignAndJob } from "@/features/variation-generation/services/ai-generation.service";
import { getUserAiModeSettings } from "@/features/settings/ai-mode/service";

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

  // Simetrik snapshot guard — providerId + promptSnapshot da nullable.
  // Eski FAIL row bu alanları taşımıyorsa downstream tip yalan söylemesin.
  if (!failed.providerId || !failed.promptSnapshot) {
    return NextResponse.json(
      {
        error:
          "Eski FAIL row eksik snapshot (providerId/promptSnapshot) — retry desteklenmiyor.",
      },
      { status: 500 },
    );
  }

  // Runtime enum guard — DB'de aspectRatio free `String?`. `as` cast tipi
  // yalan söylerdi; legacy/manuel edit ile geçersiz değer ("9:16-foo")
  // sızdırılmışsa burada yakalarız.
  const aspectRatioParsed = AspectRatioSchema.safeParse(failed.aspectRatio);
  if (!aspectRatioParsed.success) {
    return NextResponse.json(
      {
        error: `Eski FAIL row aspectRatio geçersiz: ${failed.aspectRatio} — retry desteklenmiyor.`,
      },
      { status: 500 },
    );
  }
  const aspectRatio = aspectRatioParsed.data;

  // Quality opsiyonel — null ise undefined geçer; set ise enum guard.
  let quality: "medium" | "high" | undefined;
  if (failed.quality !== null && failed.quality !== undefined) {
    const qParsed = QualitySchema.safeParse(failed.quality);
    if (!qParsed.success) {
      return NextResponse.json(
        {
          error: `Eski FAIL row quality geçersiz: ${failed.quality} — retry desteklenmiyor.`,
        },
        { status: 500 },
      );
    }
    quality = qParsed.data;
  }

  // Bu noktadan sonra TS narrowing: providerId + promptSnapshot non-null.
  const providerId = failed.providerId;
  const promptSnapshot = failed.promptSnapshot;

  // Phase 5 closeout hotfix (2026-04-29) — per-user kieApiKey resolve.
  // Eksik key durumunda enqueue ÖNCE explicit throw; transaction ÖNCE bail
  // edilir, fresh row yaratılmaz. Phase 6 review provider'ıyla simetrik.
  const aiModeSettings = await getUserAiModeSettings(user.id);
  const kieApiKey = aiModeSettings.kieApiKey;
  if (!kieApiKey || kieApiKey.trim() === "") {
    return NextResponse.json(
      {
        error:
          "kieApiKey ayarlanmamış (Settings → AI Mode'dan KIE anahtarı girin)",
      },
      { status: 400 },
    );
  }

  // R15 — yeni design + job birebir snapshot kopyası, atomik commit.
  // Eski row dokunulmaz. Transaction kısmi DB tutarsızlığını engeller.
  const { fresh, job } = await db.$transaction(async (tx) => {
    const fresh = await tx.generatedDesign.create({
      data: {
        userId: user.id,
        referenceId: failed.referenceId,
        assetId: failed.assetId,
        productTypeId: failed.productTypeId,
        providerId,
        capabilityUsed: failed.capabilityUsed,
        promptSnapshot,
        briefSnapshot: failed.briefSnapshot,
        promptVersionId: failed.promptVersionId,
        state: VariationState.QUEUED,
        aspectRatio: failed.aspectRatio,
        quality: failed.quality,
        // providerTaskId / resultUrl / errorMessage default null — yeni hayat.
      },
    });
    const job = await tx.job.create({
      data: {
        type: JobType.GENERATE_VARIATIONS,
        status: JobStatus.QUEUED,
        userId: user.id,
        progress: 0,
        metadata: { designId: fresh.id, retryOf: failed.id },
      },
    });
    return { fresh, job };
  });

  // Worker payload: i2i ise asset.sourceUrl referenceUrls olarak geçer.
  // capability TEXT_TO_IMAGE ise referenceUrls undefined (provider t2i'a düşer).
  const isI2I = failed.capabilityUsed === VariationCapability.IMAGE_TO_IMAGE;
  const referenceUrls =
    isI2I && failed.reference.asset.sourceUrl
      ? [failed.reference.asset.sourceUrl]
      : undefined;

  // Enqueue dış kaynak — fail olursa design + job FAIL'a düşürülür ve
  // 500 propagate edilir (silent stuck QUEUED YASAK).
  try {
    await enqueue(JobType.GENERATE_VARIATIONS, {
      jobId: job.id,
      userId: user.id,
      designId: fresh.id,
      providerId,
      prompt: promptSnapshot,
      referenceUrls,
      aspectRatio,
      quality,
      // Phase 5 closeout hotfix: per-user kieApiKey worker'a iletilir.
      kieApiKey,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "enqueue failed";
    await failDesignAndJob(fresh.id, job.id, `enqueue failed: ${msg}`);
    return NextResponse.json(
      { error: `enqueue failed: ${msg}`, designId: fresh.id },
      { status: 500 },
    );
  }

  return NextResponse.json({ designId: fresh.id });
}
