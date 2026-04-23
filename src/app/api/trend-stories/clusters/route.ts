import { NextResponse } from "next/server";
import { z } from "zod";
import { TrendClusterStatus } from "@prisma/client";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { assertTrendStoriesAvailable } from "@/features/trend-stories/services/feature-gate";
import { CLUSTERS_LIST_PAGE_SIZE } from "@/features/trend-stories/constants";

const querySchema = z.object({
  window: z.enum(["1", "7", "30"]).default("7"),
});

export const GET = withErrorHandling(async (req: Request) => {
  await assertTrendStoriesAvailable();
  const user = await requireUser();

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    throw new ValidationError("Geçersiz sorgu", parsed.error.flatten());
  }

  const windowDays = Number(parsed.data.window);

  const clusters = await db.trendCluster.findMany({
    where: {
      userId: user.id,
      windowDays,
      status: TrendClusterStatus.ACTIVE,
    },
    orderBy: [{ clusterScore: "desc" }, { latestMemberSeenAt: "desc" }],
    take: CLUSTERS_LIST_PAGE_SIZE,
    include: {
      heroListing: {
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          sourceUrl: true,
          reviewCount: true,
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

  return NextResponse.json({
    clusters: clusters.map((c) => ({
      id: c.id,
      label: c.label,
      memberCount: c.memberCount,
      storeCount: c.storeCount,
      totalReviewCount: c.totalReviewCount,
      latestMemberSeenAt: c.latestMemberSeenAt,
      seasonalTag: c.seasonalTag,
      productType: c.productType,
      hero: c.heroListing,
      clusterScore: c.clusterScore,
    })),
  });
});
