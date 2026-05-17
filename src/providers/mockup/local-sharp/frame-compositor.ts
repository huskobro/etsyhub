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

import { resolveMediaOffsetPx } from "@/features/mockups/studio/media-position";
import {
  resolvePlateEffects,
  resolveWatermarkLayout,
} from "@/features/mockups/studio/frame-scene";

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

/* Phase 105 — productType-aware device shape model.
 *
 * Studio preview `StageDeviceSVG` 5 shape ailesine ayrılır
 * (svg-art.tsx): wall_art/canvas/printable → WallArtFrameSVG (koyu
 * frame + krem mat), sticker/clipart → StickerCardSVG (kalın beyaz
 * edge — Phase 104 baseline), phone → PhoneSVG (device bezel),
 * bookmark → BookmarkStripSVG, tshirt/dtf/hoodie →
 * TshirtSilhouetteSVG.
 *
 * Phase 104'e kadar Sharp pipeline TÜM productType'lara sticker-style
 * beyaz edge uyguluyordu → wall_art export'unda koyu frame + krem mat
 * yoktu (en büyük productType-specific divergence). Phase 105 shape
 * model'i compositor'a taşır:
 *   - "frame"   → WallArtFrameSVG parity (wall_art/canvas/printable)
 *   - "sticker" → StickerCardSVG parity (sticker/clipart — Phase 104)
 *   - "bezel"   → PhoneSVG parity (phone — device chrome)
 *   - bookmark/tshirt → "sticker" fallback (Phase 106+ candidate;
 *     test set'leri clipart/wall_art/phone üçlüsünü kapsıyor).
 *
 * Studio Shell `stageDeviceForProductType(categoryId)` → StudioStage
 * DeviceKind; Phase 105 bu kind'i compositor'a iletir → preview ile
 * export aynı shape ailesinden (sözleşme §11.0 Preview = Export
 * Truth). */
export type FrameDeviceShape =
  | "frame"
  | "sticker"
  | "bezel"
  | "bookmark"
  | "garment"
  | "garment-hooded";

export function resolveDeviceShape(
  deviceKind: string | null | undefined,
): FrameDeviceShape {
  switch (deviceKind) {
    case "wall_art":
    case "canvas":
    case "printable":
      return "frame";
    case "phone":
      return "bezel";
    case "bookmark":
      // Phase 106 — BookmarkStripSVG parity (dar dikey strip + tassel
      // knot + ip + body + inner outline).
      return "bookmark";
    case "hoodie":
      // Phase 108 — TshirtSilhouetteSVG hooded parity (svg-art.tsx:
      // 1095 `hooded` ellipse cx, shoulderY-h*0.04 rx=w*0.18
      // ry=h*0.08 #2A2622). garment baseline + hood ellipse.
      return "garment-hooded";
    case "tshirt":
    case "dtf":
      // Phase 106 — TshirtSilhouetteSVG parity (garment silüeti +
      // sleeves + neckline + chest print area, hood YOK).
      return "garment";
    case "sticker":
    case "clipart":
    default:
      // clipart/sticker = StickerCardSVG (Phase 104 baseline).
      // Bilinmeyen kind → sticker (güvenli default).
      return "sticker";
  }
}

/* Lens Blur structured config — server-side mirror of
 * frame-scene.ts LensBlurConfig (compositor UI import etmez —
 * bağımsız tip). Phase 139 — `target` KALDIRILDI (tek-davranışlı).
 * Export zaten Phase 113'ten beri target'ı OKUMUYOR (her durumda
 * plate-area blur, cascade üstte NET); tip-paritesi için target
 * field'ı da kaldırıldı. intensity soft/medium/strong → Sharp
 * .blur sigma 3/6/11 (preview LENS_BLUR_PX 4/8/14 paritesi). */
export type FrameLensBlurIntensity = "soft" | "medium" | "strong";
export interface FrameLensBlurConfig {
  enabled: boolean;
  intensity: FrameLensBlurIntensity;
}

/** Sharp blur sigma per intensity (CSS px ile uyumlu yumuşaklık;
 *  preview LENS_BLUR_PX 4/8/14 paritesi). */
const FRAME_LENS_BLUR_SIGMA: Record<FrameLensBlurIntensity, number> = {
  soft: 3,
  medium: 6,
  strong: 11,
};

/** Backward-compat normalize (Phase 139 — target yok):
 *  undefined/false → disabled; true (legacy Phase 98-108) →
 *  enabled medium; structured → {enabled,intensity} (eski
 *  persisted config'lerdeki `target` structural-typing ile yok
 *  sayılır — export zaten okumuyordu). */
function normalizeFrameLensBlur(
  raw: boolean | FrameLensBlurConfig | undefined,
): FrameLensBlurConfig {
  if (raw === undefined || raw === false) {
    return { enabled: false, intensity: "medium" };
  }
  if (raw === true) {
    return { enabled: true, intensity: "medium" };
  }
  return { enabled: raw.enabled, intensity: raw.intensity };
}

export interface FrameSceneInput {
  mode: FrameSceneMode;
  /** auto + solid + gradient + glass için palette[0] (warm) ve palette[1]
   *  (deep). Solid mode'da color tek (deep slot kullanılır). Gradient
   *  mode'da from/to. Glass mode'da underlying palette gradient + tone
   *  overlay. */
  color?: string;
  colorTo?: string;
  glassVariant?: FrameGlassVariant;
  /** Phase 109 — legacy boolean (Phase 98-108) veya structured
   *  config (target/intensity). normalizeFrameLensBlur ile
   *  backward-compat. */
  lensBlur?: boolean | FrameLensBlurConfig;
  /** Phase 136 — BG Effects (Frame scene effect). frame-scene.ts
   *  BgEffectConfig mirror; resolvePlateEffects ile çözülür
   *  (preview = export aynı pure-TS resolver §11.0). undefined →
   *  no-op (vignetteAlpha=0 && grainOpacity=0). */
  bgEffect?: import("@/features/mockups/studio/frame-scene").BgEffectConfig;
  /** Phase 140 — Watermark (text). frame-scene.ts WatermarkConfig
   *  mirror; resolveWatermarkLayout ile çözülür (preview = export
   *  §11.0). undefined/null → no-op (active=false). EN ÜST katman
   *  (vignette 7b sonrası — Phase 7c). */
  watermark?:
    | import("@/features/mockups/studio/frame-scene").WatermarkConfig
    | null;
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
  /** Phase 105 — productType-aware device shape (preview StageDeviceSVG
   *  parity). Backward-compat: undefined → "sticker" (Phase 104
   *  baseline). */
  deviceShape?: FrameDeviceShape;
  /** Phase 126 — Global canonical media-position. Preview outer-
   *  wrapper ile AYNI resolveMediaOffsetPx; plate-area kırpar
   *  (§11.0 Preview=Export Truth). undefined → {0,0} no-op. */
  mediaPosition?: import(
    "@/features/mockups/studio/media-position"
  ).MediaPosition;
}

const STAGE_INNER_REF_W = 572;
const STAGE_INNER_REF_H = 504;

/* Phase 101 — Plate chrome parity (Studio preview ↔ export aynı görsel
 * aileden gelir; sözleşme #1 + #11).
 *
 * Studio preview'da plate canonical chrome (DOM ölçümlerinden):
 *   - border-radius: 26px
 *   - Phase 113: plate border KALDIRILDI (kullanıcı notu + glow/
 *     inner-border cleanup). Eski `2px solid rgba(255,255,255,0.18)`
 *     solid koyu bg'de pop ediyordu; preview'dan da kaldırıldı
 *     (`border: 2px solid transparent`). Export parity: plate rect
 *     stroke YOK — plate stage'den yalnız drop shadow ile ayrılır.
 *   - box-shadow chain:
 *       0  2px   6px  rgba(0,0,0,0.35)   close edge
 *       0 12px  28px -4px rgba(0,0,0,0.45) medium body
 *       0 36px  80px -16px rgba(0,0,0,0.55) ambient mid
 *       0 60px 120px -32px rgba(0,0,0,0.50) depth fade
 *   - background: sceneOverride-driven (auto palette / solid / gradient /
 *     glass undertone)
 *
 * Phase 100'e kadar Sharp pipeline plate chrome'unu hiç compose etmiyordu
 * → exported PNG düz dikdörtgen bg + cascade. Studio preview canlı ama
 * exported PNG "yarı yorumlanmış" çıkıyordu. Operator için divergence.
 *
 * Phase 101'de pipeline yeniden yapılandırıldı:
 *   1. Stage padding (dark void surface)
 *   2. Plate: rounded rect + border + multi-layer drop shadow + scene bg
 *   3. Cascade (slot composites) plate-clip içinde
 *
 * Output dims aynı kalır (1080×1080 / 1080×1350 / 1080×1920 / 1920×1080 /
 * 1500×2000). Plate dims output dims'in ~%85'i (Studio CSS max-width/
 * max-height 85%/82% paritesi). Stage padding ~%7-8 her kenardan.
 */

