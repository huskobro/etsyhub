// Phase 7 Task 5 — SelectionItem service.
//
// Item-level operasyonların (status değişimi, drawer ile ekleme, bulk update,
// hard delete, reorder) tek service'i. Tüm op'lar `assertSetMutable` çağırır
// (ready/archived set'te mutation yasak — design Section 4.3).
//
// Sözleşmeler (plan Task 5, design Section 2.3 + 2.4 + 4.3 + 4.4):
//
//   - addItems: drawer'dan çoklu ekleme. Duplicate (set'te zaten olan
//     generatedDesignId) silent skip. Yeni position değerleri mevcut max + 1,
//     2, ... Boş set'te 0'dan. sourceAssetId GeneratedDesign.assetId'sinden.
//
//   - updateItemStatus: tek item status değişimi. Geçiş matrisi (Section 4.4):
//     pending↔selected, pending↔rejected, selected↔rejected — tüm 6 geçiş
//     valid. Tek kural: read-only set'te mutation yasak.
//
//   - bulkUpdateStatus: çoklu status değişimi. updateMany ile atomik. Cross-set
//     itemId'ler `selectionSetId` filter'la otomatik elenir (defense in depth;
//     `requireSetOwnership` zaten cross-user'ı 404'lar).
//
//   - bulkDelete: çoklu hard-delete. **Asset entity DOKUNULMAZ** — yalnız
//     SelectionItem silinir (carry-forward stratejisi; asset cleanup ileri
//     task'lere bırakıldı).
//
//   - reorderItems: drag-drop sonrası bulk position update. Tam eşleşme şartı:
//     itemIds set'in TÜM item id'lerine birebir eşit (sayı + içerik). Eksik /
//     fazla / duplicate / cross-set → reject. Atomik tx (her item için ayrı
//     update — `updateMany` farklı değer atayamaz).
//
// Cross-user GeneratedDesign filter (addItems):
//   Spec'te explicit yazmıyor; pragmatic karar: SILENT SKIP.
//   Gerekçe: Duplicate'lar zaten silent skip ediliyor — UX uyumluluğu için
//   cross-user filter de aynı paterni izler. Throw yerine filter, çünkü
//   route layer'da batch'in kısmi başarısı normal durum (drawer'da kullanıcı
//   çoğu zaman kendi design'larını yollar; pathological case'i UX-disruptive
//   exception ile değil response shape ile yansıtmak istiyoruz).
//
// Atomicity:
//   - addItems: $transaction içinde max position fetch + bulk create — tek
//     iki-statement tx (concurrent ekleme çakışmasını minimize eder; race
//     hâlâ teorik mümkün ama application-level zarar yok — duplicate
//     position bir set içinde fonksiyonel sorun değil çünkü order asc + id
//     tiebreak yeterli).
//   - bulkUpdateStatus: tek `updateMany` — atomik.
//   - bulkDelete: tek `deleteMany` — atomik.
//   - reorderItems: tx içinde N adet `update` — `db.$transaction([...])` array
//     formu (interactive olmaya gerek yok; fail-fast).

import type { Prisma, SelectionItem } from "@prisma/client";
import { db } from "@/server/db";
import { ReorderMismatchError } from "@/lib/errors";
import { requireItemOwnership, requireSetOwnership } from "./authz";
import { assertSetMutable } from "./state";

// ────────────────────────────────────────────────────────────
// addItems
// ────────────────────────────────────────────────────────────

/**
 * Drawer ile çoklu item ekleme.
 *
 * - Set'te zaten olan generatedDesignId'ler silent skip.
 * - Cross-user GeneratedDesign'lar silent skip (kararı dosya başlığında).
 * - Yeni position değerleri mevcut max + 1, 2, ... (boş set'te 0'dan).
 * - sourceAssetId GeneratedDesign.assetId'sinden okunur.
 *
 * Return: yeni eklenen item'lar (skip edilenler hariç). Position asc sıralı.
 */
