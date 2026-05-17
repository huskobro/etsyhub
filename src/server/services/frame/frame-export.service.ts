// Phase 99 — Frame mode export service.
//
// Stateless render: caller (POST /api/frame/export) body verir, service
// selection set + asset ownership doğrular, real asset buffer'larını
// MinIO'dan çeker, frame-compositor çağırır, output'u MinIO'ya yükler,
// signed download URL döner.
//
// Sözleşme #11 + #13.C: Frame mode export pipeline çekirdeği. Preview ↔
// export aynı kaynak (client request body Shell sceneOverride + slot
// positions + asset IDs ile beslenir). Server salt komposit + storage
// orchestration yapar.
//
// Schema-zero: yeni DB row/migration yok. Output yalnız storage'a yazılır,
// signed URL response operator-facing. Persistence (FrameExport history)
// Phase 100+ candidate.

import { db } from "@/server/db";
import { newId } from "@/lib/id";
import { logger } from "@/lib/logger";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { getStorage } from "@/providers/storage";
import {
  composeFrameOutput,
  type FrameCompositorInput,
  type FrameSlotInput,
  type FrameSceneInput,
  type FrameDeviceShape,
} from "@/providers/mockup/local-sharp/frame-compositor";
import { FRAME_ASPECT_CONFIG } from "@/features/mockups/studio/frame-aspects";

export interface ExportFrameSlotRequest {
  slotIndex: number;
  assigned: boolean;
  /** Selection item id (cross-user ownership doğrulanır). */
  itemId?: string | null;
  /** Slot cascade pozisyonu (stage-inner 572×504 koordinatları —
   *  client preview state'inden direkt geçer, server scale-up eder). */
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  z: number;
}

export interface ExportFrameInput {
  userId: string;
  setId: string;
  frameAspect: keyof typeof FRAME_ASPECT_CONFIG;
  scene: FrameSceneInput;
  slots: ReadonlyArray<ExportFrameSlotRequest>;
  stageInnerW?: number;
  stageInnerH?: number;
  /** Phase 105 — productType-aware device shape (preview StageDeviceSVG
   *  parity). Shell `stageDeviceForProductType(categoryId)` → compositor
   *  shape. Undefined → "sticker" (Phase 104 backward-compat). */
  deviceShape?: FrameDeviceShape;
  /** Phase 126 — Global canonical media-position. Preview ile AYNI
   *  resolveMediaOffsetPx (§11.0 Preview=Export Truth). Undefined →
   *  {0,0} no-op. sceneSnapshot'a da yazılır (re-export kaynağı). */
  mediaPosition?: import(
    "@/features/mockups/studio/media-position"
  ).MediaPosition;
}

export interface ExportFrameResult {
  downloadUrl: string;
  storageKey: string;
  width: number;
  height: number;
  sizeBytes: number;
  exportId: string;
  /** Render durasyonu (compositor) — operator visibility için. */
  durationMs: number;
  /** Phase 100 — FrameExport row id (sözleşme #11 + #13.F).
   *
   *  Persistence başarılı ise FrameExport.id (exportId ile aynı —
   *  service intentionally aynı id kullanır). null ise persist
   *  başarısız oldu (signedUrl yine çalışır, history/handoff yok).
   *  UI banner bu id'yi Product handoff CTA'ya iletir. */
  frameExportId: string | null;
}

/* Phase 99 — Frame export entry point.
 *
 * 1. Selection set + item ownership (Madde V — operator-owned data
 *    canonical user isolation).
 * 2. Asset storageKey fetch (assigned slot'lar için).
 * 3. Buffer download from MinIO.
 * 4. composeFrameOutput çağrısı (Sharp pipeline).
 * 5. MinIO upload `u/{userId}/frame-exports/{exportId}.png`.
 * 6. Signed URL (5 min TTL).
 */
