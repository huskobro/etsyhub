// Phase 7 Task 12 — Selection export worker (BullMQ).
//
// Sözleşme (plan Task 12, design Section 6.5):
//   - JobType: EXPORT_SELECTION_SET (Phase 7 yeni enum value).
//   - Async pipeline: ownership → set+items+assets fetch → asset stream-download
//     → ZIP üret (Task 11 reuse) → storage upload → set.lastExportedAt = now()
//     → return.
//   - Set status DEĞİŞMEZ (draft veya ready'de export edilebilir).
//
// Pipeline:
//   1. Payload validate (zod)
//   2. requireSetOwnership (cross-user / yok → NotFoundError)
//   3. Set + items + assets fetch (single Prisma query, position asc)
//   4. Boş set guard → throw "Boş set export edilemez"
//   5. Asset buffer download (storage.download her item için sıralı)
//   6. Filename: images/var-NNN.png + (edited varsa) originals/var-NNN.png
//   7. Manifest build (Task 11 buildManifest)
//   8. ZIP build (Task 11 buildZip)
//   9. ZIP storage upload — key: exports/{userId}/{setId}/{jobId}.zip
//  10. DB update — lastExportedAt = new Date() (YALNIZ completed anında)
//  11. Return { storageKey, jobId }
//
// Failure path:
//   - Herhangi bir adım throw → BullMQ FAILED state.
//   - lastExportedAt SET EDİLMEZ (set metadata kirlenmez).
//   - Storage cleanup: ZIP upload başarılı olduktan sonra DB update fail
//     ederse partial upload orphan kalmasın diye explicit `storage.delete`
//     (best-effort, error suppress).
//
// BullMQ retry policy:
//   - bootstrap.ts default: attempts=1 (Phase 6 paterniyle aynı — blanket
//     retry policy YOK). Manuel retry user tarafından (Task 22 export route).
//
// Phase 6 emsal: `src/server/workers/review-design.worker.ts` — tek worker,
// ownership doğrulama, persist invariant'ları.

import type { Job } from "bullmq";
import { z } from "zod";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { getStorage } from "@/providers/storage";
import { requireSetOwnership } from "@/server/services/selection/authz";
import { buildManifest } from "@/server/services/selection/export/manifest";
import { buildZip } from "@/server/services/selection/export/zip-builder";

// ────────────────────────────────────────────────────────────
// Job payload sözleşmesi
// ────────────────────────────────────────────────────────────

/**
 * EXPORT_SELECTION_SET job payload.
 *
 * Section 6.5: minimal — userId + setId. Worker handler içinde owned set
 * fetch'i tek query'de items + assets + designs + reviews ile gelir.
 */
export type ExportSelectionSetJobPayload = {
  userId: string;
  setId: string;
};

const PayloadSchema = z.object({
  userId: z.string().min(1),
  setId: z.string().min(1),
});

