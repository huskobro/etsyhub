// Pass 29 — Magic Eraser inpainting worker.
//
// Sözleşme (selection-edit.worker.ts emsali):
//   - JobType: MAGIC_ERASER_INPAINT
//   - Heavy op: magic-eraser (Python LaMa subprocess)
//   - Paralel heavy yasağı: enqueue tarafında DB-side lock
//     (`SelectionItem.activeHeavyJobId`); bu worker tamamlandığında
//     (success/fail) lock'u release eder.
//
// Pipeline:
//   1. Payload validate
//   2. requireItemOwnership (cross-user → NotFoundError)
//   3. assertSetMutable (read-only set → SetReadOnlyError)
//   4. Aktif görüntü hesapla: input = item.editedAssetId ?? sourceAssetId
//   5. Mask buffer'ı base64'ten decode et
//   6. magicEraser({ inputAssetId, maskBuffer }) — Python subprocess
//   7. Success path: DB invariant transaction (selection-edit emsali)
//      eski editedAssetId → lastUndoableAssetId
//      yeni asset → editedAssetId
//      editHistoryJson push: { op: "magic-eraser", at, elapsedMs }
//      activeHeavyJobId = null  (lock release)
//   8. Failure path:
//      editHistoryJson push: { op, at, failed: true, reason }
//      activeHeavyJobId = null  (lock her halükarda release)
//      Re-throw — BullMQ FAILED state'e atar.
//
// **Mask payload boyut notu:**
//   BullMQ Redis payload limiti default ~512KB. Mask 4096×4096 PNG ~50KB
//   (binarize sonrası); 8192×8192 ~150KB. Limit içinde kalır. Çok büyük
//   asset'ler (>8K) için V2.x: mask'ı önce storage'a koyup sadece key'i
//   payload'a almak.

import type { Job } from "bullmq";
import { Prisma, ProviderKind } from "@prisma/client";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { requireItemOwnership } from "@/server/services/selection/authz";
import { assertSetMutable } from "@/server/services/selection/state";
import { magicEraser } from "@/server/services/selection/edit-ops/magic-eraser";
import { notifyUser } from "@/server/services/settings/notifications-inbox.service";

export type MagicEraserJobPayload = {
  userId: string;
  setId: string;
  itemId: string;
  opType: "magic-eraser";
  // Base64-encoded mask PNG (white=remove, black=keep). Worker decode eder.
  maskBase64: string;
};

type MagicEraserHistoryEntry = {
  op: "magic-eraser";
  at: string;
  elapsedMs?: number;
  failed?: boolean;
  reason?: string;
};

export async function handleMagicEraser(
  job: Job<MagicEraserJobPayload>,
): Promise<void> {
  const { userId, setId, itemId, maskBase64 } = job.data;

  // 1) Ownership + read-only guard
  const item = await requireItemOwnership({ userId, setId, itemId });
  const set = await db.selectionSet.findUniqueOrThrow({ where: { id: setId } });
  assertSetMutable(set);

  // 4) Aktif görüntü
  const inputAssetId = item.editedAssetId ?? item.sourceAssetId;

  // 5) Mask decode
  const maskBuffer = Buffer.from(maskBase64, "base64");

  try {
    // 6) Python subprocess
    const result = await magicEraser({ inputAssetId, maskBuffer });

    const successEntry: MagicEraserHistoryEntry = {
      op: "magic-eraser",
      at: new Date().toISOString(),
      elapsedMs: result.elapsedMs,
    };
    const newHistory: MagicEraserHistoryEntry[] = [
      ...((item.editHistoryJson as MagicEraserHistoryEntry[]) ?? []),
      successEntry,
    ];

    // 7) Tek tx: invariant update + lock release
    await db.selectionItem.update({
      where: { id: itemId },
      data: {
        lastUndoableAssetId: item.editedAssetId,
        editedAssetId: result.assetId,
        editHistoryJson: newHistory as unknown as Prisma.InputJsonValue,
        activeHeavyJobId: null,
      },
    });

    logger.info(
      {
        jobId: job.id,
        itemId,
        op: "magic-eraser",
        outputAssetId: result.assetId,
        elapsedMs: result.elapsedMs,
      },
      "selection edit magic-eraser completed",
    );

    // R10 — CostUsage write (LaMa local, nominal accounting; 0¢)
    // ve notifyUser dispatch (magicEraser preference).
    try {
      await db.costUsage.create({
        data: {
          userId: job.data.userId,
          providerKind: ProviderKind.AI,
          providerKey: "local-lama",
          model: "lama-cleaner",
          // BullMQ job id heavy ref olarak saklanır; etsyhub Job row id yok.
          jobId: null,
          units: 1,
          // Local subprocess — gerçek sunucu maliyeti 0; takip için 1¢
          // sentinel (0 toplam'da görünmez, 1¢ "yapıldı" sinyali).
          costCents: 1,
          periodKey: new Date().toISOString().slice(0, 7),
        },
      });
    } catch (err) {
      logger.warn(
        { itemId, err: (err as Error).message },
        "magic-eraser CostUsage write failed (non-fatal)",
      );
    }
    await notifyUser({
      userId: job.data.userId,
      kind: "magicEraser",
      title: "Magic eraser done",
      body: `Item ${itemId.slice(0, 8)} cleaned in ${result.elapsedMs}ms`,
      href: `/selections/${job.data.setId}?tab=edits`,
    }).catch(() => undefined);
    return;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);

    const failureEntry: MagicEraserHistoryEntry = {
      op: "magic-eraser",
      at: new Date().toISOString(),
      failed: true,
      reason,
    };
    const newHistory: MagicEraserHistoryEntry[] = [
      ...((item.editHistoryJson as MagicEraserHistoryEntry[]) ?? []),
      failureEntry,
    ];

    // 8) Lock release + audit (asset alanları DEĞİŞMEZ)
    try {
      await db.selectionItem.update({
        where: { id: itemId },
        data: {
          editHistoryJson: newHistory as unknown as Prisma.InputJsonValue,
          activeHeavyJobId: null,
        },
      });
    } catch (releaseErr) {
      logger.error(
        {
          jobId: job.id,
          itemId,
          err:
            releaseErr instanceof Error
              ? releaseErr.message
              : String(releaseErr),
        },
        "magic-eraser lock release failed (orphaned lock possible)",
      );
    }

    logger.warn(
      { jobId: job.id, itemId, op: "magic-eraser", reason },
      "selection edit magic-eraser failed",
    );

    throw err;
  }
}
