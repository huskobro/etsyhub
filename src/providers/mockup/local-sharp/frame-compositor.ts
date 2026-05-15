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

/* Phase 101 — Plate chrome parity (Studio preview ↔ export aynı görsel
 * aileden gelir; sözleşme #1 + #11).
 *
 * Studio preview'da plate canonical chrome (DOM ölçümlerinden):
 *   - border-radius: 26px
 *   - border: 2px solid rgba(255,255,255,0.18)
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
  // Preview 4-katmanlı drop shadow chain'i SVG feDropShadow ile
  // yansıt. Output dims'e oranla scale (preview shadow offset'leri
  // CSS px; output px'e dönüşürken min radius guard).
  const shadowScale = Math.min(plateW / 1006, plateH / 608);
  const s1Off = Math.max(1, Math.round(2 * shadowScale));
  const s1Blur = Math.max(2, Math.round(6 * shadowScale));
  const s2Off = Math.max(4, Math.round(12 * shadowScale));
  const s2Blur = Math.max(8, Math.round(28 * shadowScale));
  const s3Off = Math.max(12, Math.round(36 * shadowScale));
  const s3Blur = Math.max(16, Math.round(80 * shadowScale));
  return `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${defsBlock}
      <filter id="plate-shadow" x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="${s1Off}" stdDeviation="${s1Blur}" flood-opacity="0.35"/>
        <feDropShadow dx="0" dy="${s2Off}" stdDeviation="${s2Blur}" flood-opacity="0.45"/>
        <feDropShadow dx="0" dy="${s3Off}" stdDeviation="${s3Blur}" flood-opacity="0.55"/>
      </filter>
    </defs>
    <rect x="${plateX}" y="${plateY}" width="${plateW}" height="${plateH}"
      rx="${plateRadius}" ry="${plateRadius}"
      fill="${fillAttr}"
      stroke="rgba(255,255,255,0.18)" stroke-width="2"
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
  // Phase 101 — Glass overlay artık plate alanına clip'lenmiş rounded
  // rect (preview parity: backdrop-filter plate parent'a uygulanıyordu).
  // Stage padding alanı glass'tan etkilenmez.
  return `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${layout.plateX}" y="${layout.plateY}"
      width="${layout.plateW}" height="${layout.plateH}"
      rx="${layout.plateRadius}" ry="${layout.plateRadius}"
      fill="${fill}" stroke="${stroke}" stroke-width="2"/>
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

  /* 1) Stage padding bg (preview .k-studio__stage dark surface parity).
   *    Plate'in arkasında dark padding alanı — operator için plate'in
   *    stage'den net "kalkması" hissi. */
  const stageBgSvg = buildStageBackgroundSvg(outputW, outputH);

  /* 2) Plate layout: rounded chrome + bg + border + drop shadow. */
  const plateLayout = resolvePlateLayout(outputW, outputH);
  const plateLayerSvg = buildPlateLayerSvg(outputW, outputH, plateLayout, scene);

  /* 3) Cascade slot composites — Phase 101 plate-relative.
   *
   * Cascade artık plate içine yerleşir (Studio preview parity — plate'in
   * `overflow:hidden` + cascade plate-inner ortasında). Stage-inner
   * 572×504 → plate dims oranla scale; plate offset'i ile origin'e
   * uygulanır. Preview ile export aynı plate-relative koordinatlar
   * (sözleşme #2 stage continuity + #11 preview ↔ export aynı kaynak). */
  const cascadeScale = Math.min(
    plateLayout.plateW / stageInnerW,
    plateLayout.plateH / stageInnerH,
  );
  const cascadeOffsetX = Math.round(
    plateLayout.plateX + (plateLayout.plateW - stageInnerW * cascadeScale) / 2,
  );
  const cascadeOffsetY = Math.round(
    plateLayout.plateY + (plateLayout.plateH - stageInnerH * cascadeScale) / 2,
  );

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
    const slotOutX = Math.round(slot.x * cascadeScale + cascadeOffsetX);
    const slotOutY = Math.round(slot.y * cascadeScale + cascadeOffsetY);

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

    // (b) Asset'i INNER rounded rect ile mask et — preview rect2
    // (asset surface, rx=innerRadius, beyaz çerçevenin İÇİNDE).
    // Asset white edge band'inin içinde yer alır (assetW-2×whiteEdge).
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

    // (c) Chrome'lu tile compose (preview StickerCardSVG 3-katman
    // yapısı parity, axis-aligned):
    //   layer 1: shadow base (rounded card silhouette + feDropShadow)
    //   layer 2: OUTER WHITE EDGE — kalın opak beyaz dolgu rect
    //            (preview rect1 fill=#FFFFFF rx=outerRadius)
    //   layer 3: inner asset (pad=whiteEdge içeride, rx=innerRadius)
    //   layer 4: koyu hairline inner outline (preview rect3
    //            rgba(0,0,0,0.10) sw≈1) — white edge'i belirginleştirir
    // Shadow padding (asset'in dışına taşar) tile'ı asset'ten büyük
    // yapar.
    const padding = Math.ceil(chrome.shadowOffset1 + chrome.shadowBlur1);
    const tileW = assetW + padding * 2;
    const tileH = assetH + padding * 2;
    const cardX = padding;
    const cardY = padding;

    // layer 1 — shadow base (full white-edge card silhouette).
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

    // layer 2 — OUTER WHITE EDGE (kalın opak beyaz dolgu) + layer 4
    // koyu hairline inner outline (white edge'in iç kenarını
    // belirginleştirir; preview rect3). Tek SVG'de compose.
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

    let slotTilePng = await sharp({
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
    const finalX = Math.round(slotCenterX - tileFinalW / 2);
    const finalY = Math.round(slotCenterY - tileFinalH / 2);

    slotComposites.push({
      input: slotTilePng,
      top: Math.max(0, finalY),
      left: Math.max(0, finalX),
    });
  }

  /* 4) Compose stage bg + plate layer + cascade composites (tek geçişte
   *    operator için preview ↔ export aynı görsel aileden gelir). */
  const composites: sharp.OverlayOptions[] = [
    { input: Buffer.from(plateLayerSvg), top: 0, left: 0 },
    ...slotComposites,
  ];
  let canvasBuffer = await sharp(Buffer.from(stageBgSvg))
    .composite(composites)
    .png()
    .toBuffer();

  /* 5) Lens Blur — apply Sharp blur to canvas (preview CSS filter:blur(8px)
   *  parity; 8px CSS ≈ Sharp σ ≈ 5-6 depending on output dims).
   *
   * NOT: Phase 101 plate chrome eklendiğinde blur tüm canvas'a uygulanırsa
   * stage padding + plate border'ı da bulanıklaşır. Operator beklentisi:
   * blur Frame mode preview'da plate'in **içindeki** content'e uygulanıyor
   * (CSS filter plate parent'a; rounded clip içinde). Phase 101'de aynı
   * davranış: blur'lu canvas'tan plate-area crop'lanıp stage padding +
   * plate chrome temiz halinin üstüne yapıştırılır.
   *
   * Şu an Phase 101 baseline: tüm canvas blur (preview ile birebir tam
   * pixel parity değil ama operator için Glass + Blur kombinasyonu net).
   * Plate-only blur Phase 102+ candidate (extract + composite zinciri
   * çok daha karmaşık; ana parity boşluğu plate chrome'du). */
  if (scene.lensBlur) {
    canvasBuffer = await sharp(canvasBuffer).blur(6).png().toBuffer();
  }

  /* 6) Glass overlay (after blur, so glass overlay itself stays sharp).
   *    Phase 101: glass overlay yalnız plate alanında (rounded clip ile)
   *    operator preview parity. */
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

  /* 7) Final PNG encode. */
  return await sharp(canvasBuffer).png({ compressionLevel: 9 }).toBuffer();
}
