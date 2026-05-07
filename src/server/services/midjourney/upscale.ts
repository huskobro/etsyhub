// Pass 60 — Upscale job creation service.
//
// Sözleşme:
//   • Operatör detail page'de bir grid asset için "Upscale Subtle" tıklar.
//   • Service parent MidjourneyAsset'ten gridIndex + parent MidjourneyJob'un
//     mjJobId'sini alır → BridgeUpscaleRequest oluşturur → bridge enqueue.
//   • Yeni MidjourneyJob row'u (kind=UPSCALE, prompt="(upscale of ...)").
//   • Yeni Job row'u (type=MIDJOURNEY_BRIDGE, status=QUEUED).
//   • BullMQ worker poll → ingestOutputs upscale-aware (variantKind=UPSCALE,
//     parentAssetId).
//
// Cross-user kontrol: parent MJ Job, request'i tetikleyen kullanıcıya ait
// olmalı (admin için cross-user yapılandırma policy'si caller route'da).

import {
  JobType,
  JobStatus,
  MidjourneyJobKind,
  MidjourneyJobState,
  Prisma,
  type MidjourneyJob,
} from "@prisma/client";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { enqueue } from "@/server/queue";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { MidjourneyBridgeJobPayload } from "@/server/workers/midjourney-bridge.worker";
import {
  getBridgeClient,
  type BridgeClient,
  type BridgeUpscaleRequest,
} from "./bridge-client";

const BRIDGE_TO_DB_STATE: Record<string, MidjourneyJobState> = {
  QUEUED: MidjourneyJobState.QUEUED,
  OPENING_BROWSER: MidjourneyJobState.OPENING_BROWSER,
  AWAITING_LOGIN: MidjourneyJobState.AWAITING_LOGIN,
  AWAITING_CHALLENGE: MidjourneyJobState.AWAITING_CHALLENGE,
  SUBMITTING_PROMPT: MidjourneyJobState.SUBMITTING_PROMPT,
  WAITING_FOR_RENDER: MidjourneyJobState.WAITING_FOR_RENDER,
  COLLECTING_OUTPUTS: MidjourneyJobState.COLLECTING_OUTPUTS,
  DOWNLOADING: MidjourneyJobState.DOWNLOADING,
  IMPORTING: MidjourneyJobState.IMPORTING,
  COMPLETED: MidjourneyJobState.COMPLETED,
  FAILED: MidjourneyJobState.FAILED,
  CANCELLED: MidjourneyJobState.CANCELLED,
};

export type CreateUpscaleInput = {
  /** Caller user (admin) — yeni MJ Job sahibi. */
  actorUserId: string;
  /** Parent MidjourneyAsset (variantKind=GRID olan) — bu grid upscale edilir. */
  parentMidjourneyAssetId: string;
  /** MVP: "subtle" varsayılan. */
  mode?: "subtle" | "creative";
  /**
   * Pass 78 — Universal submit strategy. Upscale şu an DOM-only (Pass 61);
   * bu alan metadata'da raporlama için saklanır. Default "auto".
   */
  submitStrategy?: "auto" | "api-first" | "dom-first";
};

export type CreateUpscaleResult = {
  midjourneyJob: MidjourneyJob;
  jobId: string;
  bridgeJobId: string;
  parentMjJobId: string;
  gridIndex: number;
};

export async function createMidjourneyUpscaleJob(
  input: CreateUpscaleInput,
  bridgeClient: BridgeClient = getBridgeClient(),
): Promise<CreateUpscaleResult> {
  const mode = input.mode ?? "subtle";

  // Parent MidjourneyAsset + MidjourneyJob lookup
  const parentAsset = await db.midjourneyAsset.findUnique({
    where: { id: input.parentMidjourneyAssetId },
    select: {
      id: true,
      gridIndex: true,
      variantKind: true,
      midjourneyJobId: true,
      midjourneyJob: {
        select: { id: true, mjJobId: true, prompt: true, userId: true },
      },
    },
  });
  if (!parentAsset) {
    throw new NotFoundError("Parent MidjourneyAsset bulunamadı");
  }
  if (parentAsset.variantKind !== "GRID") {
    throw new ValidationError(
      `Sadece GRID asset'ler upscale edilebilir; mevcut: ${parentAsset.variantKind}`,
    );
  }
  if (!parentAsset.midjourneyJob.mjJobId) {
    throw new ValidationError(
      "Parent MJ Job henüz mjJobId'ye sahip değil (render tamamlanmamış olabilir)",
    );
  }
  if (parentAsset.gridIndex < 0 || parentAsset.gridIndex > 3) {
    throw new ValidationError(
      `Invalid gridIndex: ${parentAsset.gridIndex} (0..3 beklenir)`,
    );
  }

  const parentMjJobId = parentAsset.midjourneyJob.mjJobId;
  const gridIndex = parentAsset.gridIndex as 0 | 1 | 2 | 3;

  // Bridge enqueue
  const bridgeReq: BridgeUpscaleRequest = {
    kind: "upscale",
    parentMjJobId,
    gridIndex,
    mode,
    // Pass 78 — strategy forward (geriye uyumlu, opsiyonel)
    ...(input.submitStrategy ? { submitStrategy: input.submitStrategy } : {}),
  };
  const snapshot = await bridgeClient.enqueueJob(bridgeReq);

  // DB transaction: yeni Job + yeni MidjourneyJob (kind=UPSCALE)
  const result = await db.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        userId: input.actorUserId,
        type: JobType.MIDJOURNEY_BRIDGE,
        status: JobStatus.QUEUED,
        metadata: {
          bridgeJobId: snapshot.id,
          upscaleOf: parentAsset.id,
          mode,
        },
      },
    });
    const mjJob = await tx.midjourneyJob.create({
      data: {
        userId: input.actorUserId,
        jobId: job.id,
        bridgeJobId: snapshot.id,
        kind: MidjourneyJobKind.UPSCALE,
        state: BRIDGE_TO_DB_STATE[snapshot.state] ?? MidjourneyJobState.QUEUED,
        // Upscale prompt yok; parent prompt'u snapshot olarak göster.
        prompt: `(upscale ${mode} of ${parentAsset.midjourneyJob.prompt.slice(0, 100)})`,
        promptParams: {
          upscale: { mode, parentMjJobId, gridIndex },
        } as unknown as Prisma.InputJsonValue,
      },
    });
    return { job, mjJob };
  });

  // BullMQ worker enqueue
  const payload: MidjourneyBridgeJobPayload = {
    userId: input.actorUserId,
    midjourneyJobId: result.mjJob.id,
    jobId: result.job.id,
    // Pass 60 — upscale lineage payload'da: ingest sırasında parent asset
    // bağlantısı kurulurken kullanılır.
    upscaleParentAssetId: parentAsset.id,
  };
  await enqueue(
    JobType.MIDJOURNEY_BRIDGE,
    payload as unknown as Record<string, unknown>,
  );

  logger.info(
    {
      midjourneyJobId: result.mjJob.id,
      bridgeJobId: snapshot.id,
      parentMjJobId,
      gridIndex,
      mode,
    },
    "midjourney upscale job created (bridge accepted + worker enqueued)",
  );

  return {
    midjourneyJob: result.mjJob,
    jobId: result.job.id,
    bridgeJobId: snapshot.id,
    parentMjJobId,
    gridIndex,
  };
}