const PLATE_FILL_RATIO = 0.85;
const PLATE_RADIUS_REF = 26; // CSS px @ stage-inner ref
const STAGE_BG_HEX = "#111009"; // var(--ks-st) Studio dark stage tone

interface PlateLayoutOutput {
  plateW: number;
  plateH: number;
  plateX: number;
  plateY: number;
  plateRadius: number;
}

function resolvePlateLayout(outputW: number, outputH: number): PlateLayoutOutput {
  const plateW = Math.round(outputW * PLATE_FILL_RATIO);
  const plateH = Math.round(outputH * PLATE_FILL_RATIO);
  const plateX = Math.round((outputW - plateW) / 2);
  const plateY = Math.round((outputH - plateH) / 2);
  // Plate radius output dims'e oranla scale (preview 26px @ 1006×608 → ~27px
  // @ 1920×1080 plate). Min/max guard ile rafine kalır.
  const radiusScale = Math.min(plateW / 1006, plateH / 608);
  const plateRadius = Math.max(14, Math.min(40, Math.round(PLATE_RADIUS_REF * radiusScale)));
  return { plateW, plateH, plateX, plateY, plateRadius };
}

/* Phase 101 — Stage padding bg (preview .k-studio__stage dark surface
 * parity). Plate'in arkasında dark padding alanı; operator için plate'in
 * stage'den net "kalkmasını" sağlar. */
function buildStageBackgroundSvg(outputW: number, outputH: number): string {
  return `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${outputW}" height="${outputH}" fill="${STAGE_BG_HEX}"/>
  </svg>`;
}

/* Phase 101 — Plate layer (bg + rounded corner + border + drop shadow).
 *
 * Plate'in altına multi-layer drop shadow + plate'in kendisi rounded
 * rect + bg gradient/solid + subtle white-tinted border. Tek SVG'de
 * compose edilir (Sharp tek composite call'unda flatten).
 *
 * Preview chain'in 4 katmanı SVG `<filter>` `<feDropShadow>` ile
 * yaklaşık olarak yansır. Sharp libvips SVG render'ında feDropShadow
 * tam destek var. */
