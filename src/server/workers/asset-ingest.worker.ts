import type { Job } from "bullmq";
import { JobStatus, SourcePlatform } from "@prisma/client";
import { db } from "@/server/db";
import { createAssetFromBuffer } from "@/features/assets/server/asset-service";
import { logger } from "@/lib/logger";
import { parseEtsyListing } from "@/providers/scraper/parsers/etsy-parser";
import { parseAmazonListing } from "@/providers/scraper/parsers/amazon-parser";
import type { ScrapedListing } from "@/providers/scraper/types";

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

type ParserExtras = {
  title: string;
  externalId: string;
  priceCents: number | null;
  reviewCount: number;
  parserSource: string;
  parserConfidence: number;
};

// Etsy/Amazon parser branch confidence eşiği — altına düşersek generic
// og:image yoluna fallback yaparız (kullanıcı düzeltmesi #8).
const PARSER_CONFIDENCE_THRESHOLD = 30;

const USER_AGENT =
  "Kivasy/0.1 (localhost) bookmark-preview; https://example.local";

export async function handleAssetIngestFromUrl(job: Job<AssetIngestPayload>) {
  const { jobId, userId, sourceUrl } = job.data;
  await db.job.update({
    where: { id: jobId },
    data: { status: JobStatus.RUNNING, startedAt: new Date(), progress: 10 },
  });

  try {
    // 1) Etsy/Amazon URL ise parser branch denenir; başarısızsa generic
    //    og:image fallback'e düşülür (throw edilmez).
    const parsed = await tryParserBranch(sourceUrl);

    let image: FetchResult;
    let parserExtras: ParserExtras | undefined;

    if (parsed) {
      image = parsed.image;
      parserExtras = parsed.extras;
    } else {
      image = await fetchImageFromUrl(sourceUrl);
    }

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

    // Job.metadata'ya asset + (varsa) parser extras yaz. Gelecekteki
    // bookmark/reference flow externalId, title, parserConfidence'ı okuyacak.
    await db.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.SUCCESS,
        finishedAt: new Date(),
        progress: 100,
        metadata: parserExtras
          ? {
              sourceUrl,
              assetId: asset.id,
              title: parserExtras.title,
              externalId: parserExtras.externalId,
              priceCents: parserExtras.priceCents,
              reviewCount: parserExtras.reviewCount,
              parserSource: parserExtras.parserSource,
              parserConfidence: parserExtras.parserConfidence,
            }
          : {
              sourceUrl,
              assetId: asset.id,
              title: image.title ?? null,
            },
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

/**
 * Etsy/Amazon URL için parser branch'ini dener.
 * - HTML fetch edilir, ilgili parser çağrılır
 * - parserConfidence >= eşik ve imageUrls mevcutsa görsel fetch + extras döner
 * - herhangi bir adımda hata veya low-confidence → null döner (caller generic
 *   og:image fallback'e düşer; fail fast değil, zenginleştirme niyetli)
 */
async function tryParserBranch(
  sourceUrl: string,
): Promise<{ image: FetchResult; extras: ParserExtras } | null> {
  const kind = detectParserKind(sourceUrl);
  if (!kind) return null;

  try {
    const htmlRes = await fetch(sourceUrl, {
      redirect: "follow",
      headers: { "user-agent": USER_AGENT },
    });
    if (!htmlRes.ok) {
      logger.warn(
        { sourceUrl, status: htmlRes.status, kind },
        "parser branch HTML fetch başarısız, generic fallback",
      );
      return null;
    }
    const contentType = (htmlRes.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("text/html")) {
      return null;
    }
    const html = await htmlRes.text();
    const listing: ScrapedListing =
      kind === "etsy"
        ? parseEtsyListing(html, sourceUrl)
        : parseAmazonListing(html, sourceUrl);

    if (listing.parserConfidence < PARSER_CONFIDENCE_THRESHOLD) {
      logger.warn(
        {
          sourceUrl,
          kind,
          confidence: listing.parserConfidence,
          warnings: listing.parseWarnings,
        },
        "parser branch low confidence, generic fallback",
      );
      return null;
    }

    const imageUrl = listing.imageUrls[0] ?? listing.thumbnailUrl;
    if (!imageUrl) {
      logger.warn(
        { sourceUrl, kind },
        "parser branch görsel URL yok, generic fallback",
      );
      return null;
    }

    const absolute = new URL(imageUrl, sourceUrl).toString();
    const imgRes = await fetch(absolute, {
      redirect: "follow",
      headers: { "user-agent": USER_AGENT },
    });
    if (!imgRes.ok) {
      logger.warn(
        { sourceUrl, imageUrl: absolute, status: imgRes.status, kind },
        "parser branch görsel fetch başarısız, generic fallback",
      );
      return null;
    }
    const imgCt = (imgRes.headers.get("content-type") ?? "image/jpeg").toLowerCase();
    return {
      image: {
        buffer: Buffer.from(await imgRes.arrayBuffer()),
        mimeType: normalizeImageMime(imgCt),
        title: listing.title,
      },
      extras: {
        title: listing.title,
        externalId: listing.externalId,
        priceCents: listing.priceCents,
        reviewCount: listing.reviewCount,
        parserSource: listing.parserSource,
        parserConfidence: listing.parserConfidence,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "bilinmeyen";
    logger.warn(
      { sourceUrl, kind, err: message },
      "parser branch hata aldı, generic fallback",
    );
    return null;
  }
}

function detectParserKind(url: string): "etsy" | "amazon" | null {
  if (/etsy\.com\/listing\//i.test(url)) return "etsy";
  if (/amazon\.(com|de|co\.uk|fr|es|it|co\.jp|ca)\//i.test(url)) return "amazon";
  return null;
}

async function fetchImageFromUrl(url: string): Promise<FetchResult> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT },
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
