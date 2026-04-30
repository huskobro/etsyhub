// Phase 7 — Task 11: ZIP builder
//
// Manifest + asset buffer'ları → ZIP buffer (streaming archiver).
//
// Sözleşme: docs/plans/2026-04-30-phase7-selection-studio-design.md
//   - Section 6.2 (klasör yapısı B2):
//       * `images/` — aktif görüntüler
//       * `originals/` — yalnız edit yapılmış item'ların orijinalleri
//       * `manifest.json` — pretty-print
//       * `README.txt` — sade Türkçe (Section 6.4)
//   - Section 6.4 (README): 10-15 satır rehber içerik
//
// Implementasyon notu (carry-forward `selection-studio-export-fast-path`):
// Phase 7 v1 in-memory buffer toplar. Gerçekçi büyük setlerde streaming
// to-disk gerekecek; bu fast-path optimizasyonu Phase 8'e taşındı.

import { PassThrough } from "node:stream";
import archiver from "archiver";

import type { ManifestSchemaV1 } from "./manifest";

// ────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────

export type ZipAssetInput = {
  /** Görece path — "images/var-001.png" veya "originals/var-001.png". */
  filename: string;
  buffer: Buffer;
};

export type BuildZipInput = {
  manifest: ManifestSchemaV1;
  images: ZipAssetInput[];
  originals: ZipAssetInput[];
};

// ────────────────────────────────────────────────────────────
// README builder (Section 6.4)
// ────────────────────────────────────────────────────────────

function buildReadme(manifest: ManifestSchemaV1): string {
  const lines = [
    "EtsyHub Selection Studio Export",
    "==============================",
    "",
    "Bu paket EtsyHub Selection Studio'dan dışa aktarılmış bir tasarım setidir.",
    "",
    "Klasör yapısı:",
    "- images/      — Aktif (varsa düzenlenmiş, yoksa orijinal) görseller",
    "- originals/   — Düzenleme yapılmış öğelerin orijinal görselleri (varsa)",
    "- manifest.json — Set ve öğelerin meta verisi (Phase 8 Mockup Studio için)",
    "- README.txt   — Bu dosya",
    "",
    "Mockup ve listing üretimi Phase 8 Mockup Studio'da yapılacaktır. Bu paket",
    "\"final ürün\" değildir; kendi mockup üretiminizi (Procreate, Photoshop, vb.)",
    "yapmak için bu görselleri kullanabilirsiniz.",
    "",
    `Set ID: ${manifest.set.id}`,
    `Export tarihi: ${manifest.exportedAt}`,
    `Öğe sayısı: ${manifest.items.length}`,
  ];
  return lines.join("\n");
}

// ────────────────────────────────────────────────────────────
// Stream → Buffer helper
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
// Public API
// ────────────────────────────────────────────────────────────

export async function buildZip(input: BuildZipInput): Promise<Buffer> {
  const { manifest, images, originals } = input;

  const archive = archiver("zip", { zlib: { level: 5 } });
  const passthrough = new PassThrough();
  archive.pipe(passthrough);

  // Hatalar promise reject'le sızabilsin
  const archiveErrors: Error[] = [];
  archive.on("warning", (err) => {
    if ((err as { code?: string }).code !== "ENOENT") {
      archiveErrors.push(err);
    }
  });
  archive.on("error", (err) => {
    archiveErrors.push(err);
  });

  // 1. Manifest (pretty-print)
  archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

  // 2. README
  archive.append(buildReadme(manifest), { name: "README.txt" });

  // 3. Aktif görüntüler (images/)
  for (const img of images) {
    archive.append(img.buffer, { name: img.filename });
  }

  // 4. Orijinaller (originals/) — yalnız edit yapılmış item'lar
  for (const orig of originals) {
    archive.append(orig.buffer, { name: orig.filename });
  }

  const bufferPromise = streamToBuffer(passthrough);
  await archive.finalize();
  const result = await bufferPromise;

  if (archiveErrors.length > 0) {
    throw archiveErrors[0];
  }
  return result;
}