export async function addItems(input: {
  userId: string;
  setId: string;
  items: { generatedDesignId: string }[];
}): Promise<SelectionItem[]> {
  const { userId, setId, items } = input;

  // 1. Ownership + mutable guard
  const set = await requireSetOwnership({ userId, setId });
  assertSetMutable(set);

  if (items.length === 0) {
    return [];
  }

  const inputDesignIds = items.map((i) => i.generatedDesignId);

  // 2. Cross-user filter: yalnız caller'a ait GeneratedDesign'ları al ve
  //    assetId'lerini bir map'e topla. Cross-user veya yok olanlar otomatik
  //    elenmiş olur.
  const allowedDesigns = await db.generatedDesign.findMany({
    where: { id: { in: inputDesignIds }, userId },
    select: { id: true, assetId: true },
  });
  const designAssetById = new Map(
    allowedDesigns.map((d) => [d.id, d.assetId]),
  );

  // 3. Duplicate filter: set'te zaten olan generatedDesignId'ler.
  const existing = await db.selectionItem.findMany({
    where: {
      selectionSetId: setId,
      generatedDesignId: { in: inputDesignIds },
    },
    select: { generatedDesignId: true },
  });
  const existingIds = new Set(existing.map((e) => e.generatedDesignId));

  // 4. Eklenmeye uygun input listesi (input sırasını koru).
  const seen = new Set<string>();
  const toCreate: { generatedDesignId: string; sourceAssetId: string }[] = [];
  for (const item of items) {
    const id = item.generatedDesignId;
    if (seen.has(id)) continue; // input içinde duplicate → skip
    seen.add(id);
    if (existingIds.has(id)) continue; // set'te zaten var → skip
    const assetId = designAssetById.get(id);
    if (!assetId) continue; // cross-user veya yok → skip
    toCreate.push({ generatedDesignId: id, sourceAssetId: assetId });
  }

  if (toCreate.length === 0) {
    return [];
  }

  // 5. Atomik tx: max position fetch + bulk create. Tek tek create
  //    `db.$transaction([...])` array formuyla (interactive olmaya gerek
  //    yok — race ihtimali ufak ve domain-level zararsız).
  const created = await db.$transaction(async (tx) => {
    const last = await tx.selectionItem.findFirst({
      where: { selectionSetId: setId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const startPosition = last ? last.position + 1 : 0;

    // Sıralı create — Prisma createMany skipDuplicates compound unique
    // constraint olmadığı için duplicate koruma sağlamıyor; yine de
    // duplicate'ları yukarıda filtreledik, burada saf create.
    const rows: SelectionItem[] = [];
    for (let idx = 0; idx < toCreate.length; idx++) {
      const item = toCreate[idx]!;
      const row = await tx.selectionItem.create({
        data: {
          selectionSetId: setId,
          generatedDesignId: item.generatedDesignId,
          sourceAssetId: item.sourceAssetId,
          position: startPosition + idx,
        },
      });
      rows.push(row);
    }
    return rows;
  });

  return created;
}

// ────────────────────────────────────────────────────────────
// updateItemStatus
// ────────────────────────────────────────────────────────────

/**
 * Tek item status değişimi.
 *
 * Section 4.4 geçiş matrisi: tüm 6 geçiş valid (pending↔selected,
 * pending↔rejected, selected↔rejected). Tek kural: read-only set'te yasak.
 */
export async function updateItemStatus(input: {
  userId: string;
  setId: string;
  itemId: string;
  status: "pending" | "selected" | "rejected";
}): Promise<SelectionItem> {
  const { userId, setId, itemId, status } = input;

  // requireItemOwnership önce set ownership'i doğrular (cross-user → 404),
  // sonra item'ın o set'e bağlı olduğunu — buradan döndürdüğü item gereksiz.
  await requireItemOwnership({ userId, setId, itemId });

  // Set entity'yi mutable guard için tekrar fetch (requireItemOwnership
  // yalnız item dönüyor). Ufak roundtrip; clarity > marginal optimization.
  const set = await requireSetOwnership({ userId, setId });
  assertSetMutable(set);

  return db.selectionItem.update({
    where: { id: itemId },
    data: { status },
  });
}

// ────────────────────────────────────────────────────────────
// bulkUpdateStatus
// ────────────────────────────────────────────────────────────

/**
 * Çoklu item status değişimi (atomik updateMany).
 *
 * `selectionSetId` filter ile cross-set itemId'ler otomatik elenir
 * (defense in depth — `requireSetOwnership` zaten cross-user için 404 atıyor).
 */
export async function bulkUpdateStatus(input: {
  userId: string;
  setId: string;
  itemIds: string[];
  status: "pending" | "selected" | "rejected";
}): Promise<{ updatedCount: number }> {
  const { userId, setId, itemIds, status } = input;
  const set = await requireSetOwnership({ userId, setId });
  assertSetMutable(set);

  const result = await db.selectionItem.updateMany({
    where: { id: { in: itemIds }, selectionSetId: setId },
    data: { status },
  });
  return { updatedCount: result.count };
}

// ────────────────────────────────────────────────────────────
// bulkDelete
// ────────────────────────────────────────────────────────────

/**
 * Çoklu item hard-delete (atomik deleteMany).
 *
 * **Asset entity DOKUNULMAZ** — yalnız SelectionItem silinir. Asset cleanup
 * ileri task'lere bırakıldı (carry-forward).
 */
export async function bulkDelete(input: {
  userId: string;
  setId: string;
  itemIds: string[];
}): Promise<{ deletedCount: number }> {
  const { userId, setId, itemIds } = input;
  const set = await requireSetOwnership({ userId, setId });
  assertSetMutable(set);

  const result = await db.selectionItem.deleteMany({
    where: { id: { in: itemIds }, selectionSetId: setId },
  });
  return { deletedCount: result.count };
}

// ────────────────────────────────────────────────────────────
// reorderItems
// ────────────────────────────────────────────────────────────

/**
 * Drag-drop sonrası bulk position update.
 *
 * Tam eşleşme şartı: itemIds set'in TÜM item id'lerine birebir eşit (sayı +
 * içerik). Eksik / fazla / duplicate / cross-set → throw.
 *
 * Atomik: `db.$transaction([...])` — N adet update tek transaction'da.
 */
export async function reorderItems(input: {
  userId: string;
  setId: string;
  itemIds: string[];
}): Promise<SelectionItem[]> {
  const { userId, setId, itemIds } = input;
  const set = await requireSetOwnership({ userId, setId });
  assertSetMutable(set);

  // 1. Mevcut item'ları fetch
  const current = await db.selectionItem.findMany({
    where: { selectionSetId: setId },
    select: { id: true },
  });
  const currentIds = new Set(current.map((c) => c.id));

  // 2. Validate: duplicate yok, sayı eşit, içerik birebir
  // Hata durumunda `ReorderMismatchError` (400) atılır — generic Error yerine
  // typed sınıf, route boundary'de doğru HTTP status için (Task 21).
  if (itemIds.length !== currentIds.size) {
    throw new ReorderMismatchError(
      "itemIds set'in tüm item'larıyla tam eşleşmek zorunda (sayı uyuşmuyor)",
    );
  }
  const inputSet = new Set(itemIds);
  if (inputSet.size !== itemIds.length) {
    throw new ReorderMismatchError("itemIds duplicate içeriyor");
  }
  for (const id of itemIds) {
    if (!currentIds.has(id)) {
      throw new ReorderMismatchError(
        `itemIds set'in dışında bir id içeriyor: ${id}`,
      );
    }
  }

  // 3. Atomik tx: her item için yeni position = array index'i
  const updates: Prisma.PrismaPromise<SelectionItem>[] = itemIds.map(
    (id, idx) =>
      db.selectionItem.update({
        where: { id },
        data: { position: idx },
      }),
  );
  await db.$transaction(updates);

  // 4. Position asc sıralı dön
  return db.selectionItem.findMany({
    where: { selectionSetId: setId },
    orderBy: { position: "asc" },
  });
}
