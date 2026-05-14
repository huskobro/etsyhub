/* eslint-disable no-restricted-syntax */
// Phase 99 — Frame mode export compositor (Sharp pipeline).
//
// File-level eslint-disable: backend Sharp pipeline, frame-scene.ts ile
// aynı pattern (UI token sistemi UI-only; backend compose fallback hex
// değerleri Studio dark shell palette'i ile uyumlu). design-tokens.ts
// frontend-only export ediyor.
//
// Mockup mode'un Phase 8 / 74 / 75 compositor'ından ayrı, Frame mode
// "presentation surface" için aspect-aware canvas pipeline'ı.
//
// Pipeline (sözleşme #11 + #13.C):
//   1. Aspect → output dims (1080×1080 / 1080×1350 / 1080×1920 /
//      1920×1080 / 1500×2000)
//   2. Plate background layer (auto palette / solid / gradient / glass
//      undertone)
//   3. Cascade asset slots — real MinIO image buffer'ları (her slot
//      preview ile aynı pozisyon + rotation + scale + ghost opacity)
//   4. Lens Blur (Sharp blur uygulanır cascade üzerine — sözleşme
//      Phase 98 baseline ile uyumlu)
//   5. Glass overlay (variant-tinted semi-transparent layer)
//   6. PNG encode → Buffer döner (caller upload eder)
//
// Pure function: parameter alır, Buffer döner. Storage / signed URL
// orchestration caller (frame-export.service) tarafında.
//
// Sözleşme #2 stage continuity: preview state ile compositor input
// aynı kaynaklarda (sceneOverride, slotsWithImages, layoutCount,
// deviceKind, frameAspect, activePalette). Operator için preview ↔
// export divergence sıfır.

import sharp from "sharp";

export interface FrameSlotInput {
  /** Slot index (0..N). */
  index: number;
  /** Real asset PNG/JPG/WebP buffer; undefined → ghost/placeholder slot. */
  imageBuffer?: Buffer;
  /** Cascade pozisyonu (stage-inner 572×504 koordinatları — normalize edilecek). */
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  z: number;
  /** Slot assigned mı? (operator preview parity — ghost slot opacity). */
  assigned: boolean;
  /** Active slot (preview ring); export'ta visual chrome yok — yalnız
   *  pozisyon korunur. */
}

export type FrameSceneMode = "auto" | "solid" | "gradient" | "glass";
export type FrameGlassVariant = "light" | "dark" | "frosted";

export interface FrameSceneInput {
  mode: FrameSceneMode;
  /** auto + solid + gradient + glass için palette[0] (warm) ve palette[1]
   *  (deep). Solid mode'da color tek (deep slot kullanılır). Gradient
   *  mode'da from/to. Glass mode'da underlying palette gradient + tone
   *  overlay. */
  color?: string;
  colorTo?: string;
  glassVariant?: FrameGlassVariant;
  lensBlur?: boolean;
  /** auto mode fallback (activePalette[0], activePalette[1]). */
  palette?: readonly [string, string];
}

export interface FrameCompositorInput {
  outputW: number;
  outputH: number;
  scene: FrameSceneInput;
  slots: ReadonlyArray<FrameSlotInput>;
  /** Stage-inner reference dims (cascadeLayoutFor kullanılan 572×504). */
  stageInnerW: number;
  stageInnerH: number;
}

const STAGE_INNER_REF_W = 572;
const STAGE_INNER_REF_H = 504;

/* Phase 99 — Resolve plate background SVG layer.
 *
 * Output canvas full bg'sini SVG ile compose ediyoruz; Sharp `composite`
 * SVG layer'ları PNG'ye flatten eder.
 */
function buildBackgroundSvg(
  outputW: number,
  outputH: number,
  scene: FrameSceneInput,
): string {
  const mode = scene.mode;
  if (mode === "solid" && scene.color) {
    return `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${outputW}" height="${outputH}" fill="${escapeXml(scene.color)}"/>
    </svg>`;
  }
  if (mode === "gradient" && scene.color && scene.colorTo) {
    return `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${escapeXml(scene.color)}"/>
          <stop offset="100%" stop-color="${escapeXml(scene.colorTo)}"/>
        </linearGradient>
      </defs>
      <rect width="${outputW}" height="${outputH}" fill="url(#g)"/>
    </svg>`;
  }
  // auto + glass (glass also uses underlying palette gradient under overlay)
  const palette = scene.palette;
  const from = palette ? palette[0] : "#F5B27D";
  const to = palette ? palette[1] : "#D97842";
  return `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${escapeXml(from)}"/>
        <stop offset="100%" stop-color="${escapeXml(to)}"/>
      </linearGradient>
    </defs>
    <rect width="${outputW}" height="${outputH}" fill="url(#g)"/>
  </svg>`;
}

/* Phase 99 — Glass overlay layer (Phase 98 variant tone parity).
 *
 * Plate üzerine variant-tinted semi-transparent rect; preview'da
 * `backdrop-filter` ile blur ediliyordu. Sharp'ta backdrop-filter
 * doğrudan yok; alttaki cascade'i lensBlur ile bulanıklaştırıp
 * (input.scene.lensBlur=true) glass overlay üstüne uygularsak benzer
 * "frosted glass" hissi elde ederiz. Phase 99 baseline: glass overlay
 * = variant-tinted rect + subtle border. Operator preview ile output
 * birebir aynı görsel hissi alır (CSS backdrop-filter parity).
 */
