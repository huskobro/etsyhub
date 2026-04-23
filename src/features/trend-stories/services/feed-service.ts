/**
 * Trend Stories feed servisi.
 *
 * Tek public API: fetchFeed({ userId, windowDays, cursor, limit? })
 * Döner: { items: FeedItem[], nextCursor: string | null }
 *
 * Cursor: base64 encoded JSON { firstSeenAt: ISO string, listingId: string }
 * Decode API route'da (Task 10) yapılır; bu servise decoded gelir.
 */

import { db } from "@/server/db";
import {
  FEED_PAGE_SIZE,
  type WindowDays,
} from "@/features/trend-stories/constants";
import {
  TrendClusterStatus,
  CompetitorListingStatus,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MembershipHint = {
  clusterId: string;
  label: string;
  seasonalTag: string | null;
};

export type FeedItem = {
  listingId: string;
  title: string;
  thumbnailUrl: string | null;
  reviewCount: number;
  sourceUrl: string;
  competitorStoreId: string;
  competitorStoreName: string;
  firstSeenAt: Date;
  trendMembershipHint: MembershipHint | null;
};

// ---------------------------------------------------------------------------
// Pure helper — exported for unit testing
// ---------------------------------------------------------------------------

type MembershipEntry = {
  cluster: {
    id: string;
    label: string;
    seasonalTag: string | null;
    clusterScore: number;
    storeCount: number;
    memberCount: number;
  };
};

/**
 * Bir listing için birden fazla cluster membership varsa deterministik
 * tek hint seçer.
 *
 * Sıralama önceliği:
 *  1. clusterScore desc
 *  2. storeCount desc
 *  3. memberCount desc
 *  4. label asc (alfabetik)
 */
export function pickTopMembership(
  memberships: MembershipEntry[]
): MembershipHint | null {
  if (memberships.length === 0) return null;

  // Orijinal diziyi bozmamak için kopya üzerinde sort yap
  const sorted = [...memberships].sort((a, b) => {
    const ac = a.cluster;
    const bc = b.cluster;

    if (bc.clusterScore !== ac.clusterScore) return bc.clusterScore - ac.clusterScore;
    if (bc.storeCount !== ac.storeCount) return bc.storeCount - ac.storeCount;
    if (bc.memberCount !== ac.memberCount) return bc.memberCount - ac.memberCount;
    return ac.label.localeCompare(bc.label);
  });

  const top = sorted[0];
  if (!top) return null;

  return {
    clusterId: top.cluster.id,
    label: top.cluster.label,
    seasonalTag: top.cluster.seasonalTag,
  };
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function fetchFeed(args: {
  userId: string;
  windowDays: WindowDays;
  cursor: { firstSeenAt: Date; listingId: string } | null;
  limit?: number;
}): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  const limit = args.limit ?? FEED_PAGE_SIZE;
  const since = new Date(Date.now() - args.windowDays * 24 * 60 * 60 * 1000);

  // Kullanıcıya ait aktif competitor store id'lerini getir
  const userCompetitorStoreIds = (
    await db.competitorStore.findMany({
      where: { userId: args.userId, deletedAt: null },
      select: { id: true },
    })
  ).map((s) => s.id);

  if (userCompetitorStoreIds.length === 0) {
    return { items: [], nextCursor: null };
  }

  // Listing'leri çek — status filtresi ile (schema'da deletedAt yok)
  const listings = await db.competitorListing.findMany({
    where: {
      competitorStoreId: { in: userCompetitorStoreIds },
      status: CompetitorListingStatus.ACTIVE,
      firstSeenAt: {
        gte: since,
        ...(args.cursor ? { lte: args.cursor.firstSeenAt } : {}),
      },
      ...(args.cursor ? { NOT: { id: args.cursor.listingId } } : {}),
    },
    orderBy: [{ firstSeenAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: {
      competitorStore: {
        select: { displayName: true, etsyShopName: true },
      },
    },
  });

  // Pagination: take limit+1 pattern
  const hasMore = listings.length > limit;
  const page = listings.slice(0, limit);

  // Listing'lerin cluster membership'lerini toplu çek
  const listingIds = page.map((l) => l.id);
  const memberships =
    listingIds.length > 0
      ? await db.trendClusterMember.findMany({
          where: {
            userId: args.userId,
            listingId: { in: listingIds },
            cluster: { status: TrendClusterStatus.ACTIVE },
          },
          include: {
            cluster: {
              select: {
                id: true,
                label: true,
                seasonalTag: true,
                clusterScore: true,
                storeCount: true,
                memberCount: true,
              },
            },
          },
        })
      : [];

  // listingId → memberships map
  const listingToMemberships = new Map<string, typeof memberships>();
  for (const m of memberships) {
    const arr = listingToMemberships.get(m.listingId);
    if (arr) {
      arr.push(m);
    } else {
      listingToMemberships.set(m.listingId, [m]);
    }
  }

  // FeedItem dizisi oluştur
  const items: FeedItem[] = page.map((l) => {
    const ms = listingToMemberships.get(l.id) ?? [];
    return {
      listingId: l.id,
      title: l.title,
      thumbnailUrl: l.thumbnailUrl,
      reviewCount: l.reviewCount,
      sourceUrl: l.sourceUrl,
      competitorStoreId: l.competitorStoreId,
      competitorStoreName:
        l.competitorStore.displayName ?? l.competitorStore.etsyShopName,
      firstSeenAt: l.firstSeenAt,
      trendMembershipHint: pickTopMembership(ms),
    };
  });

  // Next cursor üret (base64 encoded)
  let nextCursor: string | null = null;
  if (hasMore && page.length > 0) {
    const last = page.at(-1);
    if (last) {
      nextCursor = Buffer.from(
        `${last.firstSeenAt.toISOString()}|${last.id}`,
        "utf8"
      ).toString("base64");
    }
  }

  return { items, nextCursor };
}
