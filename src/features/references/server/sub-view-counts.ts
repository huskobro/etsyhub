// R11.14 — References B1 sub-view counts aggregation (server-side).
// Reuse mevcut tablolar; ek schema yok. User-scoped paralel aggregation.
//
// R11.14.2 — `*ThisWeek` sayaçları topbar subtitle parity için eklendi.
// v5 B1 hedef format: "142 REFERENCES · 38 ADDED THIS WEEK".

import { db } from "@/server/db";

export interface ReferencesSubViewCounts {
  pool: number;
  stories: number;
  inbox: number;
  shops: number;
  collections: number;
  /** R11.14.2 — son 7 günde eklenen kayıt sayıları (subtitle parity). */
  poolThisWeek: number;
  inboxThisWeek: number;
  shopsThisWeek: number;
  collectionsThisWeek: number;
}

export async function getReferencesSubViewCounts(
  userId: string,
): Promise<ReferencesSubViewCounts> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    pool,
    inbox,
    shops,
    collections,
    stories,
    poolThisWeek,
    inboxThisWeek,
    shopsThisWeek,
    collectionsThisWeek,
  ] = await Promise.all([
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
    db.reference.count({
      where: { userId, deletedAt: null, createdAt: { gte: sevenDaysAgo } },
    }),
    db.bookmark.count({
      where: { userId, deletedAt: null, createdAt: { gte: sevenDaysAgo } },
    }),
    db.competitorStore.count({
      where: { userId, createdAt: { gte: sevenDaysAgo } },
    }),
    db.collection.count({
      where: { userId, deletedAt: null, createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  return {
    pool,
    stories,
    inbox,
    shops,
    collections,
    poolThisWeek,
    inboxThisWeek,
    shopsThisWeek,
    collectionsThisWeek,
  };
}
