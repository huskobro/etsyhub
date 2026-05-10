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

import type { Job } from "bullmq";
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
