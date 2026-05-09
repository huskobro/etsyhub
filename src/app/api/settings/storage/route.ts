// R7 — GET /api/settings/storage
//
// Storage provider info için read-only summary. Provider key, bucket,
// asset count + total bytes stored. Configuration UI R8'de gelir.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { db } from "@/server/db";
import { env } from "@/lib/env";

export const GET = withErrorHandling(async () => {
  const user = await requireUser();

  const [assetAgg, mockupRenderCount] = await Promise.all([
    db.asset.aggregate({
      _count: { _all: true },
      _sum: { sizeBytes: true },
      where: { userId: user.id, deletedAt: null },
    }),
    db.mockupRender.count({
      where: { status: "SUCCESS" },
    }),
  ]);

  return NextResponse.json({
    storage: {
      provider: env.STORAGE_PROVIDER,
      bucket: env.STORAGE_BUCKET,
      assetCount: assetAgg._count._all ?? 0,
      assetBytes: Number(assetAgg._sum.sizeBytes ?? 0),
      mockupRenderCount,
    },
  });
});
