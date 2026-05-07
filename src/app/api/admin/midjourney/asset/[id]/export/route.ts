// Pass 62 — MidjourneyAsset export endpoint.
//
// Sözleşme:
//   GET /api/admin/midjourney/asset/[id]/export?format=jpeg|png|webp&size=full|web
//   200 → image/<format> stream + Content-Disposition: attachment
//   404 → asset yok
//   400 → invalid format/size
//
// Source asset MinIO'da canonical formatta saklı (Pass 62 ingest sonrası
// PNG; eski Pass 49-61 ingest webp). Sharp ile istenen format'a dönüştür.
//
// Format tradeoff:
//   • jpeg: ~200KB, lossy, Etsy listing default, en iyi uyumluluk
//   • png:  ~1MB,  lossless, baskı/clipart default, transparent destek
//   • webp: ~200KB, modern web, MJ kaynak format
//
// Size:
//   • full: orijinal boyut (1024×1024 native)
//   • web:  uzun kenarı 1024 (zaten yakın olduğu için no-op çoğunlukla)

import { NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";
import { audit } from "@/server/audit";

const querySchema = z.object({
  format: z.enum(["jpeg", "png", "webp"]).default("png"),
  size: z.enum(["full", "web"]).default("full"),
});

type Ctx = { params: { id: string } };

export const GET = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz export query",
      parsed.error.flatten().fieldErrors,
    );
  }

  // MidjourneyAsset → Asset (MinIO storage key)
  const mjAsset = await db.midjourneyAsset.findUnique({
    where: { id: ctx.params.id },
    select: {
      id: true,
      gridIndex: true,
      variantKind: true,
      midjourneyJobId: true,
      asset: { select: { storageKey: true, mimeType: true } },
      midjourneyJob: { select: { id: true, mjJobId: true, prompt: true } },
    },
  });
  if (!mjAsset) {
    throw new NotFoundError("MidjourneyAsset bulunamadı");
  }

  // Storage'dan source bytes
  const storage = getStorage();
  const source = await storage.download(mjAsset.asset.storageKey);

  // Sharp dönüşümü
  const { format, size } = parsed.data;
  let pipeline = sharp(source);
  if (size === "web") {
    pipeline = pipeline.resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  let outBuffer: Buffer;
  let mime: string;
  switch (format) {
    case "jpeg":
      outBuffer = await pipeline.jpeg({ quality: 92 }).toBuffer();
      mime = "image/jpeg";
      break;
    case "png":
      outBuffer = await pipeline.png({ compressionLevel: 6 }).toBuffer();
      mime = "image/png";
      break;
    case "webp":
      outBuffer = await pipeline.webp({ quality: 90 }).toBuffer();
      mime = "image/webp";
      break;
  }

  // Audit
  await audit({
    actor: admin.id,
    action: "MIDJOURNEY_ASSET_EXPORT",
    targetType: "MidjourneyAsset",
    targetId: mjAsset.id,
    metadata: {
      format,
      size,
      sourceMime: mjAsset.asset.mimeType,
      midjourneyJobId: mjAsset.midjourneyJobId,
      gridIndex: mjAsset.gridIndex,
      bytesOut: outBuffer.length,
    },
  });

  // Filename: mj-{mjJobId|jobId}-grid{N}.{ext}
  const idTail =
    mjAsset.midjourneyJob.mjJobId?.slice(0, 8) ??
    mjAsset.midjourneyJob.id.slice(0, 8);
  const filename = `mj-${idTail}-grid${mjAsset.gridIndex}-${size}.${format}`;

  return new NextResponse(outBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(outBuffer.length),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});
