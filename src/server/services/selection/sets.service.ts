// Phase 7 Task 3 — SelectionSet service (CRUD + read).
//
// Sözleşmeler (design Section 3.1 + 4.1 + 4.3):
//   - createSet: manuel set yaratma; status default `draft`; name trim sonrası
//     non-empty (zod CreateSelectionSetInputSchema route boundary'sinde de
//     enforce edilir; service kendi içinde de check eder — defense in depth).
//   - listSets: index için; userId filter zorunlu; status filter opsiyonel;
//     updatedAt desc sort.
//   - getSet: single set + items; ownership `requireSetOwnership` üzerinden
//     (cross-user / yok → NotFoundError, 404 disiplini). Items `position asc`.
//   - archiveSet: draft|ready → archived geçişi + archivedAt now(). Tam state
//     machine guard (assertCanArchive vs.) Task 4'te; bu task'te basit
//     "archived → archived" reject yeterli.
//
// Quick-start (`quickStartSet`) burada YOK — Task 15'te ayrı dispatch alacak
// (auto-import yapımı, source metadata snapshot, vb.).
//
// Phase 6 paterni: Phase 6 review service'lerinde olduğu gibi DB roundtrip'i
// minimize et — `requireSetOwnership` zaten set entity'yi döner; getSet
// içinde tekrar fetch yapmak yerine helper'ın dönen entity'yi reuse ediyoruz
// ve items'ı ayrı (ama ucuz) bir query ile çekiyoruz.

import type { SelectionItem, SelectionSet } from "@prisma/client";
import { db } from "@/server/db";
import { requireSetOwnership } from "./authz";
import { assertCanArchive } from "./state";

/**
 * Manuel set yarat. status default `draft`.
 *
 * `name` trim sonrası non-empty olmalı. Route boundary'de
 * `CreateSelectionSetInputSchema` (zod) zaten enforce eder; service kendi
 * içinde de check yapar (defense in depth — internal caller'lar zod by-pass
 * edebilir).
 */
export async function createSet(input: {
  userId: string;
  name: string;
}): Promise<SelectionSet> {
  const trimmed = input.name.trim();
  if (trimmed.length === 0) {
    throw new Error("name boş olamaz");
  }
  return db.selectionSet.create({
    data: {
      userId: input.userId,
      name: trimmed,
      status: "draft",
    },
  });
}

/**
 * Kullanıcının set'lerini listele. updatedAt desc.
 *
 * `status` opsiyonel — verilmezse tüm statüler döner. Index ekranı için
 * statü tab'lerine göre filtre uygulanır.
 */
export async function listSets(input: {
  userId: string;
  status?: "draft" | "ready" | "archived";
}): Promise<SelectionSet[]> {
  return db.selectionSet.findMany({
    where: {
      userId: input.userId,
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Single set + items detayı.
 *
 * Ownership önce `requireSetOwnership` ile (cross-user / yok → NotFoundError).
 * Helper set entity'yi döndüğü için ikinci `findUnique` çekmiyoruz; items
 * ayrı `findMany` (`position asc`).
 *
 * NOT: Mapper layer (Task 16) `review` field'ı bağlayacak; bu task'te raw
 * Prisma items dönüyor — view-shape'e map etme route/mapper sorumluluğu.
 */
export async function getSet(input: {
  userId: string;
  setId: string;
}): Promise<SelectionSet & { items: SelectionItem[] }> {
  const set = await requireSetOwnership(input);
  const items = await db.selectionItem.findMany({
    where: { selectionSetId: input.setId },
    orderBy: { position: "asc" },
  });
  return { ...set, items };
}

/**
 * Set'i archive et. draft|ready → archived geçişi.
 *
 * Task 4 (state machine guards):
 *   - cross-user / yok → NotFoundError (Task 17 `requireSetOwnership`)
 *   - archived → archived → InvalidStateTransitionError (`assertCanArchive`)
 *   - draft|ready geçer
 *
 * archivedAt: now() set edilir (audit/UX için).
 *
 * Tek public API yüzeyi: tüm archive girişimleri bu fonksiyondan geçer;
 * state.ts içindeki `assertCanArchive` ortak invariant.
 */
export async function archiveSet(input: {
  userId: string;
  setId: string;
}): Promise<SelectionSet> {
  const set = await requireSetOwnership(input);
  assertCanArchive(set);
  return db.selectionSet.update({
    where: { id: input.setId },
    data: {
      status: "archived",
      archivedAt: new Date(),
    },
  });
}
