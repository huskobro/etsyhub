// Phase 7 Task 7 — Crop edit-op (Sharp resize + center crop).
//
// Sözleşme (design Section 5):
//   - Input: `{ inputAssetId, params: { ratio } }`
//   - Output: yeni Asset entity (`{ assetId }`).
//   - Side-effect: Storage upload + Asset DB row create.
//
// Aspect ratio whitelist: "2:3" | "4:5" | "1:1" | "3:4".
//
// Algoritma (Sharp `fit: cover` + `position: center`):
//   1. Input asset entity'yi DB'den fetch
//   2. Storage'dan input buffer'ı download
//   3. Sharp metadata oku (width/height); en uygun crop boyutlarını hesapla:
//      - currentRatio = w / h
//      - targetRatio = (örn. 1:1 → 1.0, 4:5 → 0.8, 2:3 → 0.667, 3:4 → 0.75)
//      - currentRatio > targetRatio ⇒ height sabit, w = round(h * targetRatio)
//        (yatay crop — geniş görseli daraltıyoruz)
//      - else ⇒ width sabit, h = round(w / targetRatio)
//        (dikey crop — yüksek görseli kısaltıyoruz)
//   4. `sharp(buf).resize(targetW, targetH, { fit: "cover", position: "center" })`
//      `.png().toBuffer()`
//   5. Storage'a upload: `selection-edits/{userId}/{uuid}.png`
//   6. DB'ye Asset row insert (userId = inputAsset.userId; mimeType image/png;
//      width/height = output buffer metadata; hash = sha256(output)).
//   7. Return `{ assetId: newAsset.id }`.
//
// Notlar:
//   - userId input asset'in userId'sinden devralınır (orchestrator zaten
//     ownership check yaptı — burada yalnız Asset.userId üzerinden isolation).
//   - Hash deduplication YOK (Phase 5 createAssetFromBuffer'daki dedupe kontrolü
//     burada uygun değil — her crop yeni bir asset entity üretmeli; aynı user
//     aynı görseli iki kez aynı ratio'ya kırparsa iki ayrı asset row olur).
//     Carry-forward: edit-op-asset-dedupe — gerekirse ileride.
//   - Invalid ratio (TS coverage dışı runtime cast) → switch'te exhaustive
//     guard `never` throw eder.

import sharp from "sharp";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/hash";

export type CropRatio = "2:3" | "4:5" | "1:1" | "3:4";

export type CropAssetInput = {
  inputAssetId: string;
  params: { ratio: CropRatio };
};

export type CropAssetResult = {
  assetId: string;
};

/**
 * Aspect ratio key'inden numeric width/height oranını döner (w/h).
 *
 * Runtime defense — TS sözleşme zaten `CropRatio` ile sınırlar; ama JSON
 * payload'tan gelen runtime cast veya bypass durumunda exhaustive guard
 * `never` throw eder.
 */
function ratioToFraction(ratio: CropRatio): number {
  switch (ratio) {
    case "2:3":
      return 2 / 3;
    case "4:5":
      return 4 / 5;
    case "1:1":
      return 1;
    case "3:4":
      return 3 / 4;
    default: {
      const _exhaustive: never = ratio;
      throw new Error(`Geçersiz crop ratio: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Hedef boyutu hesapla — fit:cover + center crop için.
 *
 * Strategy: küçük kenarı koruyarak büyük kenardan kırp (lossless minimum).
 *   - currentRatio > targetRatio (görsel hedeften daha geniş) ⇒ yükseklik
 *     sabit, genişliği daralt
 *   - currentRatio < targetRatio (görsel hedeften daha yüksek) ⇒ genişlik
 *     sabit, yüksekliği kısalt
 *   - currentRatio === targetRatio ⇒ aynen geç (Sharp gene de PNG re-encode
 *     eder; output asset yine yeni bir entity).
 */
function computeTargetDimensions(
  currentW: number,
  currentH: number,
  targetRatio: number,
): { width: number; height: number } {
  const currentRatio = currentW / currentH;
  if (currentRatio > targetRatio) {
    // Görsel hedeften daha geniş — yatay crop (height sabit).
    return {
      width: Math.round(currentH * targetRatio),
      height: currentH,
    };
  }
  // Görsel hedeften daha dar (yüksek) — dikey crop (width sabit).
  return {
    width: currentW,
    height: Math.round(currentW / targetRatio),
  };
}

/**
 * Asset'i verilen aspect ratio'ya göre kırp; yeni Asset entity döner.
 *
 * Sharp `resize(targetW, targetH, { fit: "cover", position: "center" })` ile
 * center-crop. Output PNG; storage `selection-edits/{userId}/{uuid}.png`
 * pattern'ine upload edilir; yeni Asset DB row insert edilir.
 */
export async function cropAsset(
  input: CropAssetInput,
): Promise<CropAssetResult> {
  // 1) Input asset
  const inputAsset = await db.asset.findUniqueOrThrow({
    where: { id: input.inputAssetId },
  });

  // 2) Storage'dan buffer download
  const storage = getStorage();
  const inputBuffer = await storage.download(inputAsset.storageKey);

  // 3) Sharp metadata + target dimensions
  const meta = await sharp(inputBuffer).metadata();
  if (!meta.width || !meta.height) {
    throw new Error(
      `Crop input metadata eksik (width/height yok): asset=${inputAsset.id}`,
    );
  }
  const targetRatio = ratioToFraction(input.params.ratio);
  const target = computeTargetDimensions(meta.width, meta.height, targetRatio);

  // 4) Sharp crop (fit:cover + center) + PNG encode
  const outputBuffer = await sharp(inputBuffer)
    .resize(target.width, target.height, {
      fit: "cover",
      position: "center",
    })
    .png()
    .toBuffer();

  // 5) Storage upload (yeni key)
  const storageKey = `selection-edits/${inputAsset.userId}/${crypto.randomUUID()}.png`;
  const stored = await storage.upload(storageKey, outputBuffer, {
    contentType: "image/png",
  });

  // 6) DB'ye yeni Asset row — Sharp output metadata'sını okuyup width/height
  // doğru yaz (re-encode sonrası boyut hedefle aynı olmalı, ama defansif).
  const outMeta = await sharp(outputBuffer).metadata();
  const outputAsset = await db.asset.create({
    data: {
      userId: inputAsset.userId,
      storageProvider: env.STORAGE_PROVIDER,
      storageKey: stored.key,
      bucket: stored.bucket,
      mimeType: "image/png",
      sizeBytes: stored.size,
      width: outMeta.width ?? target.width,
      height: outMeta.height ?? target.height,
      hash: sha256(outputBuffer),
    } satisfies Prisma.AssetUncheckedCreateInput,
  });

  return { assetId: outputAsset.id };
}
