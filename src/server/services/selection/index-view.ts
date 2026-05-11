// R4 — Selections B2 index view-model.
//
// `listSets` (Pass 35) zaten her set için thumbnailUrl + itemCount dönüyor;
// B2 ek olarak 3-up grid thumb composite ve "edited item count" istiyor
// (stage derivation için). Bu helper o iki alanı set başına aggregate eder.
//
// Tasarım kararları:
//   - listSets'e bağımlı kal — yeni N+1 query açma. Tek `groupBy` ile
//     setId → editedCount, ek bir findMany ile setId × position 0..2 thumb
//     adayları.
//   - storage signed URL üretimi listSets'tekiyle aynı TTL (1h); aynı asset
//     iki kez sign edilirse cache yarara.
//   - Cross-user filter set listesi zaten userId-scope geldiği için sub-
//     query'ler `selectionSet.userId = userId` zorunluğu taşımaz; setId
//     in-clause yeterli (defense in depth: zaten kullanıcı görmediği seti
//     listSets döndürmedi).

import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";
import { logger } from "@/lib/logger";
import {
  listSets,
  type SelectionSetListView,
} from "./sets.service";

const COMPOSITE_TTL_SECONDS = 3600;
const COMPOSITE_SLOTS = 3;

export type SelectionSetIndexView = SelectionSetListView & {
  /** 3-up thumb composite (boş slotlar null). */
  thumbsComposite: (string | null)[];
  /** editedAssetId not null olan item sayısı (stage derivation için). */
  editedItemCount: number;
};

export async function listSelectionsForIndex(input: {
  userId: string;
  status?: "draft" | "ready" | "archived";
}): Promise<SelectionSetIndexView[]> {
  const sets = await listSets(input);
  if (sets.length === 0) return [];

  const setIds = sets.map((s) => s.id);

  // 3-up thumbnail kandidatları: her set için ilk 3 item'ın aktif asset'i.
  // ORDER BY (selectionSetId asc, position asc) → aynı set için ilk 3
  // satır kullanılabilir.
  const items = await db.selectionItem.findMany({
    where: { selectionSetId: { in: setIds } },
    orderBy: [{ selectionSetId: "asc" }, { position: "asc" }],
    select: {
      selectionSetId: true,
      position: true,
      sourceAssetId: true,
      editedAssetId: true,
    },
  });

  const slotsBySet = new Map<string, string[]>(); // setId → [activeAssetId,..]
  const editedCountBySet = new Map<string, number>();
  for (const it of items) {
    if (it.editedAssetId !== null) {
      editedCountBySet.set(
        it.selectionSetId,
        (editedCountBySet.get(it.selectionSetId) ?? 0) + 1,
      );
    }
    const slots = slotsBySet.get(it.selectionSetId) ?? [];
    if (slots.length < COMPOSITE_SLOTS) {
      slots.push(it.editedAssetId ?? it.sourceAssetId);
      slotsBySet.set(it.selectionSetId, slots);
    }
  }

  // Asset → storageKey
  const allAssetIds = new Set<string>();
  for (const slots of slotsBySet.values()) {
    for (const id of slots) allAssetIds.add(id);
  }
  const assets =
    allAssetIds.size > 0
      ? await db.asset.findMany({
          where: { id: { in: Array.from(allAssetIds) } },
          select: { id: true, storageKey: true },
        })
      : [];
  const storageKeyByAssetId = new Map(assets.map((a) => [a.id, a.storageKey]));

  // Signed URL üretimi — best-effort, fail null bırakır.
  const storage = getStorage();
  const urlByAssetId = new Map<string, string>();
  await Promise.all(
    Array.from(allAssetIds).map(async (assetId) => {
      const key = storageKeyByAssetId.get(assetId);
      if (!key) return;
      try {
        const url = await storage.signedUrl(key, COMPOSITE_TTL_SECONDS);
        urlByAssetId.set(assetId, url);
      } catch (err) {
        logger.warn(
          {
            assetId,
            err: err instanceof Error ? err.message : String(err),
          },
          "selection b2 composite signed URL failed",
        );
      }
    }),
  );

  return sets.map((set) => {
    const slotIds = slotsBySet.get(set.id) ?? [];
    const thumbsComposite: (string | null)[] = Array.from(
      { length: COMPOSITE_SLOTS },
      (_, idx) => {
        const id = slotIds[idx];
        return id ? (urlByAssetId.get(id) ?? null) : null;
      },
    );
    return {
      ...set,
      thumbsComposite,
      editedItemCount: editedCountBySet.get(set.id) ?? 0,
    };
  });
}
