// Phase 7 Task 10 — Selection edit heavy op worker (BullMQ).
//
// Sözleşme (plan Task 10, design Section 5 + 5.1):
//   - JobType: REMOVE_BACKGROUND (Phase 5 placeholder enum reuse — Phase 7
//     selection edit context'inde kullanılır; migration gerekmez).
//   - Heavy op: bg-remove (Task 9 `removeBackground` edit-op fonksiyonu).
//   - Paralel heavy yasağı: enqueue tarafında DB-side lock
//     (`SelectionItem.activeHeavyJobId`); bu worker tamamlandığında
//     (success/fail) lock'u release eder.
//
// Pipeline:
//   1. Payload validate (TypeScript + runtime-safe destructure)
//   2. requireItemOwnership (cross-user → NotFoundError)
//   3. assertSetMutable (read-only set → SetReadOnlyError)
//   4. Aktif görüntü hesapla: input = item.editedAssetId ?? sourceAssetId
//   5. removeBackground({ inputAssetId }) — Task 9 edit-op çağrısı
//   6. Success path (Task 6 paterni — DB invariant transaction):
//        eski editedAssetId → lastUndoableAssetId
//        yeni asset → editedAssetId
//        editHistoryJson push: { op: "background-remove", at }
//        activeHeavyJobId = null  (lock release)
//   7. Failure path:
//        editHistoryJson push: { op, at, failed: true, reason }  (audit log)
//        activeHeavyJobId = null  (lock her halükarda release)
//        Re-throw — BullMQ FAILED state'e atar (Worker.failed event log).
//
// Failure path neden audit'e yazıyor:
//   Lock release silent değil; kullanıcı history'de neyin denenip
//   başarısızlıkla bittiğini görebilmeli. UI Phase 7 Task 11+'da bu entry'leri
//   "İşlem başarısız" badge'iyle gösterecek (carry-forward).
//
// Phase 6 emsal: `src/server/workers/review-design.worker.ts` — tek worker,
// ownership doğrulama, sticky check, persist invariant'ları (selection-edit
// state machine guard'ları benzer rolü oynar).

import type { Job } from "bullmq";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { requireItemOwnership } from "@/server/services/selection/authz";
import { assertSetMutable } from "@/server/services/selection/state";
import { removeBackground } from "@/server/services/selection/edit-ops/background-remove";

// ────────────────────────────────────────────────────────────
// Job payload sözleşmesi
// ────────────────────────────────────────────────────────────

/**
 * REMOVE_BACKGROUND job payload (Phase 7 selection edit context).
 *
 * `opType` discriminator: gelecekte upscale gibi başka heavy op'lar aynı
 * job tipini reuse ederse switch noktası. Phase 7 v1'de yalnız
 * `"background-remove"`.
 */
export type RemoveBackgroundJobPayload = {
  userId: string;
  setId: string;
  itemId: string;
  opType: "background-remove";
};

type SelectionEditHistoryEntry = {
  op: "background-remove";
  at: string;
  failed?: boolean;
  reason?: string;
};

// ────────────────────────────────────────────────────────────
// Worker handler
// ────────────────────────────────────────────────────────────

/**
 * BullMQ worker handler — selection item üzerinde bg-remove edit op'u
 * çalıştırır, item invariant'larını (Task 6 paterni) update eder, lock'u
 * release eder.
 *
 * Failure path'te asset state'i değiştirilmez; yalnız history'ye failure
 * entry yazılır, lock release edilir, error re-throw.
 */
export async function handleSelectionEditRemoveBackground(
  job: Job<RemoveBackgroundJobPayload>,
): Promise<void> {
  const { userId, setId, itemId } = job.data;

  // 1) Ownership + read-only guard
  const item = await requireItemOwnership({ userId, setId, itemId });
  const set = await db.selectionSet.findUniqueOrThrow({ where: { id: setId } });
  assertSetMutable(set);

  // 2) Aktif görüntü
  const inputAssetId = item.editedAssetId ?? item.sourceAssetId;

  try {
    const result = await removeBackground({ inputAssetId });

    const successEntry: SelectionEditHistoryEntry = {
      op: "background-remove",
      at: new Date().toISOString(),
    };
    const newHistory: SelectionEditHistoryEntry[] = [
      ...((item.editHistoryJson as SelectionEditHistoryEntry[]) ?? []),
      successEntry,
    ];

    // Tek tx: invariant update + lock release.
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
      { jobId: job.id, itemId, op: "background-remove", outputAssetId: result.assetId },
      "selection edit bg-remove completed",
    );
    return;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);

    const failureEntry: SelectionEditHistoryEntry = {
      op: "background-remove",
      at: new Date().toISOString(),
      failed: true,
      reason,
    };
    const newHistory: SelectionEditHistoryEntry[] = [
      ...((item.editHistoryJson as SelectionEditHistoryEntry[]) ?? []),
      failureEntry,
    ];

    // Lock release + audit history (asset alanları DEĞİŞMEZ).
    // Best-effort: DB update fail ederse log'la, ama orjinal hatayı re-throw et.
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
          err: releaseErr instanceof Error ? releaseErr.message : String(releaseErr),
        },
        "selection edit bg-remove lock release failed (orphaned lock possible)",
      );
    }

    logger.warn(
      { jobId: job.id, itemId, op: "background-remove", reason },
      "selection edit bg-remove failed",
    );

    // Re-throw → BullMQ FAILED state.
    throw err;
  }
}
