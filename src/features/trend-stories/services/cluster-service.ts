import { normalizeForSimilarity } from "./normalize";
import { deriveProductTypeKey } from "./product-type-derive";
import { detectSeasonalTag } from "./seasonal-detect";
import {
  WINDOW_THRESHOLDS,
  OVERLAP_PRUNE_THRESHOLD,
  WINDOW_DAYS,
  MAX_CLUSTER_MEMBERS_SCAN,
  type WindowDays,
} from "@/features/trend-stories/constants";
import { db } from "@/server/db";
import { TrendClusterStatus } from "@prisma/client";

export type CompetitorListingForCluster = {
  id: string;
  competitorStoreId: string;
  title: string;
  reviewCount: number;
  firstSeenAt: Date;
  listingCreatedAt: Date | null;
};

export type ClusterCandidate = {
  signature: string;
  label: string;
  memberListingIds: string[];
  storeCount: number;
  memberCount: number;
  totalReviewCount: number;
  latestMemberSeenAt: Date | null;
  heroListingId: string | null;
  productTypeKey: string | null;
  productTypeSource: "keyword_match" | "member_majority" | null;
  productTypeConfidence: number | null;
  seasonalTag: string | null;
  clusterScore: number;
};

function buildNGrams(tokens: string[], n: number): string[] {
  if (tokens.length < n) return [];
  const grams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) grams.push(tokens.slice(i, i + n).join(" "));
  return grams;
}

function recencyBoost(latest: Date | null, today: Date): number {
  if (!latest) return 0;
  const diffDays = (today.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 3) return 5;
  if (diffDays <= 7) return 2;
  return 0;
}

export function clusterListings(input: {
  listings: CompetitorListingForCluster[];
  windowDays: WindowDays;
  today: Date;
}): ClusterCandidate[] {
  const { listings, windowDays, today } = input;
  const threshold = WINDOW_THRESHOLDS[windowDays];

  type SigIdx = Map<string, Set<string>>;
  const sigToListings: SigIdx = new Map();
  const listingById = new Map<string, CompetitorListingForCluster>();

  for (const l of listings) {
    listingById.set(l.id, l);
    const tokens = normalizeForSimilarity(l.title);
    const grams = [...buildNGrams(tokens, 2), ...buildNGrams(tokens, 3)];
    for (const g of grams) {
      if (!sigToListings.has(g)) sigToListings.set(g, new Set());
      sigToListings.get(g)!.add(l.id);
    }
  }

  const candidates: ClusterCandidate[] = [];
  for (const [sig, idSet] of sigToListings.entries()) {
    const memberIds = Array.from(idSet);
    if (memberIds.length < threshold.minListing) continue;
    const members = memberIds.map((id) => listingById.get(id)!);
    const storeSet = new Set(members.map((m) => m.competitorStoreId));
    if (storeSet.size < threshold.minStore) continue;

    const totalReviewCount = members.reduce((acc, m) => acc + m.reviewCount, 0);
    const latestMemberSeenAt = members.reduce<Date | null>(
      (acc, m) => (acc === null || m.firstSeenAt > acc ? m.firstSeenAt : acc),
      null,
    );

    // minListing >= 2 guarantees members is non-empty; first element always exists
    const firstMember = members[0] as CompetitorListingForCluster;
    const hero = members.reduce(
      (acc, m) => (m.reviewCount > acc.reviewCount ? m : acc),
      firstMember,
    );

    const titles = members.map((m) => m.title);
    const pt = deriveProductTypeKey(titles);
    const seasonal = detectSeasonalTag(sig, today);

    const score =
      storeSet.size * 3 +
      Math.round(Math.log10(totalReviewCount + 1) * 2) +
      members.length * 1 +
      recencyBoost(latestMemberSeenAt, today);

    candidates.push({
      signature: sig,
      label: sig,
      memberListingIds: memberIds,
      storeCount: storeSet.size,
      memberCount: members.length,
      totalReviewCount,
      latestMemberSeenAt,
      heroListingId: hero.id,
      productTypeKey: pt?.key ?? null,
      productTypeSource: pt?.source ?? null,
      productTypeConfidence: pt?.confidence ?? null,
      seasonalTag: seasonal,
      clusterScore: score,
    });
  }

  candidates.sort((a, b) => {
    if (b.storeCount !== a.storeCount) return b.storeCount - a.storeCount;
    if (b.totalReviewCount !== a.totalReviewCount) return b.totalReviewCount - a.totalReviewCount;
    const aToks = a.signature.split(" ").length;
    const bToks = b.signature.split(" ").length;
    if (bToks !== aToks) return bToks - aToks;
    return a.signature.localeCompare(b.signature);
  });

  const kept: ClusterCandidate[] = [];
  const suppressed = new Set<string>();
  for (const c of candidates) {
    if (suppressed.has(c.signature)) continue;
    kept.push(c);
    const cSet = new Set(c.memberListingIds);
    for (const other of candidates) {
      if (other === c || suppressed.has(other.signature)) continue;
      const oSet = new Set(other.memberListingIds);
      const inter = [...cSet].filter((x) => oSet.has(x)).length;
      const overlap = inter / Math.min(cSet.size, oSet.size);
      if (overlap >= OVERLAP_PRUNE_THRESHOLD) suppressed.add(other.signature);
    }
  }

  return kept;
}

