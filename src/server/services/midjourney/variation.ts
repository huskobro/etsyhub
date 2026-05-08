// Pass 83 — Variation V1 service.
//
// Sözleşme:
//   • Operatör detail page'de bir grid asset için "Variation Subtle/Strong"
//     tıklar.
//   • Service parent MidjourneyAsset'ten gridIndex + parent MidjourneyJob'un
//     mjJobId'sini alır → BridgeVariationRequest oluşturur → bridge enqueue.
//   • Yeni MidjourneyJob row'u (kind=VARIATION, prompt="(variation X of …)").
//   • Yeni Job row'u (type=MIDJOURNEY_BRIDGE, status=QUEUED).
//   • BullMQ worker poll → ingestOutputs variation-aware (variantKind=VARIATION,
//     parentAssetId; 4 child asset).
//
// Pass 83 capture-doğrulanmış MJ V8 web kontrat:
//   POST /api/submit-jobs body: { f, channelId, metadata (all null),
//     t:"vary", strong:bool, id:<parentMjJobId>, index:<gridIndex> }
//   response: { success:[{ job_id, prompt (inherited), event_type:"variation",
//     job_type:"v7_diffusion", meta:{ batch_size:4, parent_id, parent_grid }}] }
//
// Discord-only DEĞİL (AutoSail sendVariation Discord callCommand kullanıyor;
// bu pattern V8 web'de gerekli değil).
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
  type BridgeVariationRequest,
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

export type CreateVariationInput = {
  /** Caller user (admin) — yeni MJ Job sahibi. */
  actorUserId: string;
  /** Parent MidjourneyAsset (variantKind=GRID olan) — bu grid variation'ı yapılır. */
  parentMidjourneyAssetId: string;
  /** Pass 83 capture: subtle (strong:false) | strong (strong:true). */
  mode?: "subtle" | "strong";
  /**
   * Pass 78 — Universal submit strategy. Variation Pass 83'te API-only;
   * bu alan metadata'da raporlama için saklanır + ileride DOM fallback
   * eklenince native davranışı tetikler. Default "auto" → API-first.
   */
  submitStrategy?: "auto" | "api-first" | "dom-first";
};

export type CreateVariationResult = {
  midjourneyJob: MidjourneyJob;
  jobId: string;
  bridgeJobId: string;
  parentMjJobId: string;
  gridIndex: number;
  mode: "subtle" | "strong";
};

export async function createMidjourneyVariationJob(
  input: CreateVariationInput,
  bridgeClient: BridgeClient = getBridgeClient(),
): Promise<CreateVariationResult> {
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
      `Sadece GRID asset'lerden variation yapılabilir; mevcut: ${parentAsset.variantKind}`,
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
  const bridgeReq: BridgeVariationRequest = {
    kind: "variation",
    parentMjJobId,
    gridIndex,
    mode,
    ...(input.submitStrategy ? { submitStrategy: input.submitStrategy } : {}),
  };
  const snapshot = await bridgeClient.enqueueJob(bridgeReq);

  // DB transaction: yeni Job + yeni MidjourneyJob (kind=VARIATION)
  const result = await db.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        userId: input.actorUserId,
        type: JobType.MIDJOURNEY_BRIDGE,
        status: JobStatus.QUEUED,
        metadata: {
          bridgeJobId: snapshot.id,
          variationOf: parentAsset.id,
          mode,
        },
      },
    });
    const mjJob = await tx.midjourneyJob.create({
      data: {
        userId: input.actorUserId,
        jobId: job.id,
        bridgeJobId: snapshot.id,
        kind: MidjourneyJobKind.VARIATION,
        state: BRIDGE_TO_DB_STATE[snapshot.state] ?? MidjourneyJobState.QUEUED,
        // Variation prompt parent'tan inherit; UI gösterim için snapshot.
        prompt: `(variation ${mode} of ${parentAsset.midjourneyJob.prompt.slice(0, 100)})`,
        promptParams: {
          variation: { mode, parentMjJobId, gridIndex },
        } as unknown as Prisma.InputJsonValue,
      },
    });
    return { job, mjJob };
  });

  // BullMQ worker enqueue — variationParentAssetId payload'da
  const payload: MidjourneyBridgeJobPayload = {
    userId: input.actorUserId,
    midjourneyJobId: result.mjJob.id,
    jobId: result.job.id,
    variationParentAssetId: parentAsset.id,
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
    "midjourney variation job created (bridge accepted + worker enqueued)",
  );

  return {
    midjourneyJob: result.mjJob,
    jobId: result.job.id,
    bridgeJobId: snapshot.id,
    parentMjJobId,
    gridIndex,
    mode,
  };
}
