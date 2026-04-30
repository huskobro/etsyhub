// Phase 7 Task 4 — Selection state machine guards + finalize transaction.
//
// Bu dosya **tek noktadan** tüm SelectionSet/SelectionItem state geçişlerini
// korur. CLAUDE.md disiplini: "explicit state machines — uncontrolled
// state transitions yok; core invariant'lar admin panel'den disable
// edilemez". Tüm item ve set mutation'ları bu helper'ları çağırmak
// zorundadır (Task 5+ item operasyonları, Task 3 archiveSet refactor).
//
// Sözleşmeler (design Section 4.3 + 4.4 + 2.5, plan Task 4):
//
//   - assertSetMutable(set): set.status !== "draft" → SetReadOnlyError.
//     Item mutation'ları (status, edit, reorder, add, delete) bu guard'ı
//     çağırır. Read-only kuralı: ready ve archived set'ler dondurulur.
//
//   - assertCanFinalize(set, items): önce set.status === "draft" zorunlu
//     (değilse SetReadOnlyError); sonra `selected` count >= 1
//     (FinalizeGateError). Pending ve rejected sayılmaz.
//
//   - assertCanArchive(set): archived → InvalidStateTransitionError. Draft
//     ve ready geçer. (Design Section 4.3: draft → archived ve ready →
//     archived geçişleri serbest; ready → draft geçişi YOK.)
//
//   - finalizeSet({ userId, setId }): ownership doğrulaması (Task 17
//     helper) → items fetch → assertCanFinalize → tx içinde update.
//
// Atomicity:
//   - Gate kontrolü ve update arasında race olmasın diye `db.$transaction`
//     callback form (interactive transaction). Tek update ama gate'i tx
//     içinde tekrar değerlendirmek prensip — yarın "items'ı tx içinde
//     mutasyona soksak" diye genişletilirse (örn. lastExportedAt patch)
//     atomic kalır. Şimdilik tek statement; çerçeve hazır.
//   - Gate fail durumunda (assertCanFinalize throw eder) tx hiç açılmaz —
//     DB'de hiçbir değişiklik olmaz; bu testle korunuyor.
//
// Pending item davranışı (Section 4.3):
//   - Finalize sonrası pending item'lar OLDUĞU GIBI DONAR. Otomatik
//     selected/rejected'a çevrilmez. Phase 8 input filtresi `selected`
//     only. ZIP manifest tüm status'lara yer verir.
//   - Bu invariant kod tarafında "hiçbir şey yapma"yla sağlanır — finalizeSet
//     yalnız set row'unu update eder, item'lara dokunmaz.

import type {
  Prisma,
  SelectionItem,
  SelectionSet,
} from "@prisma/client";
import { db } from "@/server/db";
import {
  FinalizeGateError,
  InvalidStateTransitionError,
  SetReadOnlyError,
} from "@/lib/errors";
import { requireSetOwnership } from "./authz";

/**
 * Set'in mutation'a açık olup olmadığını doğrular.
 * `draft` → pass; `ready`/`archived` → SetReadOnlyError.
 *
 * Item mutation operasyonları (Task 5+ status değişimi, edit, reorder,
 * add, delete) bu guard'ı çağırmak ZORUNDADIR.
 */
export function assertSetMutable(set: SelectionSet): void {
  if (set.status !== "draft") {
    throw new SetReadOnlyError(
      `Set "${set.status}" state'inde — mutation yasak`,
    );
  }
}

/**
 * Finalize için ön-koşulları doğrular:
 *   1. Set `draft` olmalı (değilse SetReadOnlyError — read-only kontrolü
 *      gate'ten önce; ready set'i tekrar finalize denemesi 409
 *      SET_READ_ONLY döner).
 *   2. `selected` status'lu en az 1 item olmalı (FinalizeGateError).
 *      Pending ve rejected sayılmaz.
 */
export function assertCanFinalize(
  set: SelectionSet,
  items: SelectionItem[],
): void {
  if (set.status !== "draft") {
    throw new SetReadOnlyError(
      `Set "${set.status}" state'inde — finalize edilemez`,
    );
  }
  const selectedCount = items.filter((i) => i.status === "selected").length;
  if (selectedCount < 1) {
    throw new FinalizeGateError(
      "Finalize için en az 1 'selected' item gerekli",
    );
  }
}

/**
 * Archive transition'ını doğrular.
 *
 * `draft` ve `ready` → pass. `archived` → InvalidStateTransitionError
 * (idempotent değil; explicit hata).
 */
export function assertCanArchive(set: SelectionSet): void {
  if (set.status === "archived") {
    throw new InvalidStateTransitionError("Set zaten archived");
  }
}

/**
 * Set'i finalize et: `draft → ready`.
 *
 * Akış:
 *   1. Ownership doğrulaması (Task 17 helper — cross-user / yok →
 *      NotFoundError 404).
 *   2. Item'ları fetch et (gate hesabı için).
 *   3. assertCanFinalize — gate fail throw → tx açılmaz, rollback gereksiz.
 *   4. Tx içinde set row'unu update: status = "ready", finalizedAt = now().
 *      Item'lara dokunulmaz (pending donar — Section 4.3).
 *
 * Return: güncellenmiş set entity.
 */
export async function finalizeSet(input: {
  userId: string;
  setId: string;
}): Promise<SelectionSet> {
  const { userId, setId } = input;

  // 1. Ownership (cross-user / yok → NotFoundError)
  const set = await requireSetOwnership({ userId, setId });

  // 2. Items fetch
  const items = await db.selectionItem.findMany({
    where: { selectionSetId: setId },
  });

  // 3. Gate (throw → tx açılmaz)
  assertCanFinalize(set, items);

  // 4. Atomic update — interactive transaction (gate'i tx içinde tekrar
  //    değerlendirme imkanı için çerçeve hazır; bugün tek statement).
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    return tx.selectionSet.update({
      where: { id: setId },
      data: {
        status: "ready",
        finalizedAt: new Date(),
      },
    });
  });
}
