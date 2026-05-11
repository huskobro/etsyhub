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
// IA-29/IA-35 — local auto-review enqueue:
//   Local scan freshly discovered, never-scored asset için
//   otomatik REVIEW_DESIGN enqueue YAPAR — yalnız asset'in folder
//   mapping'i resolved ise (path-based mapping > legacy folderName
//   fallback > convention). Mapping yoksa o asset için scan
//   auto-enqueue çalışmaz; operator review'i Settings → Review →
//   Local library altında folder'a productType atayarak veya
//   scope-trigger endpoint'i ile tetikler.
//
//   Eski tek-global `defaultProductTypeKey` modeli IA-29'da
//   kaldırıldı (27+ klasörlü kütüphanelerde adaletsiz). Phase 6
//   Karar 3 "sessiz default YASAK" kuralı korunur — productType
//   operator-chosen veya convention'a göre mapping'lenir; sahte
//   global fallback yoktur.
//
//   Already-scored guard (worker tarafında) çift-billing'i her
//   durumda engeller.

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
import { enqueueReviewDesign } from "@/server/services/review/enqueue";
import { getResolvedReviewConfig } from "@/server/services/settings/review.service";
import { resolveLocalFolder } from "@/features/settings/local-library/folder-mapping";
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
    // IA-29 — root path değiştiğinde eski path altındaki asset'leri
    // soft-delete et. Aksi halde folder-mapping endpoint eski
    // klasörleri pending olarak gösterir (UI'da yabancı path'ler).
    // Asset row'ları korunur (deletedAt set) ki re-scan ile geri
    // getirilebilsin; ama aktif görünümde gözükmezler.
    await db.localLibraryAsset.updateMany({
      where: {
        userId,
        deletedAt: null,
        isUserDeleted: false,
        folderPath: { not: { startsWith: rootFolderPath } },
      },
      data: { deletedAt: new Date() },
    });

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
            // IA-29 — rediscovery clears soft-delete. Operatör eski
            // root'a geri döndüğünde veya dosyayı kopyaladığında
            // asset DB'de "geri canlanır"; review state (score,
            // suggestion, operatör damgası) hash unique key sayesinde
            // ZATEN korunur, sadece silinme bayrağını sıfırlıyoruz.
            deletedAt: null,
            isUserDeleted: false,
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

    // IA-29 (CLAUDE.md Madde V) — folder bazlı productType mapping.
    // Global default YOK. Operatör her klasör için açık seçim yapar
    // (productType atar veya `__ignore__`'a alır). Mapping yoksa
    // klasördeki asset'ler "pending mapping" sayılır; auto-enqueue
    // tetiklenmez. UI bu klasörleri listeler.
    // IA-29 (CLAUDE.md Madde V) — Convention-based folder model.
    // Operatör root altında productType klasörleri açar
    // (`clipart/`, `wall_art/`, ...). Scan worker asset'in immediate
    // parent folder adına bakar; bilinen productType ise auto-enqueue.
    // Bilinmeyen klasör (örn. `ekmek/`) → pending, operatör UI'da
    // ya bilinen bir klasöre taşır ya alias yazar ya ignore eder.
    // IA-39 (CLAUDE.md Madde U) — localAutoEnqueue toggle.
    // Admin panel'inde Settings → Review → Automation altında görünür.
    // Disabled ise scan başarılı tamamlanır ama hiçbir asset enqueue edilmez.
    const reviewConfig = await getResolvedReviewConfig(userId);
    if (!reviewConfig.automation.localAutoEnqueue) {
      logger.info(
        { userId, jobId },
        "local scan auto-enqueue skipped: localAutoEnqueue disabled in Settings → Review",
      );
      await db.job.update({
        where: { id: jobId },
        data: {
          status: "SUCCESS",
          progress: 100,
          finishedAt: new Date(),
          metadata: skippedFiles.length > 0 ? { skippedFiles } : {},
        },
      });
      return;
    }

    const settings = await getUserLocalLibrarySettings(userId);
    const folderMap = settings.folderProductTypeMap ?? {};
    const pendingAssets = await db.localLibraryAsset.findMany({
      where: {
        userId,
        deletedAt: null,
        isUserDeleted: false,
        reviewProviderSnapshot: null, // never-scored
      },
      // IA-35 — folderPath path-based mapping resolve için gerekli.
      select: { id: true, folderName: true, folderPath: true },
      take: 500,
    });
    let autoEnqueued = 0;
    let skippedNoMapping = 0;
    let skippedIgnored = 0;
    for (const a of pendingAssets) {
      const r = resolveLocalFolder({
        folderName: a.folderName,
        folderPath: a.folderPath,
        folderMap,
      });
      if (r.kind === "pending") { skippedNoMapping += 1; continue; }
      if (r.kind === "ignored") { skippedIgnored += 1; continue; }
      try {
        await enqueueReviewDesign({
          userId,
          payload: {
            scope: "local",
            localAssetId: a.id,
            productTypeKey: r.productTypeKey,
          },
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
      { userId, jobId, autoEnqueued, skippedNoMapping, skippedIgnored },
      "local scan auto-enqueue summary",
    );

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
