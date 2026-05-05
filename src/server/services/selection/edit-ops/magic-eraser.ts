// Pass 29 — Magic Eraser inpainting edit-op (LaMa via Python subprocess).
//
// Sözleşme (background-remove emsali, design Section 5):
//   - Input: `{ inputAssetId, maskBuffer }`  — mask PNG, white=remove
//   - Output: yeni Asset entity (`{ assetId }`)  — inpaint sonucu PNG
//   - Side-effect: Storage upload (selection-edits/{userId}/magic-eraser-{uuid}.png) +
//     Asset DB row insert.
//
// **Heavy op tier:** sync API'de değil — `applyEditAsync` üzerinden BullMQ
// enqueue. `applyEdit({ op: "magic-eraser" })` orchestrator'da REJECT eder.
// Bu fonksiyon BullMQ worker (`magic-eraser.worker.ts`) tarafından çağrılır.
//
// **Servis:** `src/server/services/magic-eraser/runner.py` — Python LaMa
// subprocess. Cold start ~5-15s (model lazy load), sonraki ~1-3s. Worker
// concurrency 1 önerilir (4096×4096 ~1-2GB RAM peak).
//
// **Failure mapping:**
//   - mimeType ∉ {png, jpeg, jpg, webp} → UnsupportedFormatError (400)
//   - sizeBytes > 50MB → AssetTooLargeError (413)
//   - Python runner exit code != 0 → MagicEraserRuntimeError (500); stderr
//     mesajı audit history'sine yansır
//   - Sessiz fallback YASAK; runner kurulu değilse exit code 2 ile fail.
//
// **Mock stratejisi (test):**
//   `MAGIC_ERASER_PYTHON` env'i mock-runner.sh'a işaret edebilir;
//   integration test'te küçük bash script subprocess emsali yeterli.

import { spawn } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/hash";
import { logger } from "@/lib/logger";
import { UnsupportedFormatError, AssetTooLargeError } from "@/lib/errors";

const SUPPORTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const MAX_INPUT_BYTES = 50 * 1024 * 1024;

export type MagicEraserInput = {
  inputAssetId: string;
  // Mask PNG buffer (grayscale; white=remove, black=keep). Worker bu buffer'ı
  // tmp dosyaya yazar, runner argv ile path geçirir.
  maskBuffer: Buffer;
};

export type MagicEraserResult = {
  assetId: string;
  elapsedMs: number;
};

/**
 * Custom error: Python runner exit code != 0 durumunda fırlatılır.
 * Worker bu hatayı yakalayıp editHistoryJson'a `failed: true, reason`
 * yazar — kullanıcı UI'da "İşlem başarısız" badge'i görür.
 */
export class MagicEraserRuntimeError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = "MagicEraserRuntimeError";
  }
}

type RunnerOutput = {
  ok: boolean;
  outputPath?: string;
  elapsedMs?: number;
  width?: number;
  height?: number;
  error?: string;
  exitCode?: number;
};

/**
 * Python runner subprocess başlatır, JSON-line stdout'ı parse eder.
 * Stderr structured logger'a yazılır.
 */
async function runPythonInpaint(args: {
  inputPath: string;
  maskPath: string;
  outputPath: string;
}): Promise<RunnerOutput> {
  const pythonBin = process.env.MAGIC_ERASER_PYTHON ?? "python3";
  // Runner path lookup:
  //   - MAGIC_ERASER_RUNNER_OVERRIDE: QA mock runner (Pass 30) için
  //     escape hatch. LaMa kurulu olmayan dev ortamlarında
  //     scripts/magic-eraser-mock-runner.py'a işaret eder.
  //   - default: repo-root relative production runner.py.
  const runnerPath =
    process.env.MAGIC_ERASER_RUNNER_OVERRIDE ??
    path.join(
      process.cwd(),
      "src",
      "server",
      "services",
      "magic-eraser",
      "runner.py",
    );

  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [
      runnerPath,
      args.inputPath,
      args.maskPath,
      args.outputPath,
    ]);

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      reject(
        new MagicEraserRuntimeError(
          `Python runner spawn failed: ${err.message}`,
          -1,
          err.message,
        ),
      );
    });

    child.on("close", (code) => {
      // Stdout son JSON satırı runner output'u
      const lastLine = stdout.trim().split("\n").pop() ?? "";
      let parsed: RunnerOutput | null = null;
      try {
        parsed = JSON.parse(lastLine) as RunnerOutput;
      } catch {
        // Parse fail — runner crash etmiş olabilir
      }
      if (code !== 0 || !parsed?.ok) {
        const errMsg = parsed?.error ?? `runner exited with code ${code}`;
        logger.warn(
          {
            exitCode: code,
            stderr: stderr.slice(0, 500),
            errMsg,
          },
          "magic-eraser runner failed",
        );
        reject(
          new MagicEraserRuntimeError(errMsg, code ?? -1, stderr),
        );
        return;
      }
      resolve(parsed);
    });
  });
}