export type SelectionExportJobResult = {
  storageKey: string;
  jobId: string;
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/**
 * Position-based dosya adı: position+1 → 3 hane padded ("001", "002", ...).
 *
 * Position 0'dan başlar (DB invariant'ı — items.service); kullanıcıya
 * gösterilen dosya adı 1'den başlar (insanca okunabilir).
 */
function paddedIndex(zeroBasedIdx: number): string {
  return String(zeroBasedIdx + 1).padStart(3, "0");
}

// ────────────────────────────────────────────────────────────
// Worker handler
// ────────────────────────────────────────────────────────────

/**
 * BullMQ worker handler — selection set ZIP export'u üretir, storage'a
 * upload eder, DB'de lastExportedAt'i (YALNIZ completed anında) günceller.
 *
 * Failure path'te lastExportedAt değişmez; partial upload best-effort
 * temizlenir.
 */
export async function handleSelectionExport(
  job: Job<ExportSelectionSetJobPayload>,
): Promise<SelectionExportJobResult> {
  // 1) Payload validate
  const { userId, setId } = PayloadSchema.parse(job.data);

  // BullMQ job.id Optional<string> tipindedir; boşsa fail (defensive — runtime'da
  // BullMQ daima id atar; null sadece test mock'unda olur).
  const jobId = job.id;
  if (!jobId) {
    throw new Error("BullMQ job.id yok — export pipeline başlatılamaz");
  }

  // 2) Ownership (cross-user / yok → NotFoundError)
  await requireSetOwnership({ userId, setId });

  // 3) Set + items + assets fetch (tek query)
  const set = await db.selectionSet.findUniqueOrThrow({
    where: { id: setId },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          sourceAsset: true,
          editedAsset: true,
          generatedDesign: { include: { review: true } },
        },
      },
    },
  });

  // 4) Boş set guard
  if (set.items.length === 0) {
    throw new Error("Boş set export edilemez");
  }

  // 5) Asset buffer download (sıralı — Phase 7 v1 in-memory; streaming-to-disk
  //    fast-path Phase 8'e ertelendi: carry-forward `selection-studio-export-fast-path`)
  const storage = getStorage();
  const itemBuffers: Array<{
    sourceBuf: Buffer;
    editedBuf: Buffer | null;
  }> = [];
  for (const item of set.items) {
    const sourceBuf = await storage.download(item.sourceAsset.storageKey);
    const editedBuf = item.editedAsset
      ? await storage.download(item.editedAsset.storageKey)
      : null;
    itemBuffers.push({ sourceBuf, editedBuf });
  }

  // 6+7) Manifest build (filename'ler caller'da üretilir)
  const manifestItems = set.items.map((item, idx) => {
    const fileIdx = paddedIndex(idx);
    return {
      item,
      sourceAsset: item.sourceAsset,
      editedAsset: item.editedAsset,
      generatedDesign: item.generatedDesign,
      designReview: item.generatedDesign?.review ?? null,
      imageFilename: `images/var-${fileIdx}.png`,
      originalFilename: item.editedAsset
        ? `originals/var-${fileIdx}.png`
        : null,
    };
  });

  const manifest = buildManifest({
    set,
    items: manifestItems,
    exportedAt: new Date(),
    exportedBy: { userId },
  });

  // 8) ZIP build
  const images = set.items.map((_item, idx) => {
    const buf = itemBuffers[idx]!;
    const fileIdx = paddedIndex(idx);
    // Aktif görüntü: editedBuf varsa o, yoksa source.
    return {
      filename: `images/var-${fileIdx}.png`,
      buffer: buf.editedBuf ?? buf.sourceBuf,
    };
  });
  const originals = set.items
    .map((_item, idx) => {
      const buf = itemBuffers[idx]!;
      if (!buf.editedBuf) return null;
      const fileIdx = paddedIndex(idx);
      // Edit yapılmışsa originals/ klasörüne SOURCE buffer gider.
      return {
        filename: `originals/var-${fileIdx}.png`,
        buffer: buf.sourceBuf,
      };
    })
    .filter((x): x is { filename: string; buffer: Buffer } => x !== null);

  const zipBuf = await buildZip({ manifest, images, originals });

  // 9) ZIP storage upload
  const storageKey = `exports/${userId}/${setId}/${jobId}.zip`;
  let uploaded = false;
  try {
    await storage.upload(storageKey, zipBuf, {
      contentType: "application/zip",
    });
    uploaded = true;

    // 10) DB update — lastExportedAt YALNIZ completed anında
    await db.selectionSet.update({
      where: { id: setId },
      data: { lastExportedAt: new Date() },
    });
  } catch (err) {
    // Partial upload cleanup: ZIP upload başarılıysa ama sonraki adım fail
    // ettiyse orphan kalmasın (best-effort, error suppress).
    if (uploaded) {
      await storage.delete(storageKey).catch((cleanupErr: unknown) => {
        logger.error(
          {
            jobId,
            storageKey,
            err:
              cleanupErr instanceof Error
                ? cleanupErr.message
                : String(cleanupErr),
          },
          "selection export partial ZIP cleanup failed (orphan possible)",
        );
      });
    }
    throw err;
  }

  logger.info(
    { jobId, setId, storageKey, itemCount: set.items.length },
    "selection export completed",
  );

  return {
    storageKey,
    jobId,
  };
}
