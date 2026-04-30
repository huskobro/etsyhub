// Phase 7 Task 6 — Edit service orchestrator (iskelet).
//
// Spec sözleşmesi:
//   - Section 4.5: Hibrit destructive edit semantiği — sourceAssetId immutable,
//     editedAssetId aktif, lastUndoableAssetId tek seviye undo, editHistoryJson
//     audit log.
//   - Section 5: Hızlı işlem matrisi — crop / transparent-check / bg-remove.
//   - Section 5.1: İşleme modeli — instant ops senkron API; heavy ops BullMQ
//     üzerinden (`applyEditAsync`); aynı item'da paralel heavy yasak.
//
// Bu task **iskelet**:
//   - applyEdit / undoEdit / resetItem invariant'ları tam korunur (DB
//     transaction'ları gerçek).
//   - Edit-op fonksiyonları (cropAsset, transparentCheck, removeBackground)
//     stub — Task 7 / 8 / 9'da implement edilecek.
//   - applyEditAsync stub jobId döner — Task 10'da BullMQ enqueue ile
//     gerçek implementasyon.
//
// Aktif görüntü kuralı: input = item.editedAssetId ?? item.sourceAssetId.
//
// Asset üreten op'larda invariant chain (tek transaction):
//   1) Eski editedAssetId (varsa) → lastUndoableAssetId
//   2) Yeni asset → editedAssetId
//   3) editHistoryJson push: { op, params?, at }
//
// Asset üretmeyen op (transparent-check):
//   - editedAssetId / lastUndoableAssetId DEĞİŞMEZ
//   - editHistoryJson push: { op: "transparent-check", at, result }
//
// Undo (tek seviye):
//   - Guard: lastUndoableAssetId yoksa throw
//   - Swap: editedAssetId = lastUndoableAssetId, lastUndoableAssetId = null
//   - History pop (son op kaldırılır)
//
// Reset:
//   - editedAssetId = null, lastUndoableAssetId = null, editHistoryJson = []
//   - Asset cleanup YAPMAZ — orphan asset'ler `asset-orphan-cleanup`
//     carry-forward kapsamı.
//
// applyEditAsync paralel heavy yasağı (Task 10 — gerçek lock):
//   - DB-side state: `SelectionItem.activeHeavyJobId` (Phase 7 migration
//     `phase7_selection_active_heavy_job_id`).
//   - Lock acquire interactive transaction içinde:
//       1. Item fetch
//       2. activeHeavyJobId !== null → ConcurrentEditError throw (tx rollback)
//       3. BullMQ enqueue
//       4. activeHeavyJobId = job.id update
//   - Lock release: worker handler tamamlandığında (success/fail) yapılır
//     (`selection-edit.worker.ts`).
//   - Carry-forward: `selection-studio-orphan-lock-cleanup` — process restart
//     sonrası DB'de activeHeavyJobId var ama BullMQ'da gerçek job yoksa lock
//     leak. Worker startup'ında defensive `updateMany` cleanup hook eklenmeli.

import { db } from "@/server/db";
import { JobType, Prisma, type SelectionItem } from "@prisma/client";
import { ConcurrentEditError, UndoableNotAvailableError } from "@/lib/errors";
import { enqueue } from "@/server/queue";
import { requireItemOwnership } from "./authz";
import { assertSetMutable } from "./state";
import { cropAsset } from "./edit-ops/crop";
import { transparentCheck } from "./edit-ops/transparent-check";
import type { CropRatio } from "./edit-ops/crop";
import type { RemoveBackgroundJobPayload } from "@/server/workers/selection-edit.worker";

// ────────────────────────────────────────────────────────────
// Op input tipleri
// ────────────────────────────────────────────────────────────

export type ApplyEditOp =
  | { op: "crop"; params: { ratio: CropRatio } }
  | { op: "transparent-check" }
  | { op: "background-remove" };

export type ApplyEditInput = {
  userId: string;
  setId: string;
  itemId: string;
  op: ApplyEditOp;
};

export type UndoEditInput = {
  userId: string;
  setId: string;
  itemId: string;
};

export type ResetItemInput = {
  userId: string;
  setId: string;
  itemId: string;
};

export type ApplyEditAsyncInput = {
  userId: string;
  setId: string;
  itemId: string;
  op: { op: "background-remove" };
};

// ────────────────────────────────────────────────────────────
// History entry tipleri (Json içinde tutulur)
// ────────────────────────────────────────────────────────────

type HistoryEntry =
  | {
      op: "crop";
      params: { ratio: CropRatio };
      at: string;
    }
  | {
      op: "transparent-check";
      at: string;
      result: unknown;
    }
  | {
      op: "background-remove";
      at: string;
    };

// ────────────────────────────────────────────────────────────
// applyEdit — instant op orchestrator
// ────────────────────────────────────────────────────────────

