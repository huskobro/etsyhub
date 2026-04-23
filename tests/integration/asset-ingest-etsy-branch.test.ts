import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Job } from "bullmq";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import {
  JobStatus,
  JobType,
  SourcePlatform,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import { ensureBucket } from "@/providers/storage/init";
import {
  handleAssetIngestFromUrl,
  type AssetIngestPayload,
} from "@/server/workers/asset-ingest.worker";

/**
 * Task 12 — asset-ingest.worker.ts Etsy/Amazon parser branch testleri.
 *
 * Mock stratejisi: `vi.spyOn(global, "fetch")` ile HTTP çağrıları mock'lanır.
 * - Etsy/Amazon URL'de worker 2 fetch yapar:
 *   1) HTML fetch (listing sayfası)
 *   2) Parse edilen imageUrls[0] fetch (PNG buffer)
 * - Generic (og:image fallback) yolda da aynı 2 fetch (HTML sayfası → og:image)
 *   veya tek fetch (direkt image URL) olabilir.
 *
 * Parser başarısız olursa (low confidence) throw edilmemeli — eski generic
 * og:image yoluna düşülmeli (kullanıcı düzeltmesi #8).
 */

type FetchImpl = (...args: Parameters<typeof fetch>) => Promise<Response>;

async function pngBuffer(
  width = 8,
  height = 8,
  r = 200,
  g = 100,
  b = 50,
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r, g, b } },
  })
    .png()
    .toBuffer();
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function pngResponse(buffer: Buffer): Response {
  return new Response(buffer, {
    status: 200,
    headers: { "content-type": "image/png" },
  });
}

function buildJob(data: AssetIngestPayload): Job<AssetIngestPayload> {
  return { data } as Job<AssetIngestPayload>;
}

