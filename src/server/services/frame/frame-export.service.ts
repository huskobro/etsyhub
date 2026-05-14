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

  const durationMs = Date.now() - startTime;
  logger.info(
    {
      userId: input.userId,
      setId: input.setId,
      exportId,
      frameAspect: input.frameAspect,
      sceneMode: input.scene.mode,
      glassVariant: input.scene.glassVariant,
      lensBlur: input.scene.lensBlur ?? false,
      outputW,
      outputH,
      sizeBytes: outputBuffer.length,
      durationMs,
      assignedSlotCount: compositorSlots.filter((s) => s.imageBuffer).length,
    },
    "frame export rendered (Phase 99)",
  );

  return {
    downloadUrl,
    storageKey,
    width: outputW,
    height: outputH,
    sizeBytes: outputBuffer.length,
    exportId,
    durationMs,
  };
}
