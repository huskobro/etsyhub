// Midjourney service — yeni job enqueue + bridge ingest orchestration.
//
// Sözleşme:
//   1. createMidjourneyJob: kullanıcıdan gelen prompt+params'ı bridge'e
//      gönderir, EtsyHub `Job` + `MidjourneyJob` row'larını açar, BullMQ
//      MIDJOURNEY_BRIDGE worker'ı tetikler.
//   2. pollAndUpdate: worker'ın çağırdığı; bridge'den state çeker, DB'yi
//      senkronize eder, terminal state'te ingest tetikler.
//   3. ingestOutputs: COLLECTING_OUTPUTS / COMPLETED state'te bridge'den
//      her grid item'ı download eder, MinIO'ya upload eder, Asset +
//      MidjourneyAsset row'larını açar.
//
// Pass 42 V1 SCOPE:
//   - Yalnız `kind: generate`. Describe/Upscale/Variation V1.x carry-forward.
//   - `referenceId` opsiyonel (image-to-image değil; sadece lineage tag).
//   - GeneratedDesign opt-in — default oluşturulmaz; UI'dan "Review'a
//     gönder" tetikler (Pass 42 V1: stub, V1.x'te eklenecek).

import { JobType, JobStatus, MidjourneyJobState, MidjourneyJobKind, MJVariantKind, Prisma, type MidjourneyJob } from "@prisma/client";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { sha256 } from "@/lib/hash";
import { getStorage } from "@/providers/storage";
import { env } from "@/lib/env";
import { enqueue } from "@/server/queue";
import type { MidjourneyBridgeJobPayload } from "@/server/workers/midjourney-bridge.worker";
import {
  BridgeUnreachableError,
  getBridgeClient,
  type BridgeClient,
  type BridgeGenerateRequest,
  type BridgeJobSnapshot,
  type BridgeJobState,
} from "./bridge-client";
import { bulkPromoteMidjourneyAssets } from "./promote";

/**
 * Bridge → DB state map (string identical, ama Prisma enum tip'ine cast).
 */
const STATE_MAP: Record<BridgeJobState, MidjourneyJobState> = {
  QUEUED: "QUEUED",
  OPENING_BROWSER: "OPENING_BROWSER",
  AWAITING_LOGIN: "AWAITING_LOGIN",
  AWAITING_CHALLENGE: "AWAITING_CHALLENGE",
  SUBMITTING_PROMPT: "SUBMITTING_PROMPT",
  WAITING_FOR_RENDER: "WAITING_FOR_RENDER",
  COLLECTING_OUTPUTS: "COLLECTING_OUTPUTS",
  DOWNLOADING: "DOWNLOADING",
  IMPORTING: "IMPORTING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
};

const TERMINAL_STATES: ReadonlyArray<MidjourneyJobState> = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export type CreateMidjourneyJobInput = {
  userId: string;
  prompt: string;
  aspectRatio: BridgeGenerateRequest["params"]["aspectRatio"];
  version?: string;
  referenceId?: string;
  productTypeId?: string;
  /** Ek params — promptParams JSON'a yazılır. */
  styleRaw?: boolean;
  stylize?: number;
  chaos?: number;
};

export type CreateMidjourneyJobResult = {
  midjourneyJob: MidjourneyJob;
  /** EtsyHub Job entity id — admin/jobs sayfasında görünür. */
  jobId: string;
  /** Bridge tarafı UUID. */
  bridgeJobId: string;
};

/**
 * Yeni MJ job enqueue.
 *
 * Akış:
 *   1. Bridge'e POST /jobs (sync — bridge anında accept eder, state QUEUED).
 *   2. EtsyHub `Job` row açılır (type: MIDJOURNEY_BRIDGE).
 *   3. EtsyHub `MidjourneyJob` row açılır (bridgeJobId + jobId bağlı).
 *   4. BullMQ MIDJOURNEY_BRIDGE queue'ya polling job ekle.
 *   5. Caller (Variation Atölyesi UI veya admin) snapshot döndürülür.
 */