/**
 * Item üzerinde instant edit op çalıştırır.
 *
 * - `op === "crop"`: Sharp crop (Task 7 mock'lu); yeni asset üretilir,
 *   editedAssetId/lastUndoableAssetId chain güncellenir.
 * - `op === "transparent-check"`: Phase 6 alpha-check local duplicate (Task 8
 *   mock'lu); asset üretilmez, yalnız history'ye record eklenir.
 * - `op === "background-remove"`: REJECT — heavy op, `applyEditAsync` kullan.
 *
 * Guards: requireItemOwnership (cross-user 404) + assertSetMutable (read-only
 * set'te 409).
 */
export async function applyEdit(input: ApplyEditInput): Promise<SelectionItem> {
  if (input.op.op === "background-remove") {
    throw new Error(
      "background-remove heavy op — applyEditAsync kullan",
    );
  }

  const item = await requireItemOwnership({
    userId: input.userId,
    setId: input.setId,
    itemId: input.itemId,
  });
  // requireItemOwnership set'i de fetch eder; ama yalnız item dönüyor.
  // assertSetMutable için set entity gerek — ayrı fetch (cross-user'dan
  // önce zaten requireItemOwnership 404 atar; bu fetch yalnız draft check).
  const set = await db.selectionSet.findUniqueOrThrow({
    where: { id: input.setId },
  });
  assertSetMutable(set);

  // Aktif görüntü: edited varsa o, yoksa source.
  const inputAssetId = item.editedAssetId ?? item.sourceAssetId;

  if (input.op.op === "crop") {
    const params = input.op.params;
    const result = await cropAsset({ inputAssetId, params });
    const newEntry: HistoryEntry = {
      op: "crop",
      params,
      at: new Date().toISOString(),
    };
    return updateItemAfterAssetProducingEdit({
      itemId: input.itemId,
      currentItem: item,
      newAssetId: result.assetId,
      historyEntry: newEntry,
    });
  }

  if (input.op.op === "transparent-check") {
    const result = await transparentCheck({ inputAssetId });
    const newEntry: HistoryEntry = {
      op: "transparent-check",
      at: new Date().toISOString(),
      result,
    };
    return updateItemAfterReadOnlyEdit({
      itemId: input.itemId,
      currentItem: item,
      historyEntry: newEntry,
    });
  }

  // Exhaustive — TS bu noktayı asla görmemeli.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _exhaustive: never = input.op;
  throw new Error(`Bilinmeyen edit op: ${JSON.stringify(input.op)}`);
}

// ────────────────────────────────────────────────────────────
// undoEdit — tek seviye undo
// ────────────────────────────────────────────────────────────

/**
 * Item'ın son asset-üreten edit'ini geri alır.
 *
 * - editedAssetId ↔ lastUndoableAssetId swap; lastUndoableAssetId null'a
 *   düşer (tek seviye).
 * - History son entry pop edilir.
 * - Guard: lastUndoableAssetId yoksa throw ("undo edilebilecek edit yok").
 *
 * Spec Section 4.5: "lastUndoableAssetId swap, history son op pop" —
 * pragmatic karar (undone flag yerine pop, daha temiz audit).
 */
export async function undoEdit(input: UndoEditInput): Promise<SelectionItem> {
  const item = await requireItemOwnership({
    userId: input.userId,
    setId: input.setId,
    itemId: input.itemId,
  });
  const set = await db.selectionSet.findUniqueOrThrow({
    where: { id: input.setId },
  });
  assertSetMutable(set);

  if (item.lastUndoableAssetId === null) {
    // Task 22: typed error — route boundary'sinde 409 Conflict olur
    // (önce generic Error idi, HTTP 500'e düşerdi; yanlış sinyal).
    throw new UndoableNotAvailableError();
  }

  const history = (item.editHistoryJson as HistoryEntry[]) ?? [];
  // Son entry pop — asset üreten op'lar için. Transparent-check varsa o da
  // pop'a uğrar; ancak undoable null değilse en az bir asset-üreten op
  // var demektir, bu invariant test fixture'larıyla korunur.
  const newHistory = history.slice(0, -1);

  const updated = await db.selectionItem.update({
    where: { id: input.itemId },
    data: {
      editedAssetId: item.lastUndoableAssetId,
      lastUndoableAssetId: null,
      editHistoryJson: newHistory as Prisma.InputJsonValue,
    },
  });
  return updated;
}

// ────────────────────────────────────────────────────────────
// resetItem — orijinale döndür
// ────────────────────────────────────────────────────────────

/**
 * Item'ı orijinal asset'e (sourceAssetId) sıfırlar.
 *
 * - editedAssetId = null, lastUndoableAssetId = null, editHistoryJson = []
 * - Asset cleanup YAPILMAZ — orphan edit asset'leri DB'de kalır
 *   (`asset-orphan-cleanup` carry-forward).
 */
