// IA-33 — Local Library focus mode için orijinal asset stream endpoint.
//
// Review focus mode'da Local item için 512×512 webp thumbnail yerine
// dosyanın **orijinal/full-resolution** halini servis eder. Stage
// container `aspect-square w-full max-w-[760px]` (AI Designs ile aynı);
// orijinal 4096×4096 JPEG bu container'ı tam doldurur. Grid kart
// (160×160) thumbnail endpoint'ini kullanmaya devam eder (perf).
//
// Sözleşme:
//   • ?hash=<sha256> — user-scoped lookup.
//   • Auth: requireUser. Eksikse 401.
//   • Owner check: asset.userId == session.user.id (cross-user 404).
//   • Hidden check: isUserDeleted=false AND deletedAt=null (sızıntı YOK).
//   • Active root check: getActiveLocalRootFilter — operatör başka root'a
//     geçtiyse eski root'taki asset orijinali stream edilmez (CLAUDE.md
//     Madde V — local data isolation).
//   • Path traversal koruması: schema-zero — filePath DB'den okunur,
//     query'den derive edilmez. Operatör URL ile filePath inject edemez.
//   • Content-Type: asset.mimeType (image/jpeg, image/png, image/webp).
//   • Cache-Control: private + max-age=3600 — kullanıcıya özel.
//   • Disk read fail → 500 (gerçek hata; sızıntı yok).
//   • Soft-deleted veya thumbnail eksik durumlarda da 404 (varlık
//     sızıntısı YOK).
//
// Bu endpoint thumbnail endpoint'inin küçük versiyonudur; tek fark
// `thumbnailPath` yerine `filePath` okunur ve content-type asset
// metadata'sından gelir.

import { NextResponse } from "next/server";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { getActiveLocalRootFilter } from "@/server/services/local-library/active-root";

const QuerySchema = z.object({ hash: z.string().min(1).max(128) });

export async function GET(req: Request) {
  let user: { id: string };
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({ hash: searchParams.get("hash") });
  if (!parsed.success) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // IA-29 — active root filter zorunlu. Operatör başka root'a geçtiyse
  // eski root'taki asset orijinali bu endpoint'ten stream edilmez.
  const rootFilter = await getActiveLocalRootFilter(user.id);

  const asset = await db.localLibraryAsset.findFirst({
    where: {
      hash: parsed.data.hash,
      userId: user.id,
      isUserDeleted: false,
      deletedAt: null,
      ...rootFilter,
    },
    select: {
      filePath: true,
      mimeType: true,
    },
  });
  if (!asset || !asset.filePath) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let buf: Buffer;
  try {
    buf = await readFile(asset.filePath);
  } catch (err) {
    return NextResponse.json(
      { error: `Asset okunamadı: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