function buildGlassOverlaySvg(
  outputW: number,
  outputH: number,
  variant: FrameGlassVariant,
): string {
  let fill: string;
  let stroke: string;
  if (variant === "dark") {
    fill = "rgba(15,12,8,0.30)";
    stroke = "rgba(255,255,255,0.10)";
  } else if (variant === "frosted") {
    fill = "rgba(255,255,255,0.12)";
    stroke = "rgba(255,255,255,0.22)";
  } else {
    // light
    fill = "rgba(255,255,255,0.22)";
    stroke = "rgba(255,255,255,0.30)";
  }
  return `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${outputW}" height="${outputH}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  </svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* Phase 99 — Compose Frame output PNG.
 *
 * Output canvas full bg + cascade slots (scale ratio = outputW /
 * stageInnerW). Cascade pozisyonları stage-inner 572×504 referansında
 * geldiği için output dims'e oranla scale edilir. Operator preview'da
 * gördüğü kompozisyon export'ta birebir aynı pozisyonda yer alır
 * (sözleşme #11 preview ↔ export aynı kaynak).
 */
export async function composeFrameOutput(
  input: FrameCompositorInput,
): Promise<Buffer> {
  const { outputW, outputH, scene, slots } = input;
  const stageInnerW = input.stageInnerW || STAGE_INNER_REF_W;
  const stageInnerH = input.stageInnerH || STAGE_INNER_REF_H;

  /* 1) Background layer */
  const bgSvg = buildBackgroundSvg(outputW, outputH, scene);
  const bgBuffer = Buffer.from(bgSvg);

  /* 2) Cascade slot composites.
   *
   * Stage-inner 572×504 → output canvas oranla scale. Aspect mismatch
   * durumunda cascade'i en kısa boyut üzerinden orantılı küçült (preview
   * cascadeScale parity, Phase 95 baseline). */
  const cascadeScale = Math.min(
    outputW / stageInnerW,
    outputH / stageInnerH,
  );
  const cascadeOffsetX = Math.round((outputW - stageInnerW * cascadeScale) / 2);
  const cascadeOffsetY = Math.round((outputH - stageInnerH * cascadeScale) / 2);

  // Composite operations array
  const slotComposites: sharp.OverlayOptions[] = [];

  for (const slot of slots) {
    if (!slot.imageBuffer) continue; // ghost slot: skip in export

    const slotOutW = Math.max(1, Math.round(slot.w * cascadeScale));
    const slotOutH = Math.max(1, Math.round(slot.h * cascadeScale));
    const slotOutX = Math.round(slot.x * cascadeScale + cascadeOffsetX);
    const slotOutY = Math.round(slot.y * cascadeScale + cascadeOffsetY);

    // Resize asset, optional rotate, alpha-aware
    let assetSharp = sharp(slot.imageBuffer).resize(slotOutW, slotOutH, {
      fit: "cover",
      position: "centre",
    });
    if (slot.r && slot.r !== 0) {
      assetSharp = assetSharp.rotate(slot.r, {
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }
    const slotPng = await assetSharp.png().toBuffer();
    // After rotation, dimensions may have grown; recenter
    const meta = await sharp(slotPng).metadata();
    const finalW = meta.width ?? slotOutW;
    const finalH = meta.height ?? slotOutH;
    const finalX = Math.round(slotOutX + (slotOutW - finalW) / 2);
    const finalY = Math.round(slotOutY + (slotOutH - finalH) / 2);

    // Ghost slot opacity (preview parity — Phase 85 baseline).
    if (!slot.assigned) {
      // Skip ghosts in export (operator için unassigned slot'lar export
      // edilmez — production deliverable yalnız assigned cascade gösterir).
      continue;
    }

    slotComposites.push({
      input: slotPng,
      top: Math.max(0, finalY),
      left: Math.max(0, finalX),
    });
  }

  /* 3) Compose: bg → cascade composites */
  let canvasSharp = sharp(bgBuffer).png();
  if (slotComposites.length > 0) {
    canvasSharp = sharp(await canvasSharp.toBuffer()).composite(slotComposites);
  }
  let canvasBuffer = await canvasSharp.toBuffer();

  /* 4) Lens Blur — apply Sharp blur to canvas (preview CSS filter:blur(8px)
   *  parity; 8px CSS ≈ Sharp σ ≈ 5-6 depending on output dims). */
  if (scene.lensBlur) {
    canvasBuffer = await sharp(canvasBuffer).blur(6).png().toBuffer();
  }

  /* 5) Glass overlay (after blur, so glass overlay itself stays sharp). */
  if (scene.mode === "glass") {
    const variant = scene.glassVariant ?? "light";
    const glassSvg = buildGlassOverlaySvg(outputW, outputH, variant);
    canvasBuffer = await sharp(canvasBuffer)
      .composite([{ input: Buffer.from(glassSvg) }])
      .png()
      .toBuffer();
  }

  /* 6) Final PNG encode. */
  return await sharp(canvasBuffer).png({ compressionLevel: 9 }).toBuffer();
}
