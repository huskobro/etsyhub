// Local Library — assets list endpoint (Phase 5 §3, Task 11)
// Sözleşme: kullanıcının kendi aktif (isUserDeleted=false) asset'lerini döner.
// Filtreler: ?folder=<folderName>, ?negativesOnly=true.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { withErrorHandling } from "@/lib/http";

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const folder = searchParams.get("folder");
  const showNegativesOnly = searchParams.get("negativesOnly") === "true";

  const assets = await db.localLibraryAsset.findMany({
    where: {
      userId: user.id,
      isUserDeleted: false,
      ...(folder ? { folderName: folder } : {}),
      ...(showNegativesOnly ? { isNegative: true } : {}),
    },
    orderBy: { fileName: "asc" },
  });
  return NextResponse.json({ assets });
});
