// Local Library — thumbnail stream endpoint (Phase 5 Gap B).
//
// Sözleşme:
//   - ?hash=<hash> ile owner asset'inin thumbnail dosyasını stream eder.
//   - Cross-user / missing hash / thumbnailPath null / disk read fail durumları
//     için varlık sızıntısı YOK: 404 (404'le 500'ü ayırırız; disk fail → 500).
//   - Content-Type image/webp (thumbnail.service .webp üretir).
//   - Cache-Control private + max-age=3600 — kullanıcıya özel.

import { NextResponse } from "next/server";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";

const QuerySchema = z.object({ hash: z.string().min(1) });

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

  const asset = await db.localLibraryAsset.findFirst({
    where: {
      hash: parsed.data.hash,
      userId: user.id,
      isUserDeleted: false,
    },
  });
  if (!asset || !asset.thumbnailPath) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let buf: Buffer;
  try {
    buf = await readFile(asset.thumbnailPath);
  } catch (err) {
    return NextResponse.json(
      { error: `Thumbnail okunamadı: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
