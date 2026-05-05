// Local Library — folders endpoint (Phase 5 §3, Task 11)
// Sözleşme: kullanıcının kendi (soft-delete'siz) asset'lerini folderName/folderPath
// üzerinden gruplar; sadece aktif (isUserDeleted=false) kayıtları sayar.
//
// Pass 23 — folder cover preview: her klasörün içindeki ilk asset'in
// hash'i + negatif/quality count'ları client'ta thumbnail strip için
// expose edilir. Mevcut groupBy + ek query ile pratik şekilde
// hesaplanır (38 klasör baseline tipik durumda yeterince ucuz).

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { withErrorHandling } from "@/lib/http";

type FolderSummary = {
  name: string;
  path: string;
  fileCount: number;
  // Pass 23 — preview strip data
  coverHashes: string[]; // ilk 3 asset hash'i (createdAt asc)
  negativeCount: number;
};

export const GET = withErrorHandling(async () => {
  const user = await requireUser();

  // 1) Klasör grupları + count
  const groups = await db.localLibraryAsset.groupBy({
    by: ["folderName", "folderPath"],
    where: { userId: user.id, isUserDeleted: false },
    _count: { _all: true },
  });

  // 2) Her klasör için ilk 3 asset (createdAt asc) + negatif sayısı.
  //    Mantık: klasör başına 3 row + count(*) aggregate. Client tarafında
  //    folder.path → coverHashes/negativeCount map'leyeceğiz.
  //
  //    NOT: 38 klasör + her biri için 3 asset query baseline'da pratik.
  //    Klasör sayısı çok büyürse (1000+) bu N+1 problem olur — V2 carry
  //    (raw SQL DISTINCT ON veya sub-query optimization).
  const folderPaths = groups.map((g) => g.folderPath);

  const [coverAssets, negativeCounts] = await Promise.all([
    db.localLibraryAsset.findMany({
      where: {
        userId: user.id,
        isUserDeleted: false,
        folderPath: { in: folderPaths },
      },
      select: { folderPath: true, hash: true, createdAt: true },
      orderBy: [{ folderPath: "asc" }, { createdAt: "asc" }],
    }),
    db.localLibraryAsset.groupBy({
      by: ["folderPath"],
      where: {
        userId: user.id,
        isUserDeleted: false,
        isNegative: true,
        folderPath: { in: folderPaths },
      },
      _count: { _all: true },
    }),
  ]);

  // Folder path → ilk 3 hash map
  const coverHashesByPath = new Map<string, string[]>();
  for (const a of coverAssets) {
    const list = coverHashesByPath.get(a.folderPath) ?? [];
    if (list.length < 3) {
      list.push(a.hash);
      coverHashesByPath.set(a.folderPath, list);
    }
  }
  const negativeByPath = new Map<string, number>(
    negativeCounts.map((n) => [n.folderPath, n._count._all]),
  );

  const folders: FolderSummary[] = groups.map((g) => ({
    name: g.folderName,
    path: g.folderPath,
    fileCount: g._count._all,
    coverHashes: coverHashesByPath.get(g.folderPath) ?? [],
    negativeCount: negativeByPath.get(g.folderPath) ?? 0,
  }));

  return NextResponse.json({ folders });
});