/**
 * Selection item asset'ine LaMa inpaint uygular; yeni Asset üretir.
 *
 * Algoritma:
 *   1. Input asset entity (fail-fast)
 *   2. Format + memory guard
 *   3. Storage'tan input buffer download
 *   4. Tmp dir'e input + mask + output path hazırla
 *   5. Python runner subprocess (LaMa)
 *   6. Output PNG'i tmp'den oku
 *   7. Sharp metadata
 *   8. Storage upload (selection-edits/{userId}/magic-eraser-{uuid}.png)
 *   9. DB'ye yeni Asset row
 *  10. Tmp dosyaları temizle (best-effort)
 *  11. Return `{ assetId, elapsedMs }`
 */
export async function magicEraser(
  input: MagicEraserInput,
): Promise<MagicEraserResult> {
  // 1) Input asset
  const inputAsset = await db.asset.findUniqueOrThrow({
    where: { id: input.inputAssetId },
  });

  // 2) Guards
  if (!SUPPORTED_MIME_TYPES.has(inputAsset.mimeType)) {
    throw new UnsupportedFormatError(
      `magic-eraser yalnız PNG/JPG/WebP destekler; aldı: ${inputAsset.mimeType}`,
    );
  }
  if (inputAsset.sizeBytes > MAX_INPUT_BYTES) {
    const mb = (inputAsset.sizeBytes / (1024 * 1024)).toFixed(1);
    throw new AssetTooLargeError(
      `magic-eraser ≤50MB asset destekler; aldı: ${mb}MB`,
    );
  }

  // 3) Storage download
  const storage = getStorage();
  const inputBuffer = await storage.download(inputAsset.storageKey);

  // 4) Tmp paths
  const tmpDir = await import("node:fs/promises").then((m) =>
    m.mkdtemp(path.join(os.tmpdir(), "magic-eraser-")),
  );
  const inputExt = inputAsset.mimeType === "image/jpeg" ? ".jpg" : ".png";
  const inputTmpPath = path.join(tmpDir, `input${inputExt}`);
  const maskTmpPath = path.join(tmpDir, "mask.png");
  const outputTmpPath = path.join(tmpDir, "output.png");

  await writeFile(inputTmpPath, inputBuffer);
  await writeFile(maskTmpPath, input.maskBuffer);

  let outputBuffer: Buffer;
  let elapsedMs = 0;
  try {
    // 5) Run Python
    const runnerResult = await runPythonInpaint({
      inputPath: inputTmpPath,
      maskPath: maskTmpPath,
      outputPath: outputTmpPath,
    });
    elapsedMs = runnerResult.elapsedMs ?? 0;

    // 6) Read output
    outputBuffer = await readFile(outputTmpPath);
  } finally {
    // 10) Tmp temizliği — best-effort, hata bastır
    Promise.all(
      [inputTmpPath, maskTmpPath, outputTmpPath].map((p) =>
        unlink(p).catch(() => undefined),
      ),
    ).catch(() => undefined);
  }

  // 7) Output metadata
  const outMeta = await sharp(outputBuffer).metadata();

  // 8) Storage upload
  const storageKey = `selection-edits/${inputAsset.userId}/magic-eraser-${crypto.randomUUID()}.png`;
  const stored = await storage.upload(storageKey, outputBuffer, {
    contentType: "image/png",
  });

  // 9) DB Asset row
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

  return { assetId: outputAsset.id, elapsedMs };
}
