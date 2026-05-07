// Pass 63 — Bulk export endpoint (ZIP).
//
// Sözleşme:
//   POST /api/admin/midjourney/asset/bulk-export
//   body: { midjourneyAssetIds: string[], format: "png"|"jpeg"|"webp", size?: "full"|"web" }
//   200 → application/zip stream + Content-Disposition: attachment
//   400 → invalid body
//   404 → asset id'lerden bazıları yok
//
// Source asset MinIO'dan fetch + sharp ile istenen format'a dönüştür +
// archiver ile ZIP'le. Her asset için audit log MIDJOURNEY_ASSET_EXPORT
// (size + format + bytesOut + bulkBatch flag).
//
// Filename: mj-bulk-{timestamp}.zip; içinde mj-{mjJobId|jobId}-grid{N}.{ext}.

import { NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import archiver from "archiver";
import { Readable } from "node:stream";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";
import { audit } from "@/server/audit";

const bodySchema = z.object({
  midjourneyAssetIds: z.array(z.string().min(1)).min(1).max(50),
  format: z.enum(["jpeg", "png", "webp"]).default("png"),
  size: z.enum(["full", "web"]).default("full"),
});

export const POST = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();

  const text = await req.text();
  if (!text.trim()) throw new ValidationError("Boş body");
  let parsed;
  try {
    parsed = bodySchema.safeParse(JSON.parse(text));
  } catch {
    throw new ValidationError("Geçersiz JSON");
  }
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz bulk-export body",
      parsed.error.flatten().fieldErrors,
    );
  }

  const { midjourneyAssetIds, format, size } = parsed.data;
  const assets = await db.midjourneyAsset.findMany({
    where: { id: { in: midjourneyAssetIds } },
    include: {
      asset: { select: { storageKey: true, mimeType: true } },
      midjourneyJob: { select: { id: true, mjJobId: true } },
    },
  });
  if (assets.length === 0) {
    throw new NotFoundError("Hiçbir MidjourneyAsset bulunamadı");
  }

  // Sharp dönüşümleri parallel; sonuçları topla.
  const storage = getStorage();
  const items = await Promise.all(
    assets.map(async (a) => {
      const source = await storage.download(a.asset.storageKey);
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
      switch (format) {
        case "jpeg":
          outBuffer = await pipeline.jpeg({ quality: 92 }).toBuffer();
          break;
        case "png":
          outBuffer = await pipeline.png({ compressionLevel: 6 }).toBuffer();
          break;
        case "webp":
          outBuffer = await pipeline.webp({ quality: 90 }).toBuffer();
          break;
      }
      const idTail =
        a.midjourneyJob.mjJobId?.slice(0, 8) ??
        a.midjourneyJob.id.slice(0, 8);
      const filename = `mj-${idTail}-grid${a.gridIndex}-${size}.${format}`;
      return { asset: a, buffer: outBuffer, filename };
    }),
  );

  // Audit log per-asset (bulk batch flag).
  const batchTs = Date.now();
  await Promise.all(
    items.map((it) =>
      audit({
        actor: admin.id,
        action: "MIDJOURNEY_ASSET_EXPORT",
        targetType: "MidjourneyAsset",
        targetId: it.asset.id,
        metadata: {
          format,
          size,
          sourceMime: it.asset.asset.mimeType,
          midjourneyJobId: it.asset.midjourneyJobId,
          gridIndex: it.asset.gridIndex,
          bytesOut: it.buffer.length,
          bulkBatchTs: batchTs,
          bulkBatchSize: items.length,
        },
      }),
    ),
  );

  // ZIP stream — archiver Buffer → stream → NextResponse body.
  const archive = archiver("zip", { zlib: { level: 6 } });
  for (const it of items) {
    archive.append(it.buffer, { name: it.filename });
  }
  archive.finalize();

  // archiver Node Readable → web ReadableStream
  // ts: Readable.toWeb available since node 17
  const webStream = Readable.toWeb(archive) as unknown as ReadableStream;

  const zipFilename = `mj-bulk-${batchTs}.zip`;
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFilename}"`,
      "Cache-Control": "no-store",
    },
  });
});