export async function createMidjourneyJob(
  input: CreateMidjourneyJobInput,
  bridgeClient: BridgeClient = getBridgeClient(),
): Promise<CreateMidjourneyJobResult> {
  // 1) Bridge enqueue.
  const bridgeReq: BridgeGenerateRequest = {
    kind: "generate",
    params: {
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      version: input.version,
      styleRaw: input.styleRaw,
      stylize: input.stylize,
      chaos: input.chaos,
    },
  };
  const snapshot = await bridgeClient.enqueueJob(bridgeReq);

  // 2-3) DB rows — atomic.
  const result = await db.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        userId: input.userId,
        type: JobType.MIDJOURNEY_BRIDGE,
        status: JobStatus.QUEUED,
        metadata: {
          bridgeJobId: snapshot.id,
          prompt: input.prompt.slice(0, 200), // truncate (admin display)
        },
      },
    });
    const mjJob = await tx.midjourneyJob.create({
      data: {
        userId: input.userId,
        jobId: job.id,
        referenceId: input.referenceId,
        productTypeId: input.productTypeId,
        bridgeJobId: snapshot.id,
        kind: MidjourneyJobKind.GENERATE,
        state: STATE_MAP[snapshot.state],
        prompt: input.prompt,
        promptParams: bridgeReq.params as unknown as Prisma.InputJsonValue,
      },
    });
    return { job, mjJob };
  });

  // Pass 50 — eksik BullMQ enqueue. Bridge job kabul etti; şimdi
  // EtsyHub worker'ı polling'e yönelik tetikle.
  const payload: MidjourneyBridgeJobPayload = {
    userId: input.userId,
    midjourneyJobId: result.mjJob.id,
    jobId: result.job.id,
  };
  await enqueue(JobType.MIDJOURNEY_BRIDGE, payload as unknown as Record<string, unknown>);

  logger.info(
    {
      userId: input.userId,
      midjourneyJobId: result.mjJob.id,
      bridgeJobId: snapshot.id,
    },
    "midjourney job created (bridge accepted + worker enqueued)",
  );

  return {
    midjourneyJob: result.mjJob,
    jobId: result.job.id,
    bridgeJobId: snapshot.id,
  };
}

/**
 * Worker polling step — bridge state → DB.
 *
 * Worker bunu 3sn aralıkla çağırır. Terminal state'e ulaşıldığında
 * `COMPLETED` ise ingest tetikler.
 *
 * Bridge erişilemez → MidjourneyJob FAILED + blockReason "browser-crashed".
 */
