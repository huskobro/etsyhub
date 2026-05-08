// R4 — Library → Selection handoff: mevcut sete asset ekleme.
//
// `handoffKeptAssetsToSelectionSet` (Pass 90) yeni set yaratır. R4'te
// Library bulk-bar / detail-panel "Add to Selection" akışı **mevcut bir
// draft set**'e ekleme yapar; reference + productType set'in
// `sourceMetadata.mjOrigin` blob'undan okunur (handoff zinciri orada
// yazıldı).
//
// Akış:
//   1. Set ownership + mutability guard (`requireSetOwnership` + draft).
//   2. sourceMetadata.mjOrigin yoksa → HandoffError("HANDOFF_UNSUPPORTED")
//      → route 422 ("Bu set için hand-off desteklenmiyor — yeni set
//      oluşturun veya legacy quick-start kullanın").
//   3. midjourneyAssetIds user-scope KEPT defansı (Pass 90 ile aynı kural).
//   4. bulkPromoteMidjourneyAssets idempotent.
//   5. addItems idempotent — duplicate skip.
//   6. sourceMetadata.mjOrigin.keptAssetCount + batch/template/variantKind
//      counters update (kümülatif).
//
// Boundary (CLAUDE.md):
//   - Library set CRUD'a sahip değil; bu akış yalnız *handoff*'tur.
//   - Selections boundary'de "set içeriği değişti, ama set'in kimliği
//     (referenceId/productTypeId) sabit kaldı" invariant'ı korunur.

import { MJReviewDecision, type Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { addItems } from "@/server/services/selection/items.service";
import { requireSetOwnership } from "@/server/services/selection/authz";
import { assertSetMutable } from "@/server/services/selection/state";
import {
  bulkPromoteMidjourneyAssets,
  type PromoteResult,
} from "@/server/services/midjourney/promote";
import { HandoffError } from "@/server/services/midjourney/kept";

export type AddFromLibraryInput = {
  userId: string;
  setId: string;
  midjourneyAssetIds: string[];
};

export type AddFromLibraryResult = {
  setId: string;
  itemsAdded: number;
  itemsAlreadyInSet: number;
  promotedCreated: number;
  promotedAlready: number;
};

interface MjOriginShape {
  kindFamily?: string;
  referenceId?: string;
  productTypeId?: string;
  batchIds?: string[];
  templateIds?: string[];
  variantKindCounts?: Record<string, number>;
  handedOffAt?: string;
  keptAssetCount?: number;
}

function readMjOrigin(sourceMetadata: unknown): MjOriginShape | null {
  if (!sourceMetadata || typeof sourceMetadata !== "object") return null;
  const obj = sourceMetadata as Record<string, unknown>;
  const candidate = obj["mjOrigin"];
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as MjOriginShape;
}

export async function addLibraryAssetsToExistingSet(
  input: AddFromLibraryInput,
): Promise<AddFromLibraryResult> {
  if (input.midjourneyAssetIds.length === 0) {
    throw new HandoffError("En az bir asset seçilmeli", "NO_ASSETS");
  }

  // 1. Ownership + mutable guard.
  const set = await requireSetOwnership({
    userId: input.userId,
    setId: input.setId,
  });
  assertSetMutable(set);

  // 2. mjOrigin oku.
  const mjOrigin = readMjOrigin(set.sourceMetadata);
  if (!mjOrigin || !mjOrigin.referenceId || !mjOrigin.productTypeId) {
    throw new HandoffError(
      "Bu set için hand-off desteklenmiyor — set'in referenceId/productTypeId tanımı yok. Yeni set oluşturun veya legacy quick-start kullanın.",
      "FORBIDDEN",
    );
  }

  // 3. User-scope + KEPT defansı (Pass 90 ile birebir).
  const allowed = await db.midjourneyAsset.findMany({
    where: {
      id: { in: input.midjourneyAssetIds },
      asset: { userId: input.userId },
      reviewDecision: MJReviewDecision.KEPT,
    },
    select: {
      id: true,
      variantKind: true,
      midjourneyJob: {
        select: {
          job: { select: { metadata: true } },
        },
      },
    },
  });
  if (allowed.length === 0) {
    throw new HandoffError(
      "Seçilen asset'lerin hiçbiri user'a ait değil veya KEPT değil",
      "FORBIDDEN",
    );
  }
  const allowedIds = allowed.map((a) => a.id);

  // 4. Promote (idempotent).
  const promoteResult = await bulkPromoteMidjourneyAssets({
    midjourneyAssetIds: allowedIds,
    referenceId: mjOrigin.referenceId,
    productTypeId: mjOrigin.productTypeId,
    actorUserId: input.userId,
  });
  const generatedDesignIds = promoteResult.results.map(
    (r: PromoteResult) => r.generatedDesignId,
  );

  // 5. addItems — duplicate skip içeriden.
  const added = await addItems({
    userId: input.userId,
    setId: set.id,
    items: generatedDesignIds.map((id) => ({ generatedDesignId: id })),
  });

  // 6. mjOrigin counters update (kümülatif).
  const variantKindCounts: Record<string, number> = {
    ...(mjOrigin.variantKindCounts ?? {}),
  };
  const batchSet = new Set<string>(mjOrigin.batchIds ?? []);
  const templateSet = new Set<string>(mjOrigin.templateIds ?? []);
  for (const a of allowed) {
    variantKindCounts[a.variantKind] =
      (variantKindCounts[a.variantKind] ?? 0) + 1;
    const md = (a.midjourneyJob.job?.metadata ?? null) as Record<
      string,
      unknown
    > | null;
    if (md && typeof md["batchId"] === "string") {
      batchSet.add(md["batchId"] as string);
    }
    if (md && typeof md["batchTemplateId"] === "string") {
      templateSet.add(md["batchTemplateId"] as string);
    }
  }

  const updatedOrigin: MjOriginShape = {
    ...mjOrigin,
    batchIds: Array.from(batchSet),
    templateIds: Array.from(templateSet),
    variantKindCounts,
    keptAssetCount: (mjOrigin.keptAssetCount ?? 0) + allowedIds.length,
  };

  const existingMeta =
    set.sourceMetadata && typeof set.sourceMetadata === "object"
      ? (set.sourceMetadata as Record<string, unknown>)
      : {};
  const nextMeta: Record<string, unknown> = {
    ...existingMeta,
    mjOrigin: updatedOrigin as unknown as Record<string, unknown>,
  };
  await db.selectionSet.update({
    where: { id: set.id },
    data: {
      sourceMetadata: nextMeta as Prisma.InputJsonValue,
    },
  });

  return {
    setId: set.id,
    itemsAdded: added.length,
    itemsAlreadyInSet: generatedDesignIds.length - added.length,
    promotedCreated: promoteResult.createdCount,
    promotedAlready: promoteResult.alreadyPromotedCount,
  };
}
