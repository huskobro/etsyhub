// SCAN_LOCAL_FOLDER Worker — Phase 5 §3.2, §3.3.
//
// Sözleşme:
//   - LocalLibraryAsset upsert by (userId, hash) — dedupe
//   - Q2: yalnız root + first-level (Task 6 service garantisi)
//   - Bozuk dosya batch'i çökertmez: structured failure +
//     job.metadata.skippedFiles[] kaydedilir, batch SUCCESS olarak biter
//   - Job.error YALNIZ batch-level hatalarda (örn. root path yok); skip
//     ettiğimiz dosyalar Job.error'a girmez — skippedFiles ayrı sinyal
//   - Progress: total = baştaki candidate file sayısı; skipped dahil ilerler
//
// Phase 6 carry-forward:
//   - Auto-cleanup (diskten silinmiş asset'leri deletedAt set etme)
//   - Retry policy / exponential backoff (şu an bullmq default)
//   - Watch folder / fs events
//
// IA Phase 26 — local auto-review enqueue:
//   Local scan freshly discovered, never-scored asset için
//   otomatik REVIEW_DESIGN enqueue YAPAR — yalnız operator
//   `localLibrary.defaultProductTypeKey` settings'te explicit bir
//   değer seçtiyse. Bu Phase 6 Karar 3 "sessiz default YASAK"
//   kuralını ihlal etmez (productType operator-chosen).
//
//   defaultProductTypeKey null ise scan auto-enqueue çalışmaz;
//   operator review'i scope-trigger endpoint'i veya focus mode
//   Enqueue CTA üzerinden tetikler. Already-scored guard
//   (worker tarafında) çift-billing'i her durumda engeller.

import type { Job } from "bullmq";
import { JobType } from "@prisma/client";
import { db } from "@/server/db";
import {
  discoverFolders,
  listAssetFilesInFolder,
  readAssetMetadata,
  type AssetFile,
  type AssetMetadata,
} from "@/features/variation-generation/services/local-library.service";
import { ensureThumbnail } from "@/features/variation-generation/services/thumbnail.service";
import { computeQualityScore } from "@/features/variation-generation/services/quality-score.service";
import { getUserLocalLibrarySettings } from "@/features/settings/local-library/service";
import { enqueue } from "@/server/queue";
import { logger } from "@/lib/logger";

export type ScanLocalFolderPayload = {
  jobId: string;
  userId: string;
  rootFolderPath: string;
  targetResolution: { width: number; height: number };
  targetDpi: number;
};

type SkippedFile = { fileName: string; reason: string };

type ReadResult =
  | { ok: true; meta: AssetMetadata }
  | { ok: false; fileName: string; reason: string };

async function safeReadAsset(file: AssetFile): Promise<ReadResult> {
  try {
    return { ok: true, meta: await readAssetMetadata(file) };
  } catch (err) {
    return {
      ok: false,
      fileName: file.fileName,
      reason: err instanceof Error ? err.message : "metadata read failed",
    };
  }
}

export async function handleScanLocalFolder(job: Job<ScanLocalFolderPayload>): Promise<void> {
  const { jobId, userId, rootFolderPath, targetResolution, targetDpi } = job.data;

  await db.job.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date(), progress: 0 },
  });

  try {
    const folders = await discoverFolders(rootFolderPath);

    // Önce tüm aday dosyaları topla — total processed/total hesabı için baştan netleşir.
    type Candidate = { folder: { name: string; path: string }; file: AssetFile };
    const candidates: Candidate[] = [];
    for (const folder of folders) {
      const files = await listAssetFilesInFolder(folder.path);
      for (const f of files) candidates.push({ folder, file: f });
    }
    const total = candidates.length;
    const skippedFiles: SkippedFile[] = [];
    let processed = 0;

    for (const { folder, file } of candidates) {
      const read = await safeReadAsset(file);
      if (!read.ok) {
        skippedFiles.push({ fileName: read.fileName, reason: read.reason });
      } else {
        const meta = read.meta;
        const score = computeQualityScore({
          dpi: meta.dpi,
          width: meta.width,
          height: meta.height,
          target: targetResolution,
          targetDpi,
        });
        const thumb = await ensureThumbnail(meta.hash, meta.filePath);

        await db.localLibraryAsset.upsert({
          where: { userId_hash: { userId, hash: meta.hash } },
          update: {
            folderName: folder.name,
            folderPath: folder.path,
            fileName: meta.fileName,
            filePath: meta.filePath,
            mimeType: meta.mimeType,
            fileSize: meta.fileSize,
            width: meta.width,
            height: meta.height,
            dpi: meta.dpi,
            // IA Phase 11 — persist true Sharp alpha probe; review
            // focus rail surfaces "Yes / No" instead of format hint.
            hasAlpha: meta.hasAlpha,
            thumbnailPath: thumb,
            qualityScore: score.score,
            qualityReasons: score.reasons,
          },
          create: {
            userId,
            folderName: folder.name,
            folderPath: folder.path,
            fileName: meta.fileName,
            filePath: meta.filePath,
            hash: meta.hash,
            mimeType: meta.mimeType,
            fileSize: meta.fileSize,
            width: meta.width,
            height: meta.height,
            dpi: meta.dpi,
            hasAlpha: meta.hasAlpha,
            thumbnailPath: thumb,
            qualityScore: score.score,
            qualityReasons: score.reasons,
          },
        });
      }

      processed += 1;
      if (total > 0) {
        await db.job.update({
          where: { id: jobId },
          data: { progress: Math.round((processed / total) * 100) },
        });
      }
    }

    // IA Phase 26 — auto-enqueue REVIEW_DESIGN for freshly
    // discovered, never-scored local assets (CLAUDE.md Madde N+).
    // Runs only when the operator has chosen a defaultProductTypeKey
    // in Settings → Local library. Already-scored guard at the
    // worker side guarantees we never double-bill, but we filter
    // here as well to keep enqueue traffic clean.
    const settings = await getUserLocalLibrarySettings(userId);
    const productTypeKey = settings.defaultProductTypeKey;
    let autoEnqueued = 0;
    if (productTypeKey) {
      const pendingAssets = await db.localLibraryAsset.findMany({
        where: {
          userId,
          deletedAt: null,
          isUserDeleted: false,
          reviewProviderSnapshot: null, // never-scored
        },
        select: { id: true },
        take: 200,
      });
      for (const a of pendingAssets) {
        try {
          await enqueue(JobType.REVIEW_DESIGN, {
            scope: "local" as const,
            localAssetId: a.id,
            userId,
            productTypeKey,
          });
          autoEnqueued += 1;
        } catch (err) {
          logger.error(
            {
              assetId: a.id,
              userId,
              err: err instanceof Error ? err.message : String(err),
            },
            "scan auto-enqueue: REVIEW_DESIGN enqueue failed",
          );
        }
      }
      logger.info(
        { userId, jobId, autoEnqueued, productTypeKey },
        "local scan auto-enqueue summary",
      );
    }

    await db.job.update({
      where: { id: jobId },
      data: {
        status: "SUCCESS",
        progress: 100,
        finishedAt: new Date(),
        metadata: skippedFiles.length > 0 ? { skippedFiles } : {},
      },
    });
  } catch (err) {
    await db.job.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : "scan failed",
        finishedAt: new Date(),
      },
    });
    throw err;
  }
}