function buildPlateLayerSvg(
  outputW: number,
  outputH: number,
  layout: PlateLayoutOutput,
  scene: FrameSceneInput,
): string {
  const { plateW, plateH, plateX, plateY, plateRadius } = layout;
  const mode = scene.mode;
  let fillAttr: string;
  let defsBlock = "";
  if (mode === "solid" && scene.color) {
    fillAttr = escapeXml(scene.color);
  } else if (mode === "gradient" && scene.color && scene.colorTo) {
    fillAttr = "url(#plate-grad)";
    defsBlock = `<linearGradient id="plate-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${escapeXml(scene.color)}"/>
        <stop offset="100%" stop-color="${escapeXml(scene.colorTo)}"/>
      </linearGradient>`;
  } else {
    // auto + glass (glass also uses underlying palette gradient under overlay)
    const palette = scene.palette;
    const from = palette ? palette[0] : "#F5B27D";
    const to = palette ? palette[1] : "#D97842";
    fillAttr = "url(#plate-grad)";
    defsBlock = `<linearGradient id="plate-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${escapeXml(from)}"/>
        <stop offset="100%" stop-color="${escapeXml(to)}"/>
      </linearGradient>`;
  }
  // Phase 113 (revize — kullanıcı notu: plate kenarında HİÇBİR
  // border/keskin hat istenmiyor). Preview studio.css ile parity:
  // keskin close-edge (s1: dy 2, blur 6) + medium (s2) katmanları
  // KALDIRILDI — plate kenarında "border gibi" keskin koyu hat
  // üretiyorlardı (16:9 glass dark'ta net görünüyordu). Yalnız
  // yumuşak ambient-depth: büyük stdDeviation + büyük dy offset +
  // ince flood-opacity (preview'ın `0 30px 70px -28px / 0 60px
  // 120px -40px` güçlü negatif-spread yumuşak depth katmanlarının
  // SVG karşılığı — feDropShadow'da negatif spread yok, büyük blur
  // + düşük opacity ile yayvan yumuşak gölge). Plate dark
  // padding'den yumuşakça "yüzer", keskin kenar hattı OLUŞMAZ.
  const shadowScale = Math.min(plateW / 1006, plateH / 608);
  const d1Off = Math.max(12, Math.round(30 * shadowScale));
  const d1Blur = Math.max(24, Math.round(60 * shadowScale));
  const d2Off = Math.max(24, Math.round(60 * shadowScale));
  const d2Blur = Math.max(40, Math.round(96 * shadowScale));
  return `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${defsBlock}
      <filter id="plate-shadow" x="-30%" y="-30%" width="160%" height="180%">
        <feDropShadow dx="0" dy="${d1Off}" stdDeviation="${d1Blur}" flood-opacity="0.32"/>
        <feDropShadow dx="0" dy="${d2Off}" stdDeviation="${d2Blur}" flood-opacity="0.30"/>
      </filter>
    </defs>
    <rect x="${plateX}" y="${plateY}" width="${plateW}" height="${plateH}"
      rx="${plateRadius}" ry="${plateRadius}"
      fill="${fillAttr}"
      filter="url(#plate-shadow)"/>
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
function buildGlassOverlayPlateClippedSvg(
  outputW: number,
  outputH: number,
  layout: PlateLayoutOutput,
  variant: FrameGlassVariant,
): string {
  let fill: string;
  if (variant === "dark") {
    fill = "rgba(15,12,8,0.30)";
  } else if (variant === "frosted") {
    fill = "rgba(255,255,255,0.12)";
  } else {
    // light
    fill = "rgba(255,255,255,0.22)";
  }
  // Phase 113 — Glass overlay stroke (border) KALDIRILDI (preview
  // Layer 2b parity: preview glass overlay'inden de `border` +
  // `inset box-shadow` halo temizlendi — plate kenarında istenmeyen
  // inner-border üretiyordu). Glass = plate üstüne yarı-saydam
  // variant-tinted surface treatment (cam-üstü hissi tint ile).
  // Plate alanına clip'lenmiş rounded rect; stage padding glass'tan
  // etkilenmez. Bu layer item layer'ın ALTINDA compose edilir
  // (aşağıdaki composite sırası: plate → glass → cascade) — preview
  // Layer modeli (Layer 1 plate / Layer 2 effect / Layer 3 item)
  // birebir. Glass mockup item'ları ETKİLEMEZ (§11.0 Preview =
  // Export Truth).
  return `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${layout.plateX}" y="${layout.plateY}"
      width="${layout.plateW}" height="${layout.plateH}"
      rx="${layout.plateRadius}" ry="${layout.plateRadius}"
      fill="${fill}"/>
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
  // Phase 105 — productType-aware device shape (preview StageDeviceSVG
  // parity). Backward-compat: undefined → "sticker" (Phase 104 baseline).
  const deviceShape: FrameDeviceShape = input.deviceShape ?? "sticker";

  /* 1) Stage padding bg (preview .k-studio__stage dark surface parity).
   *    Plate'in arkasında dark padding alanı — operator için plate'in
   *    stage'den net "kalkması" hissi. */
  const stageBgSvg = buildStageBackgroundSvg(outputW, outputH);

  /* 2) Plate layout: rounded chrome + bg + border + drop shadow. */
  const plateLayout = resolvePlateLayout(outputW, outputH);
  const plateLayerSvg = buildPlateLayerSvg(outputW, outputH, plateLayout, scene);

  /* 3) Cascade slot composites — Phase 111 plate-relative LOCKED
   *    composition group (Preview = Export Truth §11.0).
   *
   * Phase 101-110 baseline `Math.min(plateW/stageInnerW,
   * plateH/stageInnerH)` stage-inner 572×504 referansını plate'e
   * fit ediyordu. Phase 111 preview'ı (`compositionGroupScale`)
   * cascade'in GERÇEK bbox'ını plate'in PLATE_FILL_FRAC iç
   * alanına aspect-locked bbox-fit edecek şekilde değiştirdi —
   * export aynı mantığı izlemezse preview ≠ export (drift).
   *
   * Phase 111 export fix (preview ile BİREBİR):
   *   (a) Cascade slot positions'ın gerçek bbox'ını hesapla
   *       (stage-inner sabit 572×504 değil — preview centerCascade
   *       bbox'ı 572×504 ortasına hizalar, ama scale GERÇEK bbox
   *       üzerinden).
   *   (b) Group scale = min(targetW/bboxW, targetH/bboxH),
   *       target = plate × PLATE_FILL_FRAC; clamp YOK (plate
   *       büyürse group orantılı büyür — preview parity).
   *   (c) Group bbox center'ı plate center'a hizala (preview:
   *       stage-inner plate ortasında + centerCascade bbox
   *       merkezli → group center = plate center, drift sıfır).
   * Sözleşme #2 stage continuity + #11 + Phase 111 canonical
   * (cascade plate-relative locked group). */
  const FRAME_PLATE_FILL_FRAC = 0.84;
  let bMinX = Infinity,
    bMinY = Infinity,
    bMaxX = -Infinity,
    bMaxY = -Infinity;
  for (const s of slots) {
    bMinX = Math.min(bMinX, s.x);
    bMinY = Math.min(bMinY, s.y);
    bMaxX = Math.max(bMaxX, s.x + s.w);
    bMaxY = Math.max(bMaxY, s.y + s.h);
  }
  const bboxW = Math.max(1, bMaxX - bMinX);
  const bboxH = Math.max(1, bMaxY - bMinY);
  const targetW = plateLayout.plateW * FRAME_PLATE_FILL_FRAC;
  const targetH = plateLayout.plateH * FRAME_PLATE_FILL_FRAC;
  const cascadeScale = Math.min(targetW / bboxW, targetH / bboxH);
  // Group bbox center'ı plate center'a hizala (preview drift-sıfır
  // parity). Scaled bbox = bbox × cascadeScale; offset = plate
  // center − scaled bbox center (bMin'in scaled konumunu çıkar).
  const plateCx = plateLayout.plateX + plateLayout.plateW / 2;
  const plateCy = plateLayout.plateY + plateLayout.plateH / 2;
  const cascadeOffsetX = Math.round(
    plateCx - (bMinX + bboxW / 2) * cascadeScale,
  );
  const cascadeOffsetY = Math.round(
    plateCy - (bMinY + bboxH / 2) * cascadeScale,
  );

  // Phase 126 — Global media-position offset (canonical). SAME
  // resolveMediaOffsetPx as preview outer-wrapper; render space =
  // plate px → resolution-independent parity. {0,0} → +0 (no-op).
  // Plate-area mask (mevcut, bu dosyada) media taşmasını preview
  // overflow:hidden ile aynı şekilde kırpar.
  const mediaOff = resolveMediaOffsetPx(
    input.mediaPosition ?? { x: 0, y: 0 },
    plateLayout.plateW,
    plateLayout.plateH,
  );
  const cascadeOffsetXFinal = Math.round(cascadeOffsetX + mediaOff.ox);
  const cascadeOffsetYFinal = Math.round(cascadeOffsetY + mediaOff.oy);

  // Composite operations array.
  //
  // Phase 102 — Item-level chrome (sözleşme #11 + final visual chrome,
  // editing chrome export'a girmez):
  //
  //   1. **Drop-shadow chain** — preview'da `.k-studio__slot-wrap` CSS
  //      `filter: drop-shadow(0 16px 32px rgba(0,0,0,0.5)) drop-shadow(
  //      0 4px 10px rgba(0,0,0,0.35))` 2-katmanlı item-level shadow var.
  //      Sharp pipeline her slot için ayrı SVG layer (slot bg shadow
  //      mask) compose eder.
  //   2. **Rounded corner mask** — asset 1:1 raw image olsa bile (operator
  //      MJ output) slot'un kendi rounded chrome'u var (preview Phase 102
  //      `.k-studio__slot-wrap` border-radius). Asset SVG `<clipPath>`
  //      rounded rect ile maskelenir.
  //   3. **White outline ring** — Shots.so item border parity; asset'in
  //      üzerine subtle white outline çizilir (`stroke="rgba(255,255,255,
  //      0.18)" stroke-width="2"`).
  //
  // Selection ring + slot badge **export'a girmez** (Phase 94 baseline
  // korunur — slot-ring data-on=false Frame mode'da; badge ise yalnız
  // Mockup mode'da preview-only).
  const slotComposites: sharp.OverlayOptions[] = [];

  // Phase 104 — Item chrome ölçüleri (preview StickerCardSVG parity).
  //
  // Phase 102/103 bug'ı: white edge "ince 2px stroke outline" olarak
  // taklit ediliyordu. Ama preview'daki gerçek chrome (StickerCardSVG):
  //   - rect1: 0,0 W×H rx=r fill=#FFFFFF  → KALIN OPAK BEYAZ DOLGU
  //   - rect2: pad,pad (W-2pad)×(H-2pad) rx=r-4 fill=asset → asset
  //     beyaz çerçevenin İÇİNDE (pad=10px @ 200px slot ≈ %5)
  //   - rect3: 0.5 stroke rgba(0,0,0,0.1) sw=1 → ince koyu inner outline
  // Yani "white edge" = asset'in etrafında polaroid/sticker tarzı
  // **kalın opak beyaz dolgu bandı**, ince saydam stroke DEĞİL. Bu
  // kullanıcının "white edge export'ta kayboluyor" şikayetinin tam
  // kök nedeni — ince rgba(255,255,255,0.18) stroke kalın opak banta
  // karşılık gelmiyordu.
  //
  // Phase 104 fix: preview StickerCardSVG katman yapısı birebir:
  //   - whiteEdge: pad/minDim ≈ %4.5 (preview pad=10 @ 220 = 0.0455)
  //   - outerRadius: r = min(22, minDim×0.16)  (preview rect1 rx)
  //   - innerRadius: r-4  (preview rect2 rx; asset köşesi biraz daha az)
  //   - innerStroke: rgba(0,0,0,0.10) sw≈1  (preview rect3 — koyu hairline)
  const computeItemChrome = (slotOutW: number, slotOutH: number) => {
    const minDim = Math.min(slotOutW, slotOutH);
    // Preview StickerCardSVG: r = min(22, minDim×0.16). Export output
    // dims daha büyük → ratio'yu koru (clamp ile rafine).
    const outerRadius = Math.max(8, Math.min(56, Math.round(minDim * 0.16)));
    // Preview pad=10 @ slot ~200-220 → pad/minDim ≈ 0.045-0.05. White
    // edge bandı bu oranla; min 6px (küçük slot'ta görünür kalsın).
    const whiteEdge = Math.max(6, Math.round(minDim * 0.046));
    // Asset köşesi beyaz çerçevenin içinde biraz daha az rounded
    // (preview rect2 rx = r-4 → outer'a oranla ~%18 az).
    const innerRadius = Math.max(4, Math.round(outerRadius * 0.82));
    // Koyu hairline inner outline (preview rect3 rgba(0,0,0,0.1) sw=1).
    const innerStroke = Math.max(1, Math.round(minDim / 200));
    // Shadow scale (preview slot-wrap filter 16+32 / 4+10 — output
    // dims'e oranla libvips feDropShadow tutarlı 2-katmanlı chain).
    const shadowOffset1 = Math.max(4, Math.round(minDim * 0.08));
    const shadowBlur1 = Math.max(8, Math.round(minDim * 0.16));
    const shadowOffset2 = Math.max(1, Math.round(minDim * 0.02));
    const shadowBlur2 = Math.max(2, Math.round(minDim * 0.05));
    return {
      outerRadius,
      whiteEdge,
      innerRadius,
      innerStroke,
      shadowOffset1,
      shadowBlur1,
      shadowOffset2,
      shadowBlur2,
    };
  };

  for (const slot of slots) {
    if (!slot.imageBuffer) continue; // ghost slot: skip in export

    const slotOutW = Math.max(1, Math.round(slot.w * cascadeScale));
    const slotOutH = Math.max(1, Math.round(slot.h * cascadeScale));
    // Phase 126 — *Final variants include media-position offset
    // (canonical). {0,0} → cascadeOffset*Final === cascadeOffset*
    // (byte-identical no-op; Phase 125 export parity korunur).
    const slotOutX = Math.round(
      slot.x * cascadeScale + cascadeOffsetXFinal,
    );
    const slotOutY = Math.round(
      slot.y * cascadeScale + cascadeOffsetYFinal,
    );

    // Ghost slot opacity (preview parity — Phase 85 baseline).
    if (!slot.assigned) {
      // Skip ghosts in export (operator için unassigned slot'lar export
      // edilmez — production deliverable yalnız assigned cascade gösterir).
      continue;
    }

    // Phase 103 — Item chrome compose order FIX (Preview = Export Truth).
    //
    // Phase 102 bug'ı: asset önce resize **+ rotate** ediliyordu, sonra
    // rounded mask + outline + shadow rotated asset'in büyümüş transparent
    // bbox'ına uygulanıyordu → rounded corner + outline rotated item'da
    // yanlış yerde / kayıp. Studio preview ise CSS `transform:rotate` ile
    // **chrome'lu item'ı bir bütün olarak** döndürüyor (SVG shape rounded
    // + outline rotate'den önce çiziliyor). Sıra terstiydi.
    //
    // Phase 103 doğru sıra (preview parity):
    //   (a) Asset resize (rotate YOK) → axis-aligned asset
    //   (b) Rounded mask asset'in GERÇEK dims'ine uygulanır
    //   (c) Chrome'lu tile compose: shadow base + rounded asset + outline
    //       (hepsi axis-aligned, asset gerçek köşesine hizalı)
    //   (d) Chrome'lu tile'ı BİR BÜTÜN olarak rotate et (preview CSS
    //       `transform:rotate` ile birebir — chrome rotation'la birlikte
    //       döner, rounded corner + outline asset'in gerçek kenarında
    //       kalır)
    //   (e) Rotated tile'ı slot center'a hizala (rotate sonrası bbox
    //       büyür; recenter)

    // (a) Card silhouette dims — axis-aligned (rotation chrome'lu
    // tile'a (d) adımında bir bütün olarak uygulanır). Asset
    // resize/mask (b) adımında inner band için yapılır.
    const assetW = slotOutW;
    const assetH = slotOutH;

    const chrome = computeItemChrome(assetW, assetH);
    const minDim = Math.min(assetW, assetH);
    const padding = Math.ceil(chrome.shadowOffset1 + chrome.shadowBlur1);
    const tileW = assetW + padding * 2;
    const tileH = assetH + padding * 2;
    const cardX = padding;
    const cardY = padding;

    // Phase 105 — Shape-aware tile composite.
    //
    // resolveDeviceShape ile preview StageDeviceSVG shape ailesine
    // map ediliyor:
    //   "frame"   → WallArtFrameSVG parity (koyu frame + krem mat +
    //               asset interior; wall_art/canvas/printable)
    //   "sticker" → StickerCardSVG parity (kalın beyaz edge; Phase 104
    //               baseline; sticker/clipart/bookmark/tshirt fallback)
    //   "bezel"   → PhoneSVG parity (koyu device gövde + screen inset;
    //               phone)
    let slotTilePng: Buffer;

    if (deviceShape === "frame") {
      // ── WallArtFrameSVG parity (svg-art.tsx:876) ──────────────────
      //   rect1: 0,0 W×H rx=3 fill=#1A1612      → koyu ahşap frame
      //   rect2: 1,1 stroke rgba(255,255,255,0.06) sw=1 → frame inner
      //   rect3: frameW,frameW (W-2fw)×(H-2fw) fill=#F5F1E9 → KREM MAT
      //   rect4: innerX,innerY innerW×innerH fill=asset → asset interior
      //   (frameW = minDim×0.045 ≈ preview 9 @ 200; matW = minDim×0.07
      //    ≈ preview 14 @ 200)
      const frameW = Math.max(3, Math.round(minDim * 0.045));
      const matW = Math.max(5, Math.round(minDim * 0.07));
      const innerX = frameW + matW;
      const innerY = frameW + matW;
      const innerW = Math.max(1, assetW - 2 * innerX);
      const innerH = Math.max(1, assetH - 2 * innerY);
      const frameRadius = Math.max(2, Math.round(minDim * 0.015));

      const assetInteriorPng = await sharp(slot.imageBuffer)
        .resize(innerW, innerH, { fit: "cover", position: "centre" })
        .png()
        .toBuffer();

      // layer 1 — shadow base (full frame silhouette)
      const frameShadowSvg = `<svg width="${tileW}" height="${tileH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="slot-sh" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="${chrome.shadowOffset1}"
              stdDeviation="${Math.round(chrome.shadowBlur1 / 2)}"
              flood-color="black" flood-opacity="0.5"/>
            <feDropShadow dx="0" dy="${chrome.shadowOffset2}"
              stdDeviation="${Math.round(chrome.shadowBlur2 / 2)}"
              flood-color="black" flood-opacity="0.35"/>
          </filter>
        </defs>
        <rect x="${cardX}" y="${cardY}"
          width="${assetW}" height="${assetH}"
          rx="${frameRadius}" ry="${frameRadius}"
          fill="black" filter="url(#slot-sh)"/>
      </svg>`;

      // layer 2 — koyu frame + frame inner hairline + KREM MAT
      const frameBodySvg = `<svg width="${tileW}" height="${tileH}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${cardX}" y="${cardY}"
          width="${assetW}" height="${assetH}"
          rx="${frameRadius}" ry="${frameRadius}"
          fill="#1A1612"/>
        <rect x="${cardX + 1}" y="${cardY + 1}"
          width="${assetW - 2}" height="${assetH - 2}"
          rx="${Math.max(1, frameRadius - 1)}" ry="${Math.max(1, frameRadius - 1)}"
          fill="none"
          stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
        <rect x="${cardX + frameW}" y="${cardY + frameW}"
          width="${assetW - 2 * frameW}" height="${assetH - 2 * frameW}"
          fill="#F5F1E9"/>
      </svg>`;

      slotTilePng = await sharp({
        create: {
          width: tileW,
          height: tileH,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          { input: Buffer.from(frameShadowSvg), top: 0, left: 0 },
          { input: Buffer.from(frameBodySvg), top: 0, left: 0 },
          {
            input: assetInteriorPng,
            top: cardY + innerY,
            left: cardX + innerX,
          },
        ])
        .png()
        .toBuffer();
    } else if (deviceShape === "bezel") {
      // ── PhoneSVG parity (svg-art.tsx:201) ─────────────────────────
      // Preview: rect W×H rx=26 fill=#0C0A09 (koyu gövde) + screen
      // x=bz y=bz*2 sw=W-bz*2 sh=H-bz*3 rx=sr (ASİMETRİK bezel —
      // üst sy=bz*2, alt H-bz*3 daha kalın) + camera notch
      // w/2-16,sy+7,32×9 #0C0A09 + outer hairline rgba(255,255,255,
      // 0.07). bz=10 @ ref ≈ minDim×0.05.
      const bz = Math.max(3, Math.round(minDim * 0.05));
      const bodyRadius = Math.max(10, Math.round(minDim * 0.13));
      const screenRadius = Math.max(6, bodyRadius - bz);
      // Asimetrik: screen x=bz, y=bz*2 (üst bezel ×2), sw=W-bz*2,
      // sh=H-bz*3 (alt bezel daha kalın — preview parity).
      const screenX = bz;
      const screenY = bz * 2;
      const screenW = Math.max(1, assetW - bz * 2);
      const screenH = Math.max(1, assetH - bz * 3);
      // Notch (preview w/2-16,sy+7,32×9 → minDim'e oranla).
      const notchW = Math.max(8, Math.round(minDim * 0.16));
      const notchH = Math.max(3, Math.round(minDim * 0.045));
      const notchX = Math.round(assetW / 2 - notchW / 2);
      const notchY = screenY + Math.max(2, Math.round(minDim * 0.035));

      const screenAssetPng = await sharp(slot.imageBuffer)
        .resize(screenW, screenH, { fit: "cover", position: "centre" })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${screenW}" height="${screenH}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${screenW}" height="${screenH}"
                  rx="${screenRadius}" ry="${screenRadius}" fill="white"/>
              </svg>`,
            ),
            blend: "dest-in",
          },
        ])
        .png()
        .toBuffer();

      const bezelShadowSvg = `<svg width="${tileW}" height="${tileH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="slot-sh" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="${chrome.shadowOffset1}"
              stdDeviation="${Math.round(chrome.shadowBlur1 / 2)}"
              flood-color="black" flood-opacity="0.5"/>
            <feDropShadow dx="0" dy="${chrome.shadowOffset2}"
              stdDeviation="${Math.round(chrome.shadowBlur2 / 2)}"
              flood-color="black" flood-opacity="0.35"/>
          </filter>
        </defs>
        <rect x="${cardX}" y="${cardY}"
          width="${assetW}" height="${assetH}"
          rx="${bodyRadius}" ry="${bodyRadius}"
          fill="black" filter="url(#slot-sh)"/>
      </svg>`;

      // Phase 107 — PhoneSVG ek chrome detayları (preview parity):
      //   side buttons (x=-1.5/w-1.5 → gövde kenarına bitişik koyu
      //   tuşlar #080706), speaker slot (w/2-20,h-bz-5,40×3.5
      //   rgba(255,255,255,0.12)), screen sheen overlay (üst+alt
      //   gradient gloss). bodyRadius=minDim×0.13, side button
      //   genişlik 3 @ w=200 ≈ minDim×0.015, gövde kenarına yapışık.
      const sbW = Math.max(2, Math.round(minDim * 0.015));
      const sbLU = { y: assetH * 0.28, h: assetH * 0.044 }; // sol üst (h=18@408≈0.044)
      const sbLL = { y: assetH * 0.37, h: assetH * 0.066 }; // sol alt (h=27@408≈0.066)
      const sbR = { y: assetH * 0.31, h: assetH * 0.083 }; // sağ (h=34@408≈0.083)
      const sbR2 = Math.max(1, Math.round(sbW / 2));
      const spkW = Math.max(8, Math.round(assetW * 0.2)); // w/2-20→40@200=0.2
      const spkH = Math.max(2, Math.round(minDim * 0.017)); // 3.5@200≈0.017
      const spkX = Math.round(assetW / 2 - spkW / 2);
      const spkY = Math.round(assetH - bz - Math.max(3, Math.round(minDim * 0.025)));

      // Body + side buttons + speaker slot (preview rect1 + side
      // buttons + speaker; screen'in altında — asset compose'tan önce).
      const bezelBodySvg = `<svg width="${tileW}" height="${tileH}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${cardX}" y="${cardY}"
          width="${assetW}" height="${assetH}"
          rx="${bodyRadius}" ry="${bodyRadius}"
          fill="#0C0A09"/>
        <rect x="${cardX - Math.round(sbW / 2)}" y="${cardY + sbLU.y}"
          width="${sbW}" height="${sbLU.h}"
          rx="${sbR2}" ry="${sbR2}" fill="#080706"/>
        <rect x="${cardX - Math.round(sbW / 2)}" y="${cardY + sbLL.y}"
          width="${sbW}" height="${sbLL.h}"
          rx="${sbR2}" ry="${sbR2}" fill="#080706"/>
        <rect x="${cardX + assetW - Math.round(sbW / 2)}" y="${cardY + sbR.y}"
          width="${sbW}" height="${sbR.h}"
          rx="${sbR2}" ry="${sbR2}" fill="#080706"/>
      </svg>`;

      // Screen sheen overlay (preview sid/rid gradient gloss — asset
      // compose'tan sonra, notch'tan önce).
      const bezelSheenSvg = `<svg width="${tileW}" height="${tileH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ph-sheen-t" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(255,255,255,0.13)"/>
            <stop offset="60%" stop-color="rgba(255,255,255,0.02)"/>
            <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
          </linearGradient>
          <linearGradient id="ph-sheen-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
            <stop offset="100%" stop-color="rgba(255,255,255,0.04)"/>
          </linearGradient>
          <clipPath id="ph-screen-clip">
            <rect x="${cardX + screenX}" y="${cardY + screenY}"
              width="${screenW}" height="${screenH}"
              rx="${screenRadius}" ry="${screenRadius}"/>
          </clipPath>
        </defs>
        <g clip-path="url(#ph-screen-clip)">
          <rect x="${cardX + screenX}" y="${cardY + screenY}"
            width="${screenW}" height="${Math.round(screenH * 0.48)}"
            fill="url(#ph-sheen-t)"/>
          <rect x="${cardX + screenX}" y="${cardY + screenY + Math.round(screenH * 0.55)}"
            width="${screenW}" height="${Math.round(screenH * 0.45)}"
            fill="url(#ph-sheen-b)"/>
        </g>
      </svg>`;

      const bezelNotchSvg = `<svg width="${tileW}" height="${tileH}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${cardX + notchX}" y="${cardY + notchY}"
          width="${notchW}" height="${notchH}"
          rx="${Math.round(notchH / 2)}" ry="${Math.round(notchH / 2)}"
          fill="#0C0A09"/>
        <rect x="${cardX + spkX}" y="${cardY + spkY}"
          width="${spkW}" height="${spkH}"
          rx="${Math.round(spkH / 2)}" ry="${Math.round(spkH / 2)}"
          fill="rgba(255,255,255,0.12)"/>
        <rect x="${cardX + 0.5}" y="${cardY + 0.5}"
          width="${assetW - 1}" height="${assetH - 1}"
          rx="${bodyRadius - 0.5}" ry="${bodyRadius - 0.5}"
          fill="none"
          stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      </svg>`;

      slotTilePng = await sharp({
        create: {
          width: tileW,
          height: tileH,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          { input: Buffer.from(bezelShadowSvg), top: 0, left: 0 },
          { input: Buffer.from(bezelBodySvg), top: 0, left: 0 },
          {
            input: screenAssetPng,
            top: cardY + screenY,
            left: cardX + screenX,
          },
          // Screen sheen → notch + speaker + hairline (preview:
          // sheen screen gradient'inden sonra, notch sheen'den sonra).
          { input: Buffer.from(bezelSheenSvg), top: 0, left: 0 },
          { input: Buffer.from(bezelNotchSvg), top: 0, left: 0 },
        ])
        .png()
        .toBuffer();
    } else if (deviceShape === "bookmark") {
      // ── BookmarkStripSVG parity (svg-art.tsx:988) ─────────────────
      // Preview: tassel knot circle (w/2,knotR+1,r=6 #3A3532) + ip
      // line (w/2,13→20) + body rect (4,20,W-8,H-28 rx=3 fill=
      // gradient) + asset clip + inner outline (4.5,20.5 stroke
      // rgba(0,0,0,0.18) sw=1). Dar dikey strip.
      const knotR = Math.max(3, Math.round(minDim * 0.075));
      const knotCy = knotR + 1;
      const bodyTop = Math.max(knotR * 2 + 4, Math.round(assetH * 0.07));
      const bodyMargin = Math.max(2, Math.round(assetW * 0.05));
      const bodyX = bodyMargin;
      const bodyY = bodyTop;
      const bodyW = Math.max(1, assetW - 2 * bodyMargin);
      const bodyH = Math.max(1, assetH - bodyTop - bodyMargin);
      const bodyR = Math.max(2, Math.round(minDim * 0.04));

      const bookmarkAssetPng = await sharp(slot.imageBuffer)
        .resize(bodyW, bodyH, { fit: "cover", position: "centre" })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${bodyW}" height="${bodyH}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${bodyW}" height="${bodyH}"
                  rx="${bodyR}" ry="${bodyR}" fill="white"/>
              </svg>`,
            ),
            blend: "dest-in",
          },
        ])
        .png()
        .toBuffer();

      const bookmarkShadowSvg = `<svg width="${tileW}" height="${tileH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="slot-sh" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="${chrome.shadowOffset1}"
              stdDeviation="${Math.round(chrome.shadowBlur1 / 2)}"
              flood-color="black" flood-opacity="0.5"/>
            <feDropShadow dx="0" dy="${chrome.shadowOffset2}"
              stdDeviation="${Math.round(chrome.shadowBlur2 / 2)}"
              flood-color="black" flood-opacity="0.35"/>
          </filter>
        </defs>
        <rect x="${cardX + bodyX}" y="${cardY + bodyY}"
          width="${bodyW}" height="${bodyH}"
          rx="${bodyR}" ry="${bodyR}"
          fill="black" filter="url(#slot-sh)"/>
      </svg>`;

      // Tassel knot + ip line (preview circle + line, body'nin üstünde)
      const bookmarkKnotSvg = `<svg width="${tileW}" height="${tileH}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${cardX + assetW / 2}" cy="${cardY + knotCy}"
          r="${knotR}" fill="#3A3532"/>
        <line x1="${cardX + assetW / 2}" y1="${cardY + knotR * 2 + 1}"
          x2="${cardX + assetW / 2}" y2="${cardY + bodyY}"
          stroke="#3A3532" stroke-width="${Math.max(1, Math.round(minDim / 60))}"/>
      </svg>`;

      const bookmarkOutlineSvg = `<svg width="${tileW}" height="${tileH}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${cardX + bodyX + 0.5}" y="${cardY + bodyY + 0.5}"
          width="${bodyW - 1}" height="${bodyH - 1}"
          rx="${Math.max(1, bodyR - 0.5)}" ry="${Math.max(1, bodyR - 0.5)}"
          fill="none"
          stroke="rgba(0,0,0,0.18)" stroke-width="${chrome.innerStroke}"/>
      </svg>`;

      slotTilePng = await sharp({
        create: {
          width: tileW,
          height: tileH,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          { input: Buffer.from(bookmarkShadowSvg), top: 0, left: 0 },
          { input: Buffer.from(bookmarkKnotSvg), top: 0, left: 0 },
          {
            input: bookmarkAssetPng,
            top: cardY + bodyY,
            left: cardX + bodyX,
          },
          { input: Buffer.from(bookmarkOutlineSvg), top: 0, left: 0 },
        ])
        .png()
        .toBuffer();
    } else if (deviceShape === "garment" || deviceShape === "garment-hooded") {
      // ── TshirtSilhouetteSVG parity (svg-art.tsx:1047) ─────────────
      // Preview: shadow ellipse + garment body path (omuz+kol+gövde
      // fill=#2A2622) + [hooded ? hood ellipse #2A2622] + neckline
      // ellipse (#161412) + chest area asset (chestX,chestY,chestW×
      // chestH rx=4). Path-based silüet. Phase 108: hoodie → hood
      // ellipse (svg-art.tsx:1095 parity).
      const isHooded = deviceShape === "garment-hooded";
      const cx = assetW / 2;
      const shoulderY = assetH * 0.18;
      const sleeveOffset = assetW * 0.18;
      const bodyW = assetW * 0.62;
      const bodyX = cx - bodyW / 2;
      const bodyY = shoulderY + assetH * 0.04;
      const chestW = bodyW * 0.7;
      const chestH = bodyW * 0.7;
      const chestX = cx - chestW / 2;
      const chestY = bodyY + (assetH - bodyY - assetH * 0.04) * 0.18;
      const chestR = Math.max(3, Math.round(minDim * 0.02));
      const garmentPath = `
        M ${cardX + cx - bodyW / 2} ${cardY + shoulderY}
        Q ${cardX + cx - bodyW / 2 - sleeveOffset} ${cardY + shoulderY + assetH * 0.04} ${cardX + cx - bodyW / 2 - sleeveOffset * 0.6} ${cardY + shoulderY + assetH * 0.16}
        L ${cardX + cx - bodyW / 2} ${cardY + shoulderY + assetH * 0.2}
        L ${cardX + bodyX} ${cardY + assetH - bodyY * 0.5}
        L ${cardX + bodyX + bodyW} ${cardY + assetH - bodyY * 0.5}
        L ${cardX + cx + bodyW / 2} ${cardY + shoulderY + assetH * 0.2}
        L ${cardX + cx + bodyW / 2 + sleeveOffset * 0.6} ${cardY + shoulderY + assetH * 0.16}
        Q ${cardX + cx + bodyW / 2 + sleeveOffset} ${cardY + shoulderY + assetH * 0.04} ${cardX + cx + bodyW / 2} ${cardY + shoulderY}
        Z`;

      const chestAssetPng = await sharp(slot.imageBuffer)
        .resize(Math.max(1, Math.round(chestW)), Math.max(1, Math.round(chestH)), {
          fit: "cover",
          position: "centre",
        })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${Math.round(chestW)}" height="${Math.round(chestH)}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${Math.round(chestW)}" height="${Math.round(chestH)}"
                  rx="${chestR}" ry="${chestR}" fill="white"/>
              </svg>`,
            ),
            blend: "dest-in",
          },
        ])
        .png()
        .toBuffer();

      const garmentShadowSvg = `<svg width="${tileW}" height="${tileH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="slot-sh" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="${chrome.shadowOffset1}"
              stdDeviation="${Math.round(chrome.shadowBlur1 / 2)}"
              flood-color="black" flood-opacity="0.5"/>
            <feDropShadow dx="0" dy="${chrome.shadowOffset2}"
              stdDeviation="${Math.round(chrome.shadowBlur2 / 2)}"
              flood-color="black" flood-opacity="0.35"/>
          </filter>
        </defs>
        <path d="${garmentPath}" fill="black" filter="url(#slot-sh)"/>
      </svg>`;

      // Garment body + [hood] + neckline (preview svg-art.tsx:1080-
      // 1099 katman sırası: path #2A2622 → hood ellipse #2A2622
      // (hooded) → neckline ellipse #161412).
      const hoodSvg = isHooded
        ? `<ellipse cx="${cardX + cx}" cy="${cardY + shoulderY - assetH * 0.04}"
            rx="${assetW * 0.18}" ry="${assetH * 0.08}" fill="#2A2622"/>`
        : "";
      const garmentBodySvg = `<svg width="${tileW}" height="${tileH}" xmlns="http://www.w3.org/2000/svg">
        <path d="${garmentPath}" fill="#2A2622"/>
        ${hoodSvg}
        <ellipse cx="${cardX + cx}" cy="${cardY + shoulderY + 4}"
          rx="${assetW * 0.12}" ry="${assetH * 0.05}" fill="#161412"/>
      </svg>`;

      slotTilePng = await sharp({
        create: {
          width: tileW,
          height: tileH,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          { input: Buffer.from(garmentShadowSvg), top: 0, left: 0 },
          { input: Buffer.from(garmentBodySvg), top: 0, left: 0 },
          {
            input: chestAssetPng,
            top: Math.round(cardY + chestY),
            left: Math.round(cardX + chestX),
          },
        ])
        .png()
        .toBuffer();
    } else {
      // ── StickerCardSVG parity (Phase 104 baseline) ────────────────
      // (b) Asset'i INNER rounded rect ile mask et — preview rect2
      // (asset surface, rx=innerRadius, beyaz çerçevenin İÇİNDE).
      const innerAssetW = Math.max(1, assetW - 2 * chrome.whiteEdge);
      const innerAssetH = Math.max(1, assetH - 2 * chrome.whiteEdge);
      const innerAssetPng = await sharp(slot.imageBuffer)
        .resize(innerAssetW, innerAssetH, { fit: "cover", position: "centre" })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${innerAssetW}" height="${innerAssetH}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${innerAssetW}" height="${innerAssetH}"
                  rx="${chrome.innerRadius}" ry="${chrome.innerRadius}"
                  fill="white"/>
              </svg>`,
            ),
            blend: "dest-in",
          },
        ])
        .png()
        .toBuffer();

      // (c) Chrome'lu tile compose (preview StickerCardSVG 3-katman):
      //   layer 1: shadow base (rounded card silhouette + feDropShadow)
      //   layer 2: OUTER WHITE EDGE — kalın opak beyaz dolgu rect
      //   layer 3: inner asset (pad=whiteEdge içeride, rx=innerRadius)
      //   layer 4: koyu hairline inner outline (preview rect3)
      const shadowSvg = `<svg width="${tileW}" height="${tileH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="slot-sh" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="${chrome.shadowOffset1}"
              stdDeviation="${Math.round(chrome.shadowBlur1 / 2)}"
              flood-color="black" flood-opacity="0.5"/>
            <feDropShadow dx="0" dy="${chrome.shadowOffset2}"
              stdDeviation="${Math.round(chrome.shadowBlur2 / 2)}"
              flood-color="black" flood-opacity="0.35"/>
          </filter>
        </defs>
        <rect x="${cardX}" y="${cardY}"
          width="${assetW}" height="${assetH}"
          rx="${chrome.outerRadius}" ry="${chrome.outerRadius}"
          fill="black" filter="url(#slot-sh)"/>
      </svg>`;

      const whiteEdgeSvg = `<svg width="${tileW}" height="${tileH}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${cardX}" y="${cardY}"
          width="${assetW}" height="${assetH}"
          rx="${chrome.outerRadius}" ry="${chrome.outerRadius}"
          fill="#FFFFFF"/>
        <rect x="${cardX + 0.5}" y="${cardY + 0.5}"
          width="${assetW - 1}" height="${assetH - 1}"
          rx="${chrome.outerRadius - 0.5}" ry="${chrome.outerRadius - 0.5}"
          fill="none"
          stroke="rgba(0,0,0,0.10)" stroke-width="${chrome.innerStroke}"/>
      </svg>`;

      slotTilePng = await sharp({
        create: {
          width: tileW,
          height: tileH,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          { input: Buffer.from(shadowSvg), top: 0, left: 0 },
          { input: Buffer.from(whiteEdgeSvg), top: 0, left: 0 },
          {
            input: innerAssetPng,
            top: cardY + chrome.whiteEdge,
            left: cardX + chrome.whiteEdge,
          },
        ])
        .png()
        .toBuffer();
    }

    // (d) Chrome'lu tile'ı BİR BÜTÜN olarak rotate et — preview CSS
    // `transform:rotate(${r}deg)` parity. Rounded corner + outline +
    // shadow chrome rotation'la birlikte döner (asset'in gerçek
    // kenarında kalır, transparent bbox'a değil).
    let tileFinalW = tileW;
    let tileFinalH = tileH;
    if (slot.r && slot.r !== 0) {
      slotTilePng = await sharp(slotTilePng)
        .rotate(slot.r, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      const rotMeta = await sharp(slotTilePng).metadata();
      tileFinalW = rotMeta.width ?? tileW;
      tileFinalH = rotMeta.height ?? tileH;
    }

    // (e) Rotated tile'ı slot center'a hizala. Slot'un mantıksal merkezi
    // (slotOutX + slotOutW/2, slotOutY + slotOutH/2); rotate sonrası tile
    // bbox büyüdüğü için tile'ı kendi merkezine göre yerleştir.
    const slotCenterX = slotOutX + slotOutW / 2;
    const slotCenterY = slotOutY + slotOutH / 2;

    /* Phase 114 — Tile-fits-canvas guard (Preview = Export Truth
     * §11.0 + export pipeline robustness).
     *
     * Phase 114 layoutVariant'lar (fan/stacked/offset) cascade'den
     * geniş yayılım üretir; rotated tile bbox şişer. Bazı variant +
     * aspect kombinasyonunda slot tile output canvas'tan BÜYÜK
     * çıkıyordu → Sharp `composite` "Image to composite must have
     * same dimensions or smaller" 500 (latent bug; cascade dar
     * olduğu için Phase 113'e kadar tetiklenmiyordu, Phase 114
     * variant'lar açığa çıkardı).
     *
     * Fix: tile output canvas'tan büyükse (her iki eksende) aspect-
     * korumalı resize-down (tile kompozisyon karakterini korur,
     * yalnız canvas'a sığar — preview compositionGroup plate-fit
     * mantığıyla aynı niyet). Sonra position [0, output-tile]
     * aralığına clamp (sağ/alt taşma da kesilir; eski sadece
     * Math.max(0,…) sol/üst taşmayı kesiyordu — eksikti). */
    let compTile = slotTilePng;
    let compW = tileFinalW;
    let compH = tileFinalH;
    if (compW > outputW || compH > outputH) {
      const fit = Math.min(outputW / compW, outputH / compH);
      compW = Math.max(1, Math.floor(compW * fit));
      compH = Math.max(1, Math.floor(compH * fit));
      compTile = await sharp(slotTilePng)
        .resize(compW, compH, { fit: "inside" })
        .png()
        .toBuffer();
    }
    const finalX = Math.round(slotCenterX - compW / 2);
    const finalY = Math.round(slotCenterY - compH / 2);
    // Position clamp: tile tamamen canvas içinde (sol/üst + sağ/alt).
    const clampedLeft = Math.min(
      Math.max(0, finalX),
      Math.max(0, outputW - compW),
    );
    const clampedTop = Math.min(
      Math.max(0, finalY),
      Math.max(0, outputH - compH),
    );

    slotComposites.push({
      input: compTile,
      top: clampedTop,
      left: clampedLeft,
    });
  }

  /* Phase 113 — Plate-local layered effects model (Preview = Export
   * Truth §11.0). Preview MockupStudioStage.tsx Layer modeli:
   *
   *   Layer 1: plate base   (k-studio__stage-plate bg)
   *   Layer 2: effect layer (glass overlay + lens blur surface) —
   *            cascade'in ALTINDA (z-index 0/1)
   *   Layer 3: item layer   (cascade, z-index 2) — effect'ten
   *            ETKİLENMEZ (glass tint + blur item'lara değmez)
   *
   * Eski export (Phase 101-112): cascade önce compose ediliyor,
   * glass overlay EN SON cascade'in ÜSTÜNE → glass yarı-saydam fill
   * cascade item'larını da tint'liyordu (preview'da glass cascade'in
   * ALTINDA → item'ları etkilemiyor). Bu Preview ≠ Export
   * divergence + glass dark'ta item'larda istenmeyen tint/halo.
   *
   * Phase 113 compose sırası (preview Layer parity):
   *   1. stage bg + plate layer            (Layer 1, cascade YOK)
   *   2. glass overlay                     (Layer 2, plate üstüne)
   *   3. lens blur (plate-area, Layer 1+2) (Layer 2, cascade YOK)
   *   4. cascade slotComposites EN ÜSTE    (Layer 3, glass+blur'dan
   *      ETKİLENMEZ — preview cascade z-index 2 birebir)
   *
   * Sözleşme #2 stage continuity + #11 + Phase 113 canonical
   * (plate-local layered effects; item layer effect-bağımsız). */

  /* 4) Layer 1 — Stage bg + plate base (cascade YOK). */
  let canvasBuffer = await sharp(Buffer.from(stageBgSvg))
    .composite([{ input: Buffer.from(plateLayerSvg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  /* Phase 136 — BG Effects çözümü (preview = export aynı pure-TS
   *  resolver §11.0). mode:"auto" dummy — bgEffect mode'dan
   *  bağımsız tek-seçimli eksen §4. undefined → vignetteAlpha=0
   *  && grainOpacity=0 → aşağıdaki iki guard da false → hiçbir
   *  composite çalışmaz = byte-identical no-op (Phase 135 baseline
   *  bitwise korunur). */
  const bgFx = resolvePlateEffects({
    mode: "auto",
    bgEffect: scene.bgEffect,
  });

  /* 4b) Layer 1b — Grain (deterministik monokrom; preview SVG
   *     feTurbulence ile algısal eşdeğer — §11.0 parity, bit-exact
   *     DEĞİL). Compositing order SABİT (bağlam §4 + Task 3 preview
   *     parity): bg → GRAIN → glass → blur → cascade → vignette.
   *     Grain bg'nin parçası → glass + lens-blur onu YUMUŞATIR
   *     (istenen; film-grain hissi, dijital RGB gürültü değil §4).
   *     plate-area dest-in mask = blur bloğu plateMaskSvg pattern'i
   *     (aynı plate koordinatları). dest-in mask rect'i ayrıca
   *     fill-opacity=grainOpacity taşır → plate-clip + global alpha
   *     TEK adımda (ensureAlpha Sharp'ta NO-OP: grainPlate zaten
   *     channels:4 → alpha kanalı VAR → ensureAlpha hiçbir şey
   *     yapmazdı, grain ~%100 opak basardı = §11.0 ihlali). Preview
   *     MockupStudioStage.tsx grain bloğu ile SENKRON tutulmalı
   *     (compositing order + alpha değişirse ikisi birlikte). */
  if (bgFx.grainOpacity > 0) {
    const grainTile = await sharp({
      create: {
        width: 160,
        height: 160,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
        noise: { type: "gaussian", mean: 128, sigma: 36 },
      },
    })
      .greyscale()
      .png()
      .toBuffer();
    const grainPlate = await sharp({
      create: {
        width: outputW,
        height: outputH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: grainTile, tile: true, blend: "over" },
        {
          input: Buffer.from(
            `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg"><rect x="${plateLayout.plateX}" y="${plateLayout.plateY}" width="${plateLayout.plateW}" height="${plateLayout.plateH}" rx="${plateLayout.plateRadius}" ry="${plateLayout.plateRadius}" fill="white" fill-opacity="${bgFx.grainOpacity}"/></svg>`,
          ),
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();
    canvasBuffer = await sharp(canvasBuffer)
      .composite([{ input: grainPlate, top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  /* 5) Layer 2a — Glass overlay (plate üstüne, cascade'DEN ÖNCE).
   *    Preview k-studio__plate-glass z-index 1, cascade z-index 2.
   *    Glass = plate üstü variant-tinted surface treatment; item'a
   *    değil plate'e (preview Layer 2b parity). */
  if (scene.mode === "glass") {
    const variant = scene.glassVariant ?? "light";
    const glassSvg = buildGlassOverlayPlateClippedSvg(
      outputW,
      outputH,
      plateLayout,
      variant,
    );
    canvasBuffer = await sharp(canvasBuffer)
      .composite([{ input: Buffer.from(glassSvg) }])
      .png()
      .toBuffer();
  }

  /* 6) Layer 2b — Lens Blur (Phase 109 STRUCTURED targeting,
   *    Preview = Export Truth §11.0). Cascade hâlâ compose
   *    EDİLMEDİ → her iki target'ta da plate bg + glass (Layer
   *    1+2) blur, cascade (Layer 3) ASLA blur değil.
   *
   * Phase 113 — target "all" vs "plate" ARTIK aynı export
   * davranış: ikisi de plate-area (stage padding NET) bg blur,
   * cascade üstte keskin. "all" eski semantiği (cascade dahil
   * blur) Phase 113 layered model ile geçersiz — item layer
   * effect-bağımsız (operatör eğilimi + §11.0). Backward-compat:
   * legacy boolean true → "all" normalize; davranış yeni model
   * (item NET). */
  const lb = normalizeFrameLensBlur(scene.lensBlur);
  if (lb.enabled) {
    const sigma = FRAME_LENS_BLUR_SIGMA[lb.intensity];
    const plateMaskSvg = `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${plateLayout.plateX}" y="${plateLayout.plateY}"
        width="${plateLayout.plateW}" height="${plateLayout.plateH}"
        rx="${plateLayout.plateRadius}" ry="${plateLayout.plateRadius}"
        fill="white"/>
    </svg>`;
    // canvasBuffer şu an = stage bg + plate + glass (cascade YOK).
    // Tümünü blur → plate-area rounded mask → net canvas'a geri
    // composite (stage padding NET).
    const blurredCanvas = await sharp(canvasBuffer)
      .blur(sigma)
      .png()
      .toBuffer();
    const blurredPlateRegion = await sharp(blurredCanvas)
      .composite([{ input: Buffer.from(plateMaskSvg), blend: "dest-in" }])
      .png()
      .toBuffer();
    canvasBuffer = await sharp(canvasBuffer)
      .composite([{ input: blurredPlateRegion, top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  /* 7) Layer 3 — Cascade slotComposites EN ÜSTE (glass + blur'dan
   *    ETKİLENMEZ; preview cascade z-index 2 birebir). Item layer
   *    keskin — operatör eğilimi + Preview = Export Truth §11.0. */
  if (slotComposites.length > 0) {
    canvasBuffer = await sharp(canvasBuffer)
      .composite(slotComposites)
      .png()
      .toBuffer();
  }

  /* 7b) Layer 4 — Vignette EN ÜSTTE (cascade + glass + blur'dan
   *     SONRA; lens kenar karartması optik son katman §4 — preview
   *     zIndex:9 > cascade z:2 birebir). Merkez ~%60 ŞEFFAF
   *     (offset 60% rgba(0,0,0,0) → 100% rgba(0,0,0,α)) → subject/
   *     portrait boğmaz §4 guardrail. radialGradient Sharp raw API'de
   *     yok → SVG radial gradient PNG composite (preview CSS radial-
   *     gradient ile aynı stop'lar = §11.0 parity). plate-area
   *     clipped (plateMaskSvg ile aynı koordinatlar). */
  if (bgFx.vignetteAlpha > 0) {
    const vignetteSvg = `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="v" cx="50%" cy="50%" r="50%">
        <stop offset="60%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,${bgFx.vignetteAlpha})"/>
      </radialGradient></defs>
      <rect x="${plateLayout.plateX}" y="${plateLayout.plateY}"
        width="${plateLayout.plateW}" height="${plateLayout.plateH}"
        rx="${plateLayout.plateRadius}" ry="${plateLayout.plateRadius}"
        fill="url(#v)"/>
    </svg>`;
    canvasBuffer = await sharp(canvasBuffer)
      .composite([{ input: Buffer.from(vignetteSvg), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  /* 7c) Layer 5 — Watermark (text) EN ÜSTTE: vignette (7b)
   *      sonrası, cascade + tüm layer'ların üstünde. Preview
   *      MockupStudioStage watermark overlay (z:10) ile AYNI
   *      resolveWatermarkLayout → §11.0 Preview = Export Truth.
   *
   *  KRİTİK PARİTE: preview overlay `.k-studio__stage-plate`
   *  ELEMENT'inin İÇİNDE (`position:absolute; inset:0`,
   *  `overflow:hidden`) — glyph `left/top` % = PLATE
   *  dikdörtgeninin yüzdesi, font = min(plateDims.w,plateDims.h)
   *  × fontPctOfMin. Plate canvas'ı DOLDURMAZ (PLATE_FILL_RATIO
   *  < 1; stage padding var → plateX/plateY offset). Bu yüzden
   *  export'ta glyph konumu + font, FULL canvas (outputW/outputH)
   *  DEĞİL `plateLayout.plate{X,Y,W,H}` PLATE bölgesine map
   *  edilir (vignette 7b + grain 4b ile AYNI plate koordinatları).
   *  Aksi halde yPct:93 → 93% × 1080 ≈ plate ALTINDA (dark stage
   *  padding) = preview ile STRÜKTÜREL ayrışma. computeFrameCanvasDims
   *  KULLANILMAZ — plateLayout zaten bu fn'de resolvePlateLayout(
   *  outputW,outputH) ile çözülmüş canonical plate geometrisi
   *  (preview plateDims ile AYNI FRAME_ASPECT_CONFIG aspect-kilit
   *  → glyph yüzde geometrisi ratio-invariant). tile placement
   *  off-plate glyph üretir → preview `overflow:hidden` eşdeğeri
   *  clipPath ile plate'e kırpılır. */
  {
    const { plateX, plateY, plateW, plateH, plateRadius } = plateLayout;
    const wmLayout = resolveWatermarkLayout(scene.watermark, {
      w: plateW,
      h: plateH,
    });
    if (wmLayout.active) {
      const fontPx = Math.min(plateW, plateH) * wmLayout.fontPctOfMin;
      const texts = wmLayout.glyphs
        .map((g) => {
          const x = plateX + (g.xPct / 100) * plateW;
          const y = plateY + (g.yPct / 100) * plateH;
          return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="${wmLayout.anchor}" dominant-baseline="middle" font-family="sans-serif" font-weight="600" font-size="${fontPx.toFixed(2)}" fill="rgba(255,255,255,${wmLayout.opacity})" transform="rotate(${g.rotateDeg} ${x.toFixed(2)} ${y.toFixed(2)})">${escapeXml(g.text)}</text>`;
        })
        .join("");
      const wmSvg = `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="wmclip"><rect x="${plateX}" y="${plateY}" width="${plateW}" height="${plateH}" rx="${plateRadius}" ry="${plateRadius}"/></clipPath></defs><g clip-path="url(#wmclip)">${texts}</g></svg>`;
      canvasBuffer = await sharp(canvasBuffer)
        .composite([{ input: Buffer.from(wmSvg), top: 0, left: 0 }])
        .png()
        .toBuffer();
    }
  }

  /* 8) Final PNG encode. */
  return await sharp(canvasBuffer).png({ compressionLevel: 9 }).toBuffer();
}
