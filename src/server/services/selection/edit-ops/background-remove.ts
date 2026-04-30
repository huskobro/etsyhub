// Phase 7 Task 9 — Background remove edit-op (@imgly/background-removal-node).
//
// Sözleşme (design Section 5):
//   - Input: `{ inputAssetId }`
//   - Output: yeni Asset entity (`{ assetId }`) — transparent PNG.
//   - Side-effect: Storage upload (selection-edits/{userId}/bg-remove-{uuid}.png) +
//     Asset DB row insert.
//
// **Heavy op tier (design Section 5.1):**
//   - Sync API'de değil — `applyEditAsync` üzerinden BullMQ enqueue.
//   - `applyEdit({ op: "background-remove" })` orchestrator'da REJECT eder.
//   - Bu fonksiyon Task 10'da BullMQ worker tarafından çağrılır.
//
// **Library:** `@imgly/background-removal-node` 1.4.5 — Node.js variant
//   (browser variant değil). Native dep: `onnxruntime-node` (~50-200MB native
//   binary). Model dosyası ilk çağrıda lazy yüklenir (~30-80MB). Cold start
//   uzun olabilir; production'da Task 10 worker startup'ında pre-warm edilebilir.
//
// **Failure mapping:**
//   - mimeType ∉ {png, jpeg, jpg, webp} → throw UnsupportedFormatError (400)
//   - sizeBytes > 50MB → throw AssetTooLargeError (413)
//   - Model load fail / WASM init error → propagate (worker FAILED state'e atar)
//   - Sessiz fallback YASAK (Phase 6 paterni; fail-fast).
//
// **Mock stratejisi (test):**
//   Library mock'lanır — model accuracy kapsam dışı; entegrasyon ve hata
//   yüzeyi (format guard, memory guard, propagate, output Asset entity)
//   test'lerle korunur.

import sharp from "sharp";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal-node";
import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/hash";
import { UnsupportedFormatError, AssetTooLargeError } from "@/lib/errors";

const SUPPORTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

/**
 * 50MB — heavy op için memory guard. Sınır INCLUSIVE: tam 50MB kabul edilir,
 * aşan reject. OOM riskini azaltır; Worker job timeout BullMQ tarafında.
 */
const MAX_INPUT_BYTES = 50 * 1024 * 1024;

export type BackgroundRemoveInput = {
  inputAssetId: string;
};

export type BackgroundRemoveResult = {
  assetId: string;
};

/**
 * Library çıktısını Buffer'a normalize eder.
 *
 * `@imgly/background-removal-node` versiyona/config'e göre Blob, Uint8Array
 * veya ArrayBuffer dönebilir. Edit-op fonksiyonu bunların hepsini kabul edip
 * tek tip Buffer'a çevirir.
 */
async function normalizeOutputToBuffer(
  out: Blob | Uint8Array | ArrayBuffer | Buffer,
): Promise<Buffer> {
  if (Buffer.isBuffer(out)) return out;
  if (out instanceof Uint8Array) return Buffer.from(out);
  if (out instanceof ArrayBuffer) return Buffer.from(out);
  // Blob (ya da Blob-like) — arrayBuffer() ile oku
  if (typeof (out as Blob).arrayBuffer === "function") {
    const ab = await (out as Blob).arrayBuffer();
    return Buffer.from(ab);
  }
  throw new Error(
    "background-remove: library çıktısı tanınmadı (Blob/Uint8Array/ArrayBuffer/Buffer bekleniyordu)",
  );
}

/**
 * Asset'in arka planını WASM ile siler; yeni transparent PNG Asset üretir.
 *
 * Algoritma:
 *   1. Input asset entity'yi DB'den fetch (fail-fast: yoksa throw)
 *   2. Format guard: mimeType ∉ {png, jpeg, jpg, webp} ⇒ UnsupportedFormatError
 *   3. Memory guard: sizeBytes > 50MB ⇒ AssetTooLargeError
 *   4. Storage'tan input buffer download
 *   5. `@imgly/background-removal-node`.removeBackground(buffer) — WASM çağrısı
 *   6. Çıktıyı Buffer'a normalize et (Blob/Uint8Array/ArrayBuffer hepsi)
 *   7. Sharp metadata: output PNG width/height
 *   8. Storage upload: selection-edits/{userId}/bg-remove-{uuid}.png
 *   9. DB'ye yeni Asset row (mimeType image/png, width/height, hash, userId
 *      input asset'ten devralınır)
 *  10. Return `{ assetId }`
 */
export async function removeBackground(
  input: BackgroundRemoveInput,
): Promise<BackgroundRemoveResult> {
  // 1) Input asset (fail-fast)
  const inputAsset = await db.asset.findUniqueOrThrow({
    where: { id: input.inputAssetId },
  });

  // 2) Format guard
  if (!SUPPORTED_MIME_TYPES.has(inputAsset.mimeType)) {
    throw new UnsupportedFormatError(
      `background-remove yalnız PNG/JPG/WebP destekler; aldı: ${inputAsset.mimeType}`,
    );
  }

  // 3) Memory guard (>50MB reject; tam 50MB kabul)
  if (inputAsset.sizeBytes > MAX_INPUT_BYTES) {
    const mb = (inputAsset.sizeBytes / (1024 * 1024)).toFixed(1);
    throw new AssetTooLargeError(
      `background-remove için asset >50MB; aldı: ${mb}MB`,
    );
  }

  // 4) Storage'tan input buffer
  const storage = getStorage();
  const inputBuffer = await storage.download(inputAsset.storageKey);

  // 5) WASM çağrısı — model lazy load (cold start ilk çağrıda).
  // Library throw ederse propagate (sessiz fallback yasak).
  const rawOutput = await imglyRemoveBackground(inputBuffer);

  // 6) Çıktıyı Buffer'a normalize
  const outputBuffer = await normalizeOutputToBuffer(rawOutput);

  // 7) Output PNG metadata (width/height)
  const outMeta = await sharp(outputBuffer).metadata();

  // 8) Storage upload (yeni key — bg-remove- prefix'i Task 10 worker
  // observability için; selection-edits/{userId}/{op}-{uuid}.png patterni).
  const storageKey = `selection-edits/${inputAsset.userId}/bg-remove-${crypto.randomUUID()}.png`;
  const stored = await storage.upload(storageKey, outputBuffer, {
    contentType: "image/png",
  });

  // 9) DB'ye yeni Asset row
  const outputAsset = await db.asset.create({
    data: {
      userId: inputAsset.userId,
      storageProvider: env.STORAGE_PROVIDER,
      storageKey: stored.key,
      bucket: stored.bucket,
      mimeType: "image/png",
      sizeBytes: stored.size,
      width: outMeta.width ?? null,
      height: outMeta.height ?? null,
      hash: sha256(outputBuffer),
    } satisfies Prisma.AssetUncheckedCreateInput,
  });

  // 10) Return
  return { assetId: outputAsset.id };
}
