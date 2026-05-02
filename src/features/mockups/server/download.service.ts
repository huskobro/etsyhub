// Phase 8 Task 21 — bulk ZIP download service.
//
// Spec §4.6: packPosition ASC, cover-first, success only.
//   - Job ownership + status guard
//   - Storage download (parallel)
//   - ZIP builder (archiver + manifest.json)
//
// Section 4.6 Constraints:
//   - job.status ∈ {COMPLETED, PARTIAL_COMPLETE}
//   - Yalnız success render'lar dahil
//   - Cover invariant: packPosition=0 → 01-cover- prefix
//   - Filename ordering: success render sırası ASC (failed slot atla)
//   - manifest.json: cover işareti, failedPackPositions liste

import type { MockupJob, MockupRender } from "@prisma/client";
import { PassThrough } from "node:stream";
import archiver from "archiver";
import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { getStorage } from "@/providers/storage";
import { JobNotFoundError } from "./job.service";

// ────────────────────────────────────────────────────────────
// Custom error class
// ────────────────────────────────────────────────────────────

export class JobNotDownloadableError extends AppError {
  constructor(
    message = "Job download için hazır değil (status COMPLETED veya PARTIAL_COMPLETE olmalı)",
  ) {
    super(message, "JOB_NOT_DOWNLOADABLE", 403);
  }
}

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface ManifestImage {
  filename: string;
  packPosition: number;
  renderId: string;
  variantId: string;
  templateName: string;
  isCover: boolean;
}

interface ManifestJson {
  jobId: string;
  status: "COMPLETED" | "PARTIAL_COMPLETE";
  packSize: number;
  actualPackSize: number;
  coverRenderId: string | null;
  exportedAt: string;
  images: ManifestImage[];
  failedPackPositions: number[];
}

// ────────────────────────────────────────────────────────────
// Helper: stream to buffer
// ────────────────────────────────────────────────────────────

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

// ────────────────────────────────────────────────────────────
// Helper: slug generation (kebab-case)
// ────────────────────────────────────────────────────────────

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

export async function buildMockupZip(
  jobId: string,
  userId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  // 1. Fetch job + renders
  const job = await db.mockupJob.findUnique({
    where: { id: jobId },
    include: { renders: true },
  });

  // Cross-user / not found
  if (!job || job.userId !== userId) {
    throw new JobNotFoundError();
  }

  // 2. Status guard
  if (!["COMPLETED", "PARTIAL_COMPLETE"].includes(job.status)) {
    throw new JobNotDownloadableError();
  }

  // 3. Filter + sort success renders
  const successRenders = job.renders
    .filter((r) => r.status === "SUCCESS" && r.outputKey != null)
    .sort((a, b) => (a.packPosition ?? 0) - (b.packPosition ?? 0));

  // 4. Storage download (parallel)
  const storage = getStorage();
  const buffers = await Promise.all(
    successRenders.map((r) => storage.download(r.outputKey!)),
  );

  // 5. Prepare file entries (filename ordering by success sırası)
  const fileEntries: Array<{ filename: string; buffer: Buffer }> = [];
  const manifestImages: ManifestImage[] = [];
  const failedPackPositions: number[] = [];

  // Identify failed packPositions
  const allPackPositions = new Set(job.renders.map((r) => r.packPosition).filter((p) => p != null));
  const successPackPositions = new Set(
    successRenders.map((r) => r.packPosition).filter((p) => p != null),
  );
  for (const pos of allPackPositions) {
    if (!successPackPositions.has(pos)) {
      failedPackPositions.push(pos as number);
    }
  }
  failedPackPositions.sort((a, b) => a - b);

  // Build file entries (success order: 01-, 02-, ...)
  for (let i = 0; i < successRenders.length; i++) {
    const render = successRenders[i];
    if (!render) continue; // TS strict: guard

    const buffer = buffers[i];
    if (!buffer) continue; // TS strict: guard

    const fileNum = String(i + 1).padStart(2, "0");
    const isCover = render.packPosition === 0;

    // Template name from snapshot
    const snapshot = render.templateSnapshot as unknown as { templateName?: string };
    const templateName = snapshot.templateName || "template";
    const templateSlug = toKebabCase(templateName);

    // Variant slug (use last 8 chars of variantId)
    const variantSlug = render.variantId.slice(-8);

    // Filename
    let filename: string;
    if (isCover) {
      filename = `01-cover-${templateSlug}-${variantSlug}.png`;
    } else {
      filename = `${fileNum}-${templateSlug}-${variantSlug}.png`;
    }

    fileEntries.push({
      filename,
      buffer,
    });

    manifestImages.push({
      filename,
      packPosition: render.packPosition ?? -1,
      renderId: render.id,
      variantId: render.variantId,
      templateName,
      isCover,
    });
  }

  // 6. Build manifest
  const manifest: ManifestJson = {
    jobId,
    status: job.status as "COMPLETED" | "PARTIAL_COMPLETE",
    packSize: job.packSize,
    actualPackSize: successRenders.length,
    coverRenderId: job.coverRenderId,
    exportedAt: new Date().toISOString(),
    images: manifestImages,
    failedPackPositions,
  };

  // 7. Build ZIP
  const archive = archiver("zip", { zlib: { level: 5 } });
  const passthrough = new PassThrough();
  archive.pipe(passthrough);

  // Error handling
  const archiveErrors: Error[] = [];
  archive.on("warning", (err) => {
    if ((err as { code?: string }).code !== "ENOENT") {
      archiveErrors.push(err);
    }
  });
  archive.on("error", (err) => {
    archiveErrors.push(err);
  });

  // Add manifest
  archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

  // Add images
  for (const entry of fileEntries) {
    archive.append(entry.buffer, { name: entry.filename });
  }

  const bufferPromise = streamToBuffer(passthrough);
  await archive.finalize();
  const buffer = await bufferPromise;

  if (archiveErrors.length > 0) {
    throw archiveErrors[0];
  }

  return {
    buffer,
    filename: `mockup-pack-${jobId}.zip`,
  };
}
