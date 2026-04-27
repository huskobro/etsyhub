// Local Library — folders endpoint (Phase 5 §3, Task 11)
// Sözleşme: kullanıcının kendi (soft-delete'siz) asset'lerini folderName/folderPath
// üzerinden gruplar; sadece aktif (isUserDeleted=false) kayıtları sayar.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { withErrorHandling } from "@/lib/http";

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const groups = await db.localLibraryAsset.groupBy({
    by: ["folderName", "folderPath"],
    where: { userId: user.id, isUserDeleted: false },
    _count: { _all: true },
  });
  return NextResponse.json({
    folders: groups.map((g) => ({
      name: g.folderName,
      path: g.folderPath,
      fileCount: g._count._all,
    })),
  });
});
