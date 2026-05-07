// Pass 53 — Admin retry MJ job.
//
// Sözleşme:
//   POST /api/admin/midjourney/:id/retry
//   200 → { ok, newJobId, newMidjourneyJobId, bridgeJobId }
//   404 → MidjourneyJob yok
//   409 → Job henüz terminal değil (retry sadece FAILED/CANCELLED için)
//   502 → Bridge unreachable
//
// Yeni MJ job oluşturur — eski job'un prompt + promptParams'ını
// kullanır. Akış admin Test Render ile aynı: createMidjourneyJob.
// Eski job'un kendisi olduğu yerde kalır (terminal); audit log
// retry parent ID'sini saklar.

import { NextResponse } from "next/server";
import { z } from "zod";
import { MidjourneyJobState, type Prisma } from "@prisma/client";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { createMidjourneyJob } from "@/server/services/midjourney/midjourney.service";
import {
  BridgeUnreachableError,
  type BridgeAspectRatio,
} from "@/server/services/midjourney/bridge-client";

const TERMINAL_STATES: ReadonlyArray<MidjourneyJobState> = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

const VALID_RATIOS: ReadonlyArray<BridgeAspectRatio> = [
  "1:1",
  "2:3",
  "3:2",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
];

// Pass 54 — opsiyonel edit body. Boşluksuz body veya hiç body
// gönderilmezse eski Pass 53 davranışı (aynı prompt + params).
// Edit verilirse prompt + aspectRatio override; diğer params'lar
// (version, styleRaw, stylize, chaos) eski job'dan miras kalır.
const editBody = z
  .object({
    prompt: z.string().min(3).max(800).optional(),
    aspectRatio: z.enum(VALID_RATIOS as readonly [BridgeAspectRatio, ...BridgeAspectRatio[]]).optional(),
  })
  .optional();

type Ctx = { params: { id: string } };

export const POST = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = ctx.params;

  // Body parse — boş body / fetch JSON parse fail / valid body hepsi
  // güvenle ele alınır.
  let edit: z.infer<typeof editBody> = undefined;
  try {
    const text = await req.text();
    if (text.trim()) {
      const parsed = editBody.safeParse(JSON.parse(text));
      if (!parsed.success) {
        throw new ValidationError(
          "Geçersiz retry body",
          parsed.error.flatten().fieldErrors,
        );
      }
      edit = parsed.data;
    }
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    // JSON parse fail → boş body kabul et.
  }

  const oldJob = await db.midjourneyJob.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      prompt: true,
      promptParams: true,
      state: true,
      referenceId: true,
      productTypeId: true,
    },
  });
  if (!oldJob) throw new NotFoundError("MidjourneyJob bulunamadı");
  if (!TERMINAL_STATES.includes(oldJob.state)) {
    throw new ValidationError(
      `Retry sadece terminal job'larda mümkün. Mevcut state: ${oldJob.state}. Önce iptal edin.`,
    );
  }

  // promptParams Json — runtime'da yapısı bilinmiyor, schema doc'una göre
  // {aspectRatio, version, stylize, chaos, ...}. Default'lara düşelim.
  const params = (oldJob.promptParams as Prisma.JsonObject) ?? {};
  const rawRatio = (params["aspectRatio"] as string | undefined) ?? "1:1";
  const fallbackRatio: BridgeAspectRatio = (
    VALID_RATIOS as ReadonlyArray<string>
  ).includes(rawRatio)
    ? (rawRatio as BridgeAspectRatio)
    : "1:1";

  // Pass 54 — edit override.
  const finalPrompt = edit?.prompt?.trim() || oldJob.prompt;
  const finalAspectRatio = edit?.aspectRatio ?? fallbackRatio;
  const isEdited =
    !!edit &&
    ((edit.prompt !== undefined && edit.prompt.trim() !== oldJob.prompt) ||
      (edit.aspectRatio !== undefined && edit.aspectRatio !== fallbackRatio));

  try {
    const result = await createMidjourneyJob({
      userId: admin.id, // retry'i tetikleyen admin sahip
      prompt: finalPrompt,
      aspectRatio: finalAspectRatio,
      version: params["version"] as string | undefined,
      styleRaw: params["styleRaw"] as boolean | undefined,
      stylize: params["stylize"] as number | undefined,
      chaos: params["chaos"] as number | undefined,
      referenceId: oldJob.referenceId ?? undefined,
      productTypeId: oldJob.productTypeId ?? undefined,
    });

    await audit({
      actor: admin.id,
      action: "MIDJOURNEY_RETRY",
      targetType: "MidjourneyJob",
      targetId: result.midjourneyJob.id,
      metadata: {
        retryOf: oldJob.id,
        edited: isEdited,
        bridgeJobId: result.bridgeJobId,
        prompt: finalPrompt.slice(0, 200),
        aspectRatio: finalAspectRatio,
      },
    });

    return NextResponse.json({
      ok: true,
      newJobId: result.jobId,
      newMidjourneyJobId: result.midjourneyJob.id,
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