export async function pollAndUpdate(
  midjourneyJobId: string,
  bridgeClient: BridgeClient = getBridgeClient(),
): Promise<{ state: MidjourneyJobState; isTerminal: boolean }> {
  const mjJob = await db.midjourneyJob.findUniqueOrThrow({
    where: { id: midjourneyJobId },
  });
  if (TERMINAL_STATES.includes(mjJob.state)) {
    return { state: mjJob.state, isTerminal: true };
  }

  let snapshot: BridgeJobSnapshot;
  try {
    snapshot = await bridgeClient.getJob(mjJob.bridgeJobId);
  } catch (err) {
    if (err instanceof BridgeUnreachableError) {
      const updated = await db.midjourneyJob.update({
        where: { id: midjourneyJobId },
        data: {
          state: MidjourneyJobState.FAILED,
          blockReason: "browser-crashed",
          failedReason: err.message,
          failedAt: new Date(),
        },
      });
      // EtsyHub Job side
      if (mjJob.jobId) {
        await db.job.update({
          where: { id: mjJob.jobId },
          data: {
            status: JobStatus.FAILED,
            error: err.message,
            finishedAt: new Date(),
          },
        });
      }
      return { state: updated.state, isTerminal: true };
    }
    throw err;
  }

  const newState = STATE_MAP[snapshot.state];
  const updates: Prisma.MidjourneyJobUpdateInput = {
    state: newState,
    blockReason: snapshot.blockReason ?? null,
    mjJobId: snapshot.mjJobId ?? mjJob.mjJobId,
    mjMetadata:
      snapshot.mjMetadata as Prisma.InputJsonValue | undefined ??
      (mjJob.mjMetadata as Prisma.InputJsonValue | undefined) ??
      Prisma.JsonNull,
  };
  if (snapshot.startedAt && !mjJob.submittedAt) {
    updates.submittedAt = new Date(snapshot.startedAt);
  }
  if (newState === "COMPLETED" && !mjJob.completedAt) {
    updates.completedAt = new Date();
  }
  if (newState === "FAILED" && !mjJob.failedAt) {
    updates.failedAt = new Date();
    updates.failedReason = snapshot.lastMessage ?? "Bilinmeyen hata";
  }

  await db.midjourneyJob.update({
    where: { id: midjourneyJobId },
    data: updates,
  });

  // EtsyHub Job side senkron.
  if (mjJob.jobId) {
    const jobStatus =
      newState === "COMPLETED"
        ? JobStatus.SUCCESS
        : newState === "FAILED"
          ? JobStatus.FAILED
          : newState === "CANCELLED"
            ? JobStatus.CANCELLED
            : JobStatus.RUNNING;
    await db.job.update({
      where: { id: mjJob.jobId },
      data: {
        status: jobStatus,
        ...(newState === "COMPLETED" || newState === "FAILED"
          ? { finishedAt: new Date() }
          : {}),
        ...(newState === "FAILED" ? { error: updates.failedReason as string | undefined } : {}),
      },
    });
  }

  // Ingest tetikleme — COLLECTING_OUTPUTS state'inde outputs hazır olur.
  // V1: COMPLETED state'inde ingest yap (mock driver COMPLETED öncesi tüm
  // outputs taşır). Real driver: COLLECTING_OUTPUTS'ta ingest mantıklı
  // olabilir — V1.x'te değerlendirilir.
  if (newState === "COMPLETED" && snapshot.outputs && snapshot.outputs.length > 0) {
    try {
      await ingestOutputs(midjourneyJobId, snapshot, bridgeClient);
    } catch (err) {
      logger.error(
        {
          midjourneyJobId,
          err: err instanceof Error ? err.message : String(err),
        },
        "midjourney ingest failed",
      );
      await db.midjourneyJob.update({
        where: { id: midjourneyJobId },
        data: {
          state: MidjourneyJobState.FAILED,
          failedReason: `Ingest hatası: ${err instanceof Error ? err.message : String(err)}`,
          failedAt: new Date(),
        },
      });
    }
  }

  return { state: newState, isTerminal: TERMINAL_STATES.includes(newState) };
}

/**
 * Bridge'den output dosyalarını fetch + MinIO upload + Asset/MidjourneyAsset
 * row'ları yaz.
 *
 * Idempotent: zaten ingest edilmiş job için no-op (MidjourneyAsset row sayısı).
 */
