// Phase 8 Task 9 — Sharp safe-area placement.
//
// Spec §2.2: rect safeArea için design buffer'ı resize + (opsiyonel) rotate
// + position hesapla. Perspective Task 10'da implement edilecek (T0b spike
// kararı sonrası `sharp-perspective` paketi vs manuel matrix transform).
//
// Coordinate sistemi: safeArea normalize 0..1 (base asset top-left origin).
// Resize target: safeArea.w * baseDimensions.w × safeArea.h * baseDimensions.h.

import sharp from "sharp";
import type { SafeAreaRect } from "@/providers/mockup";

export type RectPlacement = {
  /** Resize + rotate sonrası design buffer'ı. */
  buffer: Buffer;
  /** Base asset üzerinde composite top koordinatı (px). */
  top: number;
  /** Base asset üzerinde composite left koordinatı (px). */
  left: number;
};

/**
 * Design buffer'ı rect safeArea'ya yerleştir.
 *
 * Spec §3.2: SafeAreaRect.x/y/w/h normalize 0..1 (base asset top-left origin).
 * Sharp resize → fit:"fill" (Spec §2.5'teki aspect compatibility filter
 * variant.aspectRatio template.aspectRatios uyumunu zaten garanti ediyor).
 *
 * Optional rotation (degrees) Sharp `rotate()` ile uygulanır; default 0.
 * Şeffaf arkaplan korunur (rotation bbox genişlemesinde).
 */
export async function placeRect(
  designBuffer: Buffer,
  safeArea: SafeAreaRect,
  baseDimensions: { w: number; h: number },
): Promise<RectPlacement> {
  const targetW = Math.round(safeArea.w * baseDimensions.w);
  const targetH = Math.round(safeArea.h * baseDimensions.h);

  let pipeline = sharp(designBuffer).resize(targetW, targetH, { fit: "fill" });
  if (safeArea.rotation && safeArea.rotation !== 0) {
    pipeline = pipeline.rotate(safeArea.rotation, {
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  const buffer = await pipeline.png().toBuffer();
  return {
    buffer,
    top: Math.round(safeArea.y * baseDimensions.h),
    left: Math.round(safeArea.x * baseDimensions.w),
  };
}

/**
 * Perspective placement — Task 10'da implement edilecek.
 *
 * T0b spike kararı sonrası `sharp-perspective` paketi veya manuel matrix
 * transform via Sharp `affine()`/raw pixel re-mapping.
 *
 * Şimdilik throw: localSharpProvider.render() bu fonksiyonu safeArea.type
 * === "perspective" olunca çağırır; worker bunu PROVIDER_DOWN classify
 * eder. Task 10'da gerçek implementation gelir.
 */
export async function placePerspective(): Promise<never> {
  throw new Error(
    "NOT_IMPLEMENTED: 4-corner perspective transform Task 10'da implement edilecek",
  );
}