export async function exportFrameComposition(
  input: ExportFrameInput,
): Promise<ExportFrameResult> {
  const startTime = Date.now();

  // 1) Selection set ownership
  const set = await db.selectionSet.findFirst({
    where: { id: input.setId, userId: input.userId },
    select: { id: true, name: true, status: true },
  });
  if (!set) {
    throw new NotFoundError("Selection set bulunamadı");
  }

  // 2) Aspect resolve
  const aspectCfg = FRAME_ASPECT_CONFIG[input.frameAspect];
  if (!aspectCfg) {
    throw new ValidationError("Geçersiz frame aspect");
  }
  const outputW = aspectCfg.outputW;
  const outputH = aspectCfg.outputH;

  // 3) Assigned slot itemId'leri topla
  const assignedItemIds = input.slots
    .filter((s) => s.assigned && s.itemId)
    .map((s) => s.itemId!) as string[];

  let itemMap = new Map<
    string,
    { sourceAssetId: string; storageKey: string; userId: string }
  >();

  if (assignedItemIds.length > 0) {
    const items = await db.selectionItem.findMany({
      where: { id: { in: assignedItemIds }, selectionSetId: input.setId },
      include: {
        sourceAsset: {
          select: {
            id: true,
            userId: true,
            storageKey: true,
          },
        },
      },
    });
    for (const item of items) {
      if (!item.sourceAsset) continue;
      // Ownership defense — selection item içindeki asset farklı user'a
      // ait olmamalı (legacy data drift'i için defansif).
      if (item.sourceAsset.userId !== input.userId) {
        continue;
      }
      itemMap.set(item.id, {
        sourceAssetId: item.sourceAsset.id,
        storageKey: item.sourceAsset.storageKey,
        userId: item.sourceAsset.userId,
      });
    }
  }

  // 4) Asset buffer fetch (parallel)
  const storage = getStorage();
  const compositorSlots: FrameSlotInput[] = await Promise.all(
    input.slots.map(async (s) => {
      let imageBuffer: Buffer | undefined;
      if (s.assigned && s.itemId) {
        const meta = itemMap.get(s.itemId);
        if (meta) {
          try {
            imageBuffer = await storage.download(meta.storageKey);
          } catch (err) {
            logger.warn(
              { err: err instanceof Error ? err.message : err, itemId: s.itemId },
              "frame export: asset download failed",
            );
            imageBuffer = undefined;
          }
        }
      }
      return {
        index: s.slotIndex,
        imageBuffer,
        x: s.x,
        y: s.y,
        w: s.w,
        h: s.h,
        r: s.r,
        z: s.z,
        assigned: s.assigned,
      };
    }),
  );

  // 5) Compositor call
  const compositorInput: FrameCompositorInput = {
    outputW,
    outputH,
    scene: input.scene,
    slots: compositorSlots,
    stageInnerW: input.stageInnerW ?? 572,
    stageInnerH: input.stageInnerH ?? 504,
    ...(input.deviceShape ? { deviceShape: input.deviceShape } : {}),
    ...(input.mediaPosition
      ? { mediaPosition: input.mediaPosition }
      : {}),
  };
  const outputBuffer = await composeFrameOutput(compositorInput);

  // 6) MinIO upload
  const exportId = newId();
  const storageKey = `u/${input.userId}/frame-exports/${exportId}.png`;
  await storage.upload(storageKey, outputBuffer, {
    contentType: "image/png",
  });

  // 7) Signed URL (5 min TTL — operator download için yeterli)
  const downloadUrl = await storage.signedUrl(storageKey, 300);

  /* Phase 100 — Persist FrameExport row (sözleşme #11 + #13.F).
   *
   * Phase 99 stateless render PNG üretiyordu; signed URL 5 dakika
   * TTL sonrası operator kayıp. Phase 100 her render'da FrameExport
   * row yazılır: operator history + Product/Etsy Draft handoff için
   * kalıcı ürün nesnesi.
   *
   * Schema kararları (prisma migration 20260516120000):
   *   - id: cuid (newId)
   *   - userId: cross-user isolation (Madde V)
   *   - selectionSetId: nullable (set silinirse export kalır)
   *   - storageKey: MinIO key (signed URL refresh için)
   *   - dims + sizeBytes: operator visibility (history list)
   *   - frameAspect + sceneSnapshot: re-export kaynağı
   *
   * Hata olursa render başarılı ama persistence başarısız; UI
   * operator için signedUrl banner'ı yine gösterir (downgraded
   * deneyim). Persistence hata bilgisini log'a düşürürüz; operator
   * için "history'de görünmüyor" kabul edilebilir defans. */
  let persistedFrameExportId: string | null = null;
  try {
    const persisted = await db.frameExport.create({
      data: {
        id: exportId,
        userId: input.userId,
        selectionSetId: set.id,
        storageKey,
        width: outputW,
        height: outputH,
        sizeBytes: outputBuffer.length,
        frameAspect: input.frameAspect,
        /* Phase 109 — lensBlur structured (target/intensity) veya
         * legacy boolean; JSON-safe plain shape (Prisma
         * InputJsonValue). normalize: undefined/false → false;
         * true → {enabled,target:"all",intensity:"medium"};
         * structured → plain obje. */
        sceneSnapshot: {
          mode: input.scene.mode,
          glassVariant: input.scene.glassVariant ?? null,
          // Phase 139 — Lens Blur tek-davranışlı (target
          // KALDIRILDI). legacy boolean true → enabled medium;
          // structured → {enabled,intensity} (eski persisted
          // config'lerdeki `target` yok sayılır — export zaten
          // okumuyordu).
          lensBlur:
            input.scene.lensBlur === undefined ||
            input.scene.lensBlur === false
              ? false
              : input.scene.lensBlur === true
                ? { enabled: true, intensity: "medium" }
                : {
                    enabled: input.scene.lensBlur.enabled,
                    intensity: input.scene.lensBlur.intensity,
                  },
          color: input.scene.color ?? null,
          colorTo: input.scene.colorTo ?? null,
          palette: input.scene.palette ?? null,
          // Phase 126 — canonical media-position (re-export kaynağı;
          // stale-indicator karşılaştırması Task 7). {0,0} no-op.
          mediaPosition: input.mediaPosition ?? { x: 0, y: 0 },
          // Phase 136 — BG Effects (vignette/grain); JSON-safe plain
          // shape (Prisma InputJsonValue — interface index-signature
          // yok, lensBlur ile aynı plain-obje pattern). undefined →
          // null (eski export'lar efektsiz — backward-compat;
          // re-export kaynağı + stale karşılaştırma).
          bgEffect: input.scene.bgEffect
            ? {
                kind: input.scene.bgEffect.kind,
                intensity: input.scene.bgEffect.intensity,
              }
            : null,
        },
      },
      select: { id: true },
    });
    persistedFrameExportId = persisted.id;
  } catch (err) {
    logger.warn(
      {
        err: err instanceof Error ? err.message : err,
        userId: input.userId,
        exportId,
      },
      "frame export: persistence row write failed (signedUrl still returned)",
    );
  }

  const durationMs = Date.now() - startTime;
  logger.info(
    {
      userId: input.userId,
      setId: input.setId,
      exportId,
      frameExportId: persistedFrameExportId,
      frameAspect: input.frameAspect,
      sceneMode: input.scene.mode,
      glassVariant: input.scene.glassVariant,
      lensBlur: input.scene.lensBlur ?? false,
      outputW,
      outputH,
      sizeBytes: outputBuffer.length,
      durationMs,
      assignedSlotCount: compositorSlots.filter((s) => s.imageBuffer).length,
      persisted: persistedFrameExportId !== null,
    },
    "frame export rendered (Phase 100 persistence)",
  );

  return {
    downloadUrl,
    storageKey,
    width: outputW,
    height: outputH,
    sizeBytes: outputBuffer.length,
    exportId,
    durationMs,
    frameExportId: persistedFrameExportId,
  };
}

