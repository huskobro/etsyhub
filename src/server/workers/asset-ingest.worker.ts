import type { Job } from "bullmq";
import { JobStatus, SourcePlatform } from "@prisma/client";
import { db } from "@/server/db";
import { createAssetFromBuffer } from "@/features/assets/server/asset-service";
import { logger } from "@/lib/logger";

export type AssetIngestPayload = {
  jobId: string;
  userId: string;
  sourceUrl: string;
};

type FetchResult = {
  buffer: Buffer;
  mimeType: string;
  title?: string;
};

export async function handleAssetIngestFromUrl(job: Job<AssetIngestPayload>) {
  const { jobId, userId, sourceUrl } = job.data;
  await db.job.update({
    where: { id: jobId },
    data: { status: JobStatus.RUNNING, startedAt: new Date(), progress: 10 },
  });

  try {
    const image = await fetchImageFromUrl(sourceUrl);
    await db.job.update({
      where: { id: jobId },
      data: { progress: 60 },
    });

    const asset = await createAssetFromBuffer({
      userId,
      buffer: image.buffer,
      mimeType: image.mimeType,
      sourceUrl,
      sourcePlatform: detectPlatform(sourceUrl),
    });

    await db.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.SUCCESS,
        finishedAt: new Date(),
        progress: 100,
        metadata: { sourceUrl, assetId: asset.id, title: image.title ?? null },
      },
    });

    return { assetId: asset.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    logger.error({ jobId, err: message }, "asset ingest failed");
    await db.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        finishedAt: new Date(),
        error: message,
      },
    });
    throw err;
  }
}

async function fetchImageFromUrl(url: string): Promise<FetchResult> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "EtsyHub/0.1 (localhost) bookmark-preview; https://example.local",
    },
  });
  if (!res.ok) throw new Error(`Fetch başarısız: ${res.status}`);
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.startsWith("image/")) {
    const mimeType = normalizeImageMime(contentType);
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      mimeType,
    };
  }

  if (contentType.startsWith("text/html")) {
    const html = await res.text();
    const ogImage =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] ??
      html.match(
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      )?.[1];
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
    if (!ogImage) {
      throw new Error(
        "Sayfada og:image/twitter:image bulunamadı (özel parsing Phase 3+)",
      );
    }
    const absolute = new URL(ogImage, url).toString();
    const imgRes = await fetch(absolute, { redirect: "follow" });
    if (!imgRes.ok) {
      throw new Error(`og:image fetch başarısız: ${imgRes.status}`);
    }
    const imgCt = (imgRes.headers.get("content-type") ?? "image/jpeg").toLowerCase();
    return {
      buffer: Buffer.from(await imgRes.arrayBuffer()),
      mimeType: normalizeImageMime(imgCt),
      title,
    };
  }

  throw new Error(`Desteklenmeyen content-type: ${contentType}`);
}

function normalizeImageMime(ct: string): string {
  const base = ct.split(";")[0]?.trim() ?? "";
  if (base === "image/jpg") return "image/jpeg";
  return base;
}

function detectPlatform(url: string): SourcePlatform {
  if (/etsy\.com/i.test(url)) return SourcePlatform.ETSY;
  if (/amazon\./i.test(url)) return SourcePlatform.AMAZON;
  if (/pinterest\./i.test(url)) return SourcePlatform.PINTEREST;
  if (/instagram\./i.test(url)) return SourcePlatform.INSTAGRAM;
  return SourcePlatform.OTHER;
}