describe("ASSET_INGEST_FROM_URL — Etsy/Amazon parser branch", () => {
  let userId: string;
  const originalFetch = global.fetch;
  let fetchSpy: ReturnType<typeof vi.fn<FetchImpl>>;

  beforeAll(async () => {
    await ensureBucket();
    const user = await db.user.upsert({
      where: { email: "asset-ingest-etsy@etsyhub.local" },
      create: {
        email: "asset-ingest-etsy@etsyhub.local",
        passwordHash: await bcrypt.hash("password-test", 10),
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
      update: {},
    });
    userId = user.id;
  });

  beforeEach(async () => {
    await db.job.deleteMany({
      where: { userId, type: JobType.ASSET_INGEST_FROM_URL },
    });
    fetchSpy = vi.fn<FetchImpl>();
    global.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterAll(async () => {
    await db.job.deleteMany({
      where: { userId, type: JobType.ASSET_INGEST_FROM_URL },
    });
    global.fetch = originalFetch;
  });

  it("Etsy URL — JSON-LD parser zengin metadata verir, Asset oluşur, Job.metadata parse bilgileri içerir", async () => {
    const etsyHtml = await readFile(
      resolve(__dirname, "../fixtures/etsy-listing.html"),
      "utf8",
    );
    const imageBuf = await pngBuffer(8, 8, 10, 20, 30);

    fetchSpy.mockImplementation(async (input: unknown) => {
      const url = input instanceof URL ? input.toString() : String(input);
      if (url.includes("etsy.com/listing")) {
        return htmlResponse(etsyHtml);
      }
      if (url.includes("i.etsystatic.com")) {
        return pngResponse(imageBuf);
      }
      return new Response("not found", { status: 404 });
    });

    const job = await db.job.create({
      data: {
        userId,
        type: JobType.ASSET_INGEST_FROM_URL,
        metadata: {
          sourceUrl: "https://www.etsy.com/listing/1234567890/minimalist-wall-art",
        },
      },
    });

    const result = await handleAssetIngestFromUrl(
      buildJob({
        jobId: job.id,
        userId,
        sourceUrl: "https://www.etsy.com/listing/1234567890/minimalist-wall-art",
      }),
    );

    expect(result.assetId).toBeTruthy();

    const asset = await db.asset.findUnique({ where: { id: result.assetId } });
    expect(asset).not.toBeNull();
    expect(asset?.sourcePlatform).toBe(SourcePlatform.ETSY);
    expect(asset?.mimeType).toBe("image/png");

    const finalJob = await db.job.findUnique({ where: { id: job.id } });
    expect(finalJob?.status).toBe(JobStatus.SUCCESS);
    const meta = finalJob?.metadata as Record<string, unknown> | null;
    expect(meta).not.toBeNull();
    expect(meta?.["title"]).toBe("Minimalist Wall Art Print");
    expect(meta?.["externalId"]).toBe("1234567890");
    expect(meta?.["parserSource"]).toBe("json-ld");
    expect(typeof meta?.["parserConfidence"]).toBe("number");
    expect((meta?.["parserConfidence"] as number) >= 80).toBe(true);
    expect(meta?.["priceCents"]).toBe(2499);
    expect(meta?.["reviewCount"]).toBe(142);
  });

  it("Etsy URL — parser low confidence (bozuk HTML, og:image yok) → generic fallback da fail → anlaşılır Türkçe hata", async () => {
    const brokenHtml = "<html><head><title>Boş</title></head><body></body></html>";

    fetchSpy.mockImplementation(async (input: unknown) => {
      const url = input instanceof URL ? input.toString() : String(input);
      if (url.includes("etsy.com/listing")) {
        return htmlResponse(brokenHtml);
      }
      return new Response("not found", { status: 404 });
    });

    const job = await db.job.create({
      data: {
        userId,
        type: JobType.ASSET_INGEST_FROM_URL,
        metadata: {
          sourceUrl: "https://www.etsy.com/listing/999/broken",
        },
      },
    });

    await expect(
      handleAssetIngestFromUrl(
        buildJob({
          jobId: job.id,
          userId,
          sourceUrl: "https://www.etsy.com/listing/999/broken",
        }),
      ),
    ).rejects.toThrow();

    const finalJob = await db.job.findUnique({ where: { id: job.id } });
    expect(finalJob?.status).toBe(JobStatus.FAILED);
    expect(finalJob?.error).toBeTruthy();
    // Türkçe hata — generic fallback çalıştı, o da başarısız oldu
    expect(finalJob?.error ?? "").toMatch(/og:image|bulunamadı|başarısız/i);
  });

  it("Etsy URL — parser low confidence ama sayfada og:image var → generic fallback DEVREYE GİRER, Asset oluşur", async () => {
    // JSON-LD yok, sadece og:image ve og:title — parser düşük confidence verir,
    // fallback og:image yolu Asset oluşturmalı.
    const htmlWithOgOnly = `<html>
<head>
<meta property="og:image" content="https://i.etsystatic.com/fallback/il_fb.jpg">
<title>Fallback Title</title>
</head>
<body></body>
</html>`;
    const imageBuf = await pngBuffer(16, 16);

    fetchSpy.mockImplementation(async (input: unknown) => {
      const url = input instanceof URL ? input.toString() : String(input);
      if (url.includes("etsy.com/listing")) {
        return htmlResponse(htmlWithOgOnly);
      }
      if (url.includes("etsystatic.com/fallback")) {
        return pngResponse(imageBuf);
      }
      return new Response("not found", { status: 404 });
    });

    const job = await db.job.create({
      data: {
        userId,
        type: JobType.ASSET_INGEST_FROM_URL,
        metadata: {
          sourceUrl: "https://www.etsy.com/listing/777/og-only",
        },
      },
    });

    const result = await handleAssetIngestFromUrl(
      buildJob({
        jobId: job.id,
        userId,
        sourceUrl: "https://www.etsy.com/listing/777/og-only",
      }),
    );

    expect(result.assetId).toBeTruthy();
    const finalJob = await db.job.findUnique({ where: { id: job.id } });
    expect(finalJob?.status).toBe(JobStatus.SUCCESS);

    const asset = await db.asset.findUnique({ where: { id: result.assetId } });
    expect(asset?.sourcePlatform).toBe(SourcePlatform.ETSY);
  });

  it("Amazon URL — parser branch imageUrls üzerinden Asset oluşturur, externalId ASIN olur", async () => {
    const amazonHtml = await readFile(
      resolve(__dirname, "../fixtures/amazon-listing.html"),
      "utf8",
    );
    const imageBuf = await pngBuffer(8, 8, 40, 80, 120);

    fetchSpy.mockImplementation(async (input: unknown) => {
      const url = input instanceof URL ? input.toString() : String(input);
      if (url.includes("amazon.com/dp/")) {
        return htmlResponse(amazonHtml);
      }
      if (url.includes("m.media-amazon.com")) {
        return pngResponse(imageBuf);
      }
      return new Response("not found", { status: 404 });
    });

    const job = await db.job.create({
      data: {
        userId,
        type: JobType.ASSET_INGEST_FROM_URL,
        metadata: {
          sourceUrl: "https://www.amazon.com/dp/B0ABCDEFGH/boho-canvas",
        },
      },
    });

    const result = await handleAssetIngestFromUrl(
      buildJob({
        jobId: job.id,
        userId,
        sourceUrl: "https://www.amazon.com/dp/B0ABCDEFGH/boho-canvas",
      }),
    );

    expect(result.assetId).toBeTruthy();
    const asset = await db.asset.findUnique({ where: { id: result.assetId } });
    expect(asset?.sourcePlatform).toBe(SourcePlatform.AMAZON);

    const finalJob = await db.job.findUnique({ where: { id: job.id } });
    const meta = finalJob?.metadata as Record<string, unknown> | null;
    expect(meta?.["externalId"]).toBe("B0ABCDEFGH");
    expect(meta?.["title"]).toBe("Boho Wall Art Canvas Print");
    expect(meta?.["reviewCount"]).toBe(1234);
  });

  it("Direkt image URL — eski generic davranış korunur (regression)", async () => {
    const imageBuf = await pngBuffer(4, 4);

    fetchSpy.mockImplementation(async () => pngResponse(imageBuf));

    const job = await db.job.create({
      data: {
        userId,
        type: JobType.ASSET_INGEST_FROM_URL,
        metadata: { sourceUrl: "https://cdn.example.com/direct.png" },
      },
    });

    const result = await handleAssetIngestFromUrl(
      buildJob({
        jobId: job.id,
        userId,
        sourceUrl: "https://cdn.example.com/direct.png",
      }),
    );

    expect(result.assetId).toBeTruthy();
    const asset = await db.asset.findUnique({ where: { id: result.assetId } });
    expect(asset?.sourcePlatform).toBe(SourcePlatform.OTHER);

    const finalJob = await db.job.findUnique({ where: { id: job.id } });
    expect(finalJob?.status).toBe(JobStatus.SUCCESS);
    // Generic yolda externalId / parserSource metadata yazılmaz
    const meta = finalJob?.metadata as Record<string, unknown> | null;
    expect(meta?.["parserSource"]).toBeUndefined();
    expect(meta?.["externalId"]).toBeUndefined();
  });
});