/**
 * Kullanıcıya ait tüm zaman pencerelerinde trend cluster'larını yeniden
 * hesaplar ve DB'yi upsert ile günceller.
 *
 * - Aktif rakip mağaza yoksa tüm ACTIVE cluster'lar STALE yapılır.
 * - Her pencere için clusterListings() çalışır, sonuçlar DB'ye yazılır.
 * - TrendClusterMember set farkı alınarak sadece delta güncellenir.
 * - Eşik altında kalan (hesaplamada çıkmayan) cluster'lar STALE işaretlenir.
 */
export async function recomputeTrendClustersForUser(
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const userCompetitorStoreIds = (
    await db.competitorStore.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    })
  ).map((s) => s.id);

  if (userCompetitorStoreIds.length === 0) {
    await db.trendCluster.updateMany({
      where: { userId, status: TrendClusterStatus.ACTIVE },
      data: { status: TrendClusterStatus.STALE, computedAt: now },
    });
    return;
  }

  for (const windowDays of WINDOW_DAYS) {
    const since = new Date(
      now.getTime() - windowDays * 24 * 60 * 60 * 1000,
    );
    const listings = await db.competitorListing.findMany({
      where: {
        competitorStoreId: { in: userCompetitorStoreIds },
        firstSeenAt: { gte: since },
        status: "ACTIVE",
      },
      select: {
        id: true,
        competitorStoreId: true,
        title: true,
        reviewCount: true,
        firstSeenAt: true,
        listingCreatedAt: true,
      },
      take: MAX_CLUSTER_MEMBERS_SCAN,
      orderBy: { firstSeenAt: "desc" },
    });

    const candidates = clusterListings({ listings, windowDays, today: now });

    // ProductType FK resolve
    const neededKeys = Array.from(
      new Set(
        candidates
          .map((c) => c.productTypeKey)
          .filter((k): k is string => !!k),
      ),
    );
    const productTypes = neededKeys.length
      ? await db.productType.findMany({
          where: { key: { in: neededKeys } },
          select: { id: true, key: true },
        })
      : [];
    const keyToId = new Map(productTypes.map((p) => [p.key, p.id]));

    const activeSignatures = new Set<string>();
    for (const c of candidates) {
      activeSignatures.add(c.signature);
      const cluster = await db.trendCluster.upsert({
        where: {
          userId_signature_windowDays: {
            userId,
            signature: c.signature,
            windowDays,
          },
        },
        create: {
          userId,
          signature: c.signature,
          label: c.label,
          productTypeId: c.productTypeKey
            ? (keyToId.get(c.productTypeKey) ?? null)
            : null,
          productTypeSource: c.productTypeSource,
          productTypeConfidence: c.productTypeConfidence,
          windowDays,
          memberCount: c.memberCount,
          storeCount: c.storeCount,
          totalReviewCount: c.totalReviewCount,
          latestMemberSeenAt: c.latestMemberSeenAt,
          heroListingId: c.heroListingId,
          seasonalTag: c.seasonalTag,
          status: TrendClusterStatus.ACTIVE,
          clusterScore: c.clusterScore,
          computedAt: now,
        },
        update: {
          label: c.label,
          productTypeId: c.productTypeKey
            ? (keyToId.get(c.productTypeKey) ?? null)
            : null,
          productTypeSource: c.productTypeSource,
          productTypeConfidence: c.productTypeConfidence,
          memberCount: c.memberCount,
          storeCount: c.storeCount,
          totalReviewCount: c.totalReviewCount,
          latestMemberSeenAt: c.latestMemberSeenAt,
          heroListingId: c.heroListingId,
          seasonalTag: c.seasonalTag,
          status: TrendClusterStatus.ACTIVE,
          clusterScore: c.clusterScore,
          computedAt: now,
        },
      });

      // Member diff (set fark)
      const existing = await db.trendClusterMember.findMany({
        where: { clusterId: cluster.id },
        select: { listingId: true },
      });
      const existingIds = new Set(existing.map((e) => e.listingId));
      const newIds = new Set(c.memberListingIds);
      const toAdd = [...newIds].filter((id) => !existingIds.has(id));
      const toRemove = [...existingIds].filter((id) => !newIds.has(id));

      if (toAdd.length) {
        await db.trendClusterMember.createMany({
          data: toAdd.map((listingId) => ({
            clusterId: cluster.id,
            listingId,
            userId,
          })),
          skipDuplicates: true,
        });
      }
      if (toRemove.length) {
        await db.trendClusterMember.deleteMany({
          where: { clusterId: cluster.id, listingId: { in: toRemove } },
        });
      }
    }

    // Eşik altına düşen cluster'ları STALE işaretle (window-scoped)
    await db.trendCluster.updateMany({
      where: {
        userId,
        windowDays,
        status: TrendClusterStatus.ACTIVE,
        signature: { notIn: Array.from(activeSignatures) },
      },
      data: { status: TrendClusterStatus.STALE, computedAt: now },
    });
  }
}