async function ingestOutputs(
  midjourneyJobId: string,
  snapshot: BridgeJobSnapshot,
  bridgeClient: BridgeClient,
): Promise<void> {
  if (!snapshot.outputs || snapshot.outputs.length === 0) return;

  const mjJob = await db.midjourneyJob.findUniqueOrThrow({
    where: { id: midjourneyJobId },
  });

  const existing = await db.midjourneyAsset.count({
    where: { midjourneyJobId },
  });
  if (existing > 0) {
    logger.info(
      { midjourneyJobId, existing },
      "midjourney ingest skipped — already imported",
    );
    return;
  }

  const storage = getStorage();
  for (const out of snapshot.outputs) {
    const buffer = await bridgeClient.fetchOutput(
      mjJob.bridgeJobId,
      out.gridIndex,
    );

    // Pass 50 — MIME/uzantı dinamik tespit. Pass 49 sonrası bridge
    // outputları .webp formatında geliyor (cdn.midjourney.com webp);
    // mimeType "image/png" hardcode storage policy'lerini ve UI image
    // viewer'ları kırardı.
    const { mime, ext } = inferImageMime(out.localPath, out.sourceUrl, buffer);

    const storageKey = `midjourney/${mjJob.userId}/${mjJob.id}/${out.gridIndex}${ext}`;
    const stored = await storage.upload(storageKey, buffer, {
      contentType: mime,
    });

    // Asset modelinde JSON sourceMetadata yok — `sourceUrl` (MJ CDN) +
    // `sourcePlatform` (OTHER) yazılır. MJ-spesifik lineage MidjourneyAsset
    // tablosunda zaten taşınıyor.
    const asset = await db.asset.create({
      data: {
        userId: mjJob.userId,
        storageProvider: env.STORAGE_PROVIDER,
        storageKey: stored.key,
        bucket: stored.bucket,
        mimeType: mime,
        sizeBytes: stored.size,
        hash: sha256(buffer),
        sourceUrl: out.sourceUrl ?? null,
        sourcePlatform: "OTHER",
      },
    });

    await db.midjourneyAsset.create({
      data: {
        midjourneyJobId,
        gridIndex: out.gridIndex,
        variantKind: MJVariantKind.GRID,
        assetId: asset.id,
        mjImageUrl: out.sourceUrl ?? null,
      },
    });
  }

  logger.info(
    { midjourneyJobId, count: snapshot.outputs.length },
    "midjourney outputs ingested",
  );

  // Pass 56 — Auto-promote: MJ Job referenceId+productTypeId'liyse
  // 4 MidjourneyAsset'i otomatik GeneratedDesign'a bağla → Review queue'ya
  // doğal akış. Operatör manuel "Review'a gönder" panelinden tasarruf.
  // Reference'sız job'larda (ör. admin Test Render default) atlanır;
  // operatör manuel promote eder.
  // Try/catch — promote fail ingest sonucu bozmasın (manuel promote
  // hâlâ yapılabilir; idempotent).
  if (mjJob.referenceId && mjJob.productTypeId) {
    try {
      const ids = await db.midjourneyAsset.findMany({
        where: { midjourneyJobId },
        select: { id: true },
      });
      const result = await bulkPromoteMidjourneyAssets({
        midjourneyAssetIds: ids.map((a) => a.id),
        referenceId: mjJob.referenceId,
        productTypeId: mjJob.productTypeId,
        actorUserId: mjJob.userId,
      });
      logger.info(
        {
          midjourneyJobId,
          createdCount: result.createdCount,
          alreadyPromotedCount: result.alreadyPromotedCount,
        },
        "midjourney auto-promote OK",
      );
    } catch (err) {
      // Auto-promote opsiyonel — fail ingest'i bozmasın. Operatör
      // detail page'den manuel promote edebilir.
      logger.warn(
        {
          midjourneyJobId,
          err: err instanceof Error ? err.message : String(err),
        },
        "midjourney auto-promote failed (manuel fallback mümkün)",
      );
    }
  }
}

/**
 * Pass 50 — image MIME + uzantı tespiti.
 *
 * Sıralı ipuçları:
 *   1. localPath uzantısı (driver kontrol etti)
 *   2. sourceUrl uzantısı (MJ CDN)
 *   3. Magic bytes (PNG: 89 50, WebP: RIFF...WEBP, JPEG: FF D8)
 *   4. Default png (kontratla uyumlu)
 */
function inferImageMime(
  localPath: string,
  sourceUrl: string | null | undefined,
  buffer: Buffer,
): { mime: string; ext: string } {
  const tryExt = (s: string | null | undefined): string | null => {
    if (!s) return null;
    if (/\.webp(\?|$)/i.test(s)) return "webp";
    if (/\.png(\?|$)/i.test(s)) return "png";
    if (/\.(jpe?g)(\?|$)/i.test(s)) return "jpg";
    return null;
  };
  let kind = tryExt(localPath) ?? tryExt(sourceUrl ?? null);
  if (!kind && buffer.length >= 12) {
    const b = buffer;
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
      kind = "png";
    } else if (
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
    ) {
      kind = "webp";
    } else if (b[0] === 0xff && b[1] === 0xd8) {
      kind = "jpg";
    }
  }
  switch (kind) {
    case "webp":
      return { mime: "image/webp", ext: ".webp" };
    case "jpg":
      return { mime: "image/jpeg", ext: ".jpg" };
    case "png":
    default:
      return { mime: "image/png", ext: ".png" };
  }
}