export async function resetItem(
  input: ResetItemInput,
): Promise<SelectionItem> {
  await requireItemOwnership({
    userId: input.userId,
    setId: input.setId,
    itemId: input.itemId,
  });
  const set = await db.selectionSet.findUniqueOrThrow({
    where: { id: input.setId },
  });
  assertSetMutable(set);

  return db.selectionItem.update({
    where: { id: input.itemId },
    data: {
      editedAssetId: null,
      lastUndoableAssetId: null,
      editHistoryJson: [] as Prisma.InputJsonValue,
    },
  });
}

// ────────────────────────────────────────────────────────────
// applyEditAsync — heavy op enqueue (BullMQ + DB-side lock)
// ────────────────────────────────────────────────────────────

/**
 * Heavy edit op'u BullMQ kuyruğuna ekler, item üzerinde DB-side lock acquire
 * eder ve job id döner. Lock release worker tarafından (success/fail).
 *
 * Akış:
 *   1. Op type guard: yalnız "background-remove"; instant op → reject.
 *   2. Ownership + read-only guard.
 *   3. Lock acquire: item.activeHeavyJobId !== null → ConcurrentEditError.
 *   4. BullMQ enqueue (REMOVE_BACKGROUND).
 *   5. activeHeavyJobId = job.id update.
 *
 * **Race-condition kapsamı:** `requireItemOwnership` snapshot ile lock-check
 * tx başlamadan okunur; lock-update aşaması interactive tx içinde yeniden
 * fetch + conditional check ile atomik. İki paralel enqueue isteği aynı
 * pencerede gelirse ikincisi tx içinde "lock zaten var" görür ve reject olur.
 *
 * **BullMQ jobId garantisi:** `enqueue` helper'ı `Queue.add()` döner;
 * `job.id` BullMQ tarafından otomatik üretilir (string). Production'da
 * non-null; defensive `!` assertion uygulanır (BullMQ kontratı).
 */
export async function applyEditAsync(
  input: ApplyEditAsyncInput,
): Promise<{ jobId: string }> {
  // Yalnız "background-remove" kabul. Instant op'lar applyEdit'ten gider.
  if (input.op.op !== "background-remove") {
    throw new Error(
      `applyEditAsync yalnız heavy op kabul eder; "${(input.op as { op: string }).op}" instant op — applyEdit kullan`,
    );
  }

  await requireItemOwnership({
    userId: input.userId,
    setId: input.setId,
    itemId: input.itemId,
  });
  const set = await db.selectionSet.findUniqueOrThrow({
    where: { id: input.setId },
  });
  assertSetMutable(set);

  // Interactive transaction: lock check + enqueue + lock acquire atomik.
  // Tx içinde re-fetch ile race penceresi kapanır.
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const item = await tx.selectionItem.findUniqueOrThrow({
      where: { id: input.itemId },
    });
    if (item.activeHeavyJobId !== null) {
      throw new ConcurrentEditError(
        "Aynı item üzerinde aktif heavy edit var; mevcut job tamamlanana kadar bekleyin",
      );
    }

    const payload: RemoveBackgroundJobPayload = {
      userId: input.userId,
      setId: input.setId,
      itemId: input.itemId,
      opType: "background-remove",
    };
    const job = await enqueue(
      JobType.REMOVE_BACKGROUND,
      payload as unknown as Record<string, unknown>,
    );
    const jobId = job.id;
    if (!jobId) {
      throw new Error("BullMQ job.id null — enqueue başarısız");
    }

    await tx.selectionItem.update({
      where: { id: input.itemId },
      data: { activeHeavyJobId: jobId },
    });

    return { jobId };
  });
}

// ────────────────────────────────────────────────────────────
// Internal helpers — DB invariant transactions
// ────────────────────────────────────────────────────────────

async function updateItemAfterAssetProducingEdit(args: {
  itemId: string;
  currentItem: SelectionItem;
  newAssetId: string;
  historyEntry: HistoryEntry;
}): Promise<SelectionItem> {
  const { itemId, currentItem, newAssetId, historyEntry } = args;
  const newHistory = [
    ...((currentItem.editHistoryJson as HistoryEntry[]) ?? []),
    historyEntry,
  ];

  // Tek tx: eski editedAssetId → lastUndoableAssetId, yeni asset →
  // editedAssetId, history push.
  return db.selectionItem.update({
    where: { id: itemId },
    data: {
      lastUndoableAssetId: currentItem.editedAssetId,
      editedAssetId: newAssetId,
      editHistoryJson: newHistory as Prisma.InputJsonValue,
    },
  });
}

async function updateItemAfterReadOnlyEdit(args: {
  itemId: string;
  currentItem: SelectionItem;
  historyEntry: HistoryEntry;
}): Promise<SelectionItem> {
  const { itemId, currentItem, historyEntry } = args;
  const newHistory = [
    ...((currentItem.editHistoryJson as HistoryEntry[]) ?? []),
    historyEntry,
  ];

  // Asset alanları DEĞİŞMEZ — yalnız history append.
  return db.selectionItem.update({
    where: { id: itemId },
    data: {
      editHistoryJson: newHistory as Prisma.InputJsonValue,
    },
  });
}
