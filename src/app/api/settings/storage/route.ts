// R8 — GET / PUT /api/settings/storage
//
// GET: provider info + user storage stats + signed URL prefs.
// PUT: signedUrlTtlSeconds + thumbnailCacheSeconds (UserSetting key="storage").

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import {
  StoragePrefsSchema,
  getStoragePrefs,
  updateStoragePrefs,
} from "@/server/services/settings/storage-prefs.service";

export const GET = withErrorHandling(async () => {
  const user = await requireUser();

  const [assetAgg, mockupRenderCount, prefs] = await Promise.all([
    db.asset.aggregate({
      _count: { _all: true },
      _sum: { sizeBytes: true },
      where: { userId: user.id, deletedAt: null },
    }),
    db.mockupRender.count({
      where: { status: "SUCCESS" },
    }),
    getStoragePrefs(user.id),
  ]);

  return NextResponse.json({
    storage: {
      provider: env.STORAGE_PROVIDER,
      bucket: env.STORAGE_BUCKET,
      assetCount: assetAgg._count._all ?? 0,
      assetBytes: Number(assetAgg._sum.sizeBytes ?? 0),
      mockupRenderCount,
    },
    prefs,
  });
});

export const PUT = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json().catch(() => null);
  const parsed = StoragePrefsSchema.partial().safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz storage prefs", parsed.error.flatten());
  }
  const prefs = await updateStoragePrefs(user.id, parsed.data);
  return NextResponse.json({ prefs });
});
