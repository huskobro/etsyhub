/**
 * Phase 55 — Shared selection lineage helper.
 *
 * Phase 50'den itibaren `SelectionSet.sourceMetadata` iki canonical
 * format'ı destekliyor:
 *
 *   1. `{ kind: "variation-batch", batchId, referenceId, productTypeId }`
 *      → Phase 5 GENERATE_VARIATIONS quickStart (sets.service)
 *   2. `{ mjOrigin: { batchIds: [...], referenceId? } }`
 *      → Phase 1 MJ kept-handoff (handoffKeptAssetsToSelectionSet)
 *
 * Bu iki format'tan canonical batch + reference id'lerini çıkarmak için
 * mockup studio'nun üç sürface'i (SetSummaryCard / S7JobView / S8ResultView)
 * + selection index server-side resolver (Phase 50) inline kopyalar
 * taşıyordu. Phase 55 küçük DRY: ortak helper, davranış değişikliği yok.
 *
 * Schema-zero (read-only); helper yalnız `unknown` blob'u parse eder.
 * Server-side resolver (`src/server/services/selection/index-view.ts`)
 * kendi inline kopyasını korur (build/runtime ayrı boundary'lerde
 * olduğu için DRY senaryosu farklı; server kopyası "resolveSourceLineage"
 * iki field birden döner). Bu helper yalnız UI tarafının inline kopyasını
 * birleştirir.
 */

export type SelectionSourceLineage = {
  batchId: string | null;
  referenceId: string | null;
};

export function resolveSelectionLineage(
  sourceMetadata: unknown,
): SelectionSourceLineage {
  if (!sourceMetadata || typeof sourceMetadata !== "object") {
    return { batchId: null, referenceId: null };
  }
  const md = sourceMetadata as Record<string, unknown>;

  // Path 1: variation-batch quickStart (Phase 5 GENERATE_VARIATIONS)
  if (md.kind === "variation-batch") {
    return {
      batchId: typeof md.batchId === "string" ? md.batchId : null,
      referenceId:
        typeof md.referenceId === "string" ? md.referenceId : null,
    };
  }

  // Path 2: MJ kept handoff (handoffKeptAssetsToSelectionSet)
  const mjOrigin = md.mjOrigin;
  if (mjOrigin && typeof mjOrigin === "object") {
    const mo = mjOrigin as Record<string, unknown>;
    const batchIds = Array.isArray(mo.batchIds) ? mo.batchIds : [];
    const firstBatchId =
      typeof batchIds[0] === "string" ? (batchIds[0] as string) : null;
    return {
      batchId: firstBatchId,
      referenceId:
        typeof mo.referenceId === "string" ? mo.referenceId : null,
    };
  }

  return { batchId: null, referenceId: null };
}

/**
 * Convenience — yalnız batchId döndüren shorthand (UI tarafının çoğu
 * inline kopyası bunu kullanıyor).
 */
export function resolveSourceBatchId(sourceMetadata: unknown): string | null {
  return resolveSelectionLineage(sourceMetadata).batchId;
}