/* Phase 100 — Frame export history listing (sözleşme #11 + #13.F).
 *
 * Operator için "ürettiğim frame export'ları nerede?" sorusunun
 * cevabı. Son N export (default 20) reverse chronological.
 * deletedAt:null filter (soft-delete sızıntı yok).
 *
 * Cross-user isolation hard: where.userId zorunlu (Madde V parity).
 */
export interface FrameExportHistoryItem {
  id: string;
  storageKey: string;
  width: number;
  height: number;
  sizeBytes: number;
  frameAspect: string;
  sceneSnapshot: unknown;
  createdAt: string;
  selectionSetId: string | null;
  selectionSetName: string | null;
  /** Signed URL (5 dakika TTL); UI refresh ile yenilenir. */
  signedUrl: string;
}

export async function listFrameExports(input: {
  userId: string;
  limit?: number;
  /** Opsiyonel: belirli bir set'in export'larını filtrele. */
  selectionSetId?: string;
}): Promise<FrameExportHistoryItem[]> {
  const limit = Math.min(input.limit ?? 20, 100);
  const rows = await db.frameExport.findMany({
    where: {
      userId: input.userId,
      deletedAt: null,
      ...(input.selectionSetId ? { selectionSetId: input.selectionSetId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      selectionSet: { select: { id: true, name: true } },
    },
  });
  const storage = getStorage();
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      storageKey: row.storageKey,
      width: row.width,
      height: row.height,
      sizeBytes: row.sizeBytes,
      frameAspect: row.frameAspect,
      sceneSnapshot: row.sceneSnapshot,
      createdAt: row.createdAt.toISOString(),
      selectionSetId: row.selectionSetId,
      selectionSetName: row.selectionSet?.name ?? null,
      signedUrl: await storage.signedUrl(row.storageKey, 300),
    })),
  );
}

/* Phase 100 — Signed URL refresh (sözleşme #11 + #13.F).
 *
 * Operator banner / history listings'te eski signed URL TTL bitince
 * "linki yeniden al" akışı. Cross-user isolation: row.userId match
 * etmiyorsa NotFound döner. */
export async function refreshFrameExportSignedUrl(input: {
  userId: string;
  frameExportId: string;
}): Promise<{ signedUrl: string; expiresInSec: number }> {
  const row = await db.frameExport.findFirst({
    where: {
      id: input.frameExportId,
      userId: input.userId,
      deletedAt: null,
    },
    select: { storageKey: true },
  });
  if (!row) {
    throw new NotFoundError("Frame export bulunamadı");
  }
  const storage = getStorage();
  return {
    signedUrl: await storage.signedUrl(row.storageKey, 300),
    expiresInSec: 300,
  };
}
