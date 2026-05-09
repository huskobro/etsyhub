// R11.14 — References B1 sub-view counts aggregation (server-side).
// Reuse mevcut tablolar; ek schema yok. User-scoped paralel aggregation.

import { db } from "@/server/db";

export interface ReferencesSubViewCounts {
  pool: number;
  stories: number;
  inbox: number;
  shops: number;
  collections: number;
}

export async function getReferencesSubViewCounts(
  userId: string,
): Promise<ReferencesSubViewCounts> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [pool, inbox, shops, collections, stories] = await Promise.all([
    db.reference.count({ where: { userId, deletedAt: null } }),
    db.bookmark.count({ where: { userId, deletedAt: null } }),
    db.competitorStore.count({ where: { userId } }),
    db.collection.count({ where: { userId, deletedAt: null } }),
    // Stories: son 7 gün içinde ilk görülen rakip listing sayısı
    db.competitorListing.count({
      where: {
        userId,
        firstSeenAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  return { pool, stories, inbox, shops, collections };
}
