// R11.14.5 — Sidebar nav count chips (v4 base.jsx parity).
// User-scoped paralel aggregation; her sidebar entry için at-a-glance
// count + pulse marker (Batches running > 0 → pulse). Failure mode:
// {} dönerek shell'in crash etmesini engeller.

import { db } from "@/server/db";

export interface NavCounts {
  references?: number;
  batches?: number;
  /** Batches'te running > 0 → pulse animasyon. */
  batchesPulse?: boolean;
  library?: number;
  selections?: number;
  products?: number;
}

/**
 * Compact human-friendly count format for sidebar display.
 *   1248 → "1.2k"
 *   86 → "86"
 *   1500000 → "1.5M"
 */
export function formatNavCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  const m = n / 1_000_000;
  return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
}

export async function getNavCounts(userId: string): Promise<NavCounts> {
  try {
    const [
      references,
      batchesRunning,
      batchesTotal,
      library,
      selections,
      products,
    ] = await Promise.all([
      db.reference.count({ where: { userId, deletedAt: null } }),
      // "Batch" UI = MidjourneyJob backend; in-flight = not COMPLETED/FAILED/CANCELLED.
      db.midjourneyJob.count({
        where: {
          userId,
          state: { notIn: ["COMPLETED", "FAILED", "CANCELLED"] },
        },
      }),
      db.midjourneyJob.count({ where: { userId } }),
      // MidjourneyAsset'in userId'i yok; MidjourneyJob ilişkisi üzerinden filter.
      db.midjourneyAsset.count({
        where: { midjourneyJob: { userId } },
      }),
      // SelectionSet `archivedAt` var (deletedAt yerine).
      db.selectionSet.count({ where: { userId, archivedAt: null } }),
      // "Products" UI = Listing backend (digital download listings).
      db.listing.count({ where: { userId, deletedAt: null } }),
    ]);

    return {
      references,
      batches: batchesTotal,
      batchesPulse: batchesRunning > 0,
      library,
      selections,
      products,
    };
  } catch {
    // Fail closed — shell shouldn't crash on count query failure.
    return {};
  }
}
