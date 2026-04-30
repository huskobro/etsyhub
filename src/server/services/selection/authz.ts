// Phase 7 Task 17 — Authorization helpers (404 disiplini).
//
// Amaç: Tüm Phase 7 service ve route'larda tutarlı ownership kontrolü +
// cross-user erişim için 404 (403 değil — varlık sızıntısını engellemek için).
//
// Phase 6 emsalı: `src/app/api/review/decisions/route.ts` — `findFirst({
// id, userId })` dönmediyse `throw new NotFoundError()`. Bu helper aynı
// disiplini Phase 7 entity'leri (SelectionSet/SelectionItem) için tek
// noktadan sağlar; service ve route'lar boilerplate yazmaz.
//
// Sözleşme:
//   - `requireSetOwnership` — set'in ownership'ini doğrular; entity'yi caller'a
//     hazır döner (caller ikinci `findFirst` çekmek zorunda kalmaz).
//   - `requireItemOwnership` — önce set ownership; sonra item'ın o set'e bağlı
//     olduğunu doğrular. Cross-user item erişimi bile set kontrolünde 404
//     olarak gizlenir (item'ın varlığı sızdırılmaz).
//
// DB query disiplini: `findFirst` (composite filter; tek roundtrip).
// `findUnique + manual check` paterni kullanılmaz — fazladan roundtrip ve
// daha çok manuel hata yüzeyi.
//
// Hata: `NotFoundError` (`@/lib/errors`) — Phase 6'da zaten var, status=404,
// code="NOT_FOUND". `errorResponse` helper'ı (src/lib/http.ts) bu sınıfı
// otomatik HTTP 404'e map eder; route'larda extra mapping gerekmez.

import type { SelectionItem, SelectionSet } from "@prisma/client";
import { db } from "@/server/db";
import { NotFoundError } from "@/lib/errors";

/**
 * Set'in ownership'ini doğrular. Sahip değilse veya yoksa NotFoundError fırlatır.
 *
 * Caller sonraki ihtiyaç duyduğu anda set entity'ye sahiptir; ikinci query'ye
 * gerek yoktur.
 */
export async function requireSetOwnership(args: {
  userId: string;
  setId: string;
}): Promise<SelectionSet> {
  const { userId, setId } = args;
  const set = await db.selectionSet.findFirst({
    where: { id: setId, userId },
  });
  if (!set) {
    throw new NotFoundError("Selection set bulunamadı");
  }
  return set;
}

/**
 * Item ownership'ini doğrular. Önce set ownership (cross-user item erişimi
 * bile set kontrolünde 404 olarak gizlenir), sonra item'ın o set'e bağlı
 * olduğu kontrol edilir.
 */
export async function requireItemOwnership(args: {
  userId: string;
  setId: string;
  itemId: string;
}): Promise<SelectionItem> {
  const { userId, setId, itemId } = args;
  // Set ownership önce — yoksa item varlığını sızdırmadan 404.
  await requireSetOwnership({ userId, setId });

  const item = await db.selectionItem.findFirst({
    where: { id: itemId, selectionSetId: setId },
  });
  if (!item) {
    throw new NotFoundError("Selection item bulunamadı");
  }
  return item;
}
