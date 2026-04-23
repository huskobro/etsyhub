import { NextResponse } from "next/server";
import { z } from "zod";
import { TrendClusterStatus, CompetitorListingStatus } from "@prisma/client";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { db } from "@/server/db";
import { assertTrendStoriesAvailable } from "@/features/trend-stories/services/feature-gate";
import {
  decodeListingCursor,
  encodeListingCursor,
} from "@/features/trend-stories/services/listing-cursor";
import { CLUSTER_MEMBERS_PAGE_SIZE } from "@/features/trend-stories/constants";

const querySchema = z.object({
  membersCursor: z.string().optional(),
});

export const GET = withErrorHandling(
  async (req: Request, ctx: { params: { id: string } }) => {
    await assertTrendStoriesAvailable();
    const user = await requireUser();

    const url = new URL(req.url);
    const parsed = querySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );
    if (!parsed.success) {
      throw new ValidationError("Geçersiz sorgu", parsed.error.flatten());
    }

    const cluster = await db.trendCluster.findFirst({
      where: {
        id: ctx.params.id,
        userId: user.id,
        status: { not: TrendClusterStatus.ARCHIVED },
      },
      include: {
        heroListing: {
          select: {
            id: true,
            title: true,
            thumbnailUrl: true,
            sourceUrl: true,
            reviewCount: true,
            status: true,
          },
        },
        productType: {
          select: {
            id: true,
            key: true,
            displayName: true,
          },
        },
      },
    });

    if (!cluster) throw new NotFoundError();

    const cursor = decodeListingCursor(parsed.data.membersCursor ?? null);

    const members = await db.trendClusterMember.findMany({
      where: {
        clusterId: cluster.id,
        ...(cursor
          ? {
              OR: [
                { listing: { firstSeenAt: { lt: cursor.firstSeenAt } } },
                { listing: { firstSeenAt: cursor.firstSeenAt, id: { lt: cursor.listingId } } },
              ],
            }
          : {}),
      },
      orderBy: [
        { listing: { firstSeenAt: "desc" } },
        { listing: { id: "desc" } },
      ],
      take: CLUSTER_MEMBERS_PAGE_SIZE + 1,
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            thumbnailUrl: true,
            sourceUrl: true,
            reviewCount: true,
            firstSeenAt: true,
            status: true,
            competitorStore: {
              select: {
                displayName: true,
                etsyShopName: true,
              },
            },
          },
        },
      },
    });

    const hasMore = members.length > CLUSTER_MEMBERS_PAGE_SIZE;
    const pageMembers = members.slice(0, CLUSTER_MEMBERS_PAGE_SIZE);

    let nextCursor: string | null = null;
    if (hasMore && pageMembers.length > 0) {
      const last = pageMembers.at(-1);
      if (last) {
        nextCursor = encodeListingCursor({
          firstSeenAt: last.listing.firstSeenAt,
          listingId: last.listing.id,
        });
      }
    }

    // heroListing "silinmiş" sayılıyorsa (DELETED status) hero null döner
    const hero =
      cluster.heroListing &&
      cluster.heroListing.status !== CompetitorListingStatus.DELETED
        ? {
            id: cluster.heroListing.id,
            title: cluster.heroListing.title,
            thumbnailUrl: cluster.heroListing.thumbnailUrl,
            sourceUrl: cluster.heroListing.sourceUrl,
            reviewCount: cluster.heroListing.reviewCount,
          }
        : null;

    return NextResponse.json({
      cluster: {
        id: cluster.id,
        label: cluster.label,
        memberCount: cluster.memberCount,
        storeCount: cluster.storeCount,
        totalReviewCount: cluster.totalReviewCount,
        seasonalTag: cluster.seasonalTag,
        productType: cluster.productType,
        hero,
        status: cluster.status,
        clusterScore: cluster.clusterScore,
      },
      members: pageMembers.map((m) => ({
        listingId: m.listing.id,
        title: m.listing.title,
        thumbnailUrl: m.listing.thumbnailUrl,
        sourceUrl: m.listing.sourceUrl,
        reviewCount: m.listing.reviewCount,
        firstSeenAt: m.listing.firstSeenAt,
        competitorStoreName:
          m.listing.competitorStore.displayName ??
          m.listing.competitorStore.etsyShopName,
        deleted: m.listing.status === CompetitorListingStatus.DELETED,
      })),
      nextCursor,
    });
  },
);
