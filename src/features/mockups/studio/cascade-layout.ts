/* Phase 115 — Canonical cascade layout (paylaşılan tek kaynak).
 *
 * Phase 77-114 boyunca `cascadeLayoutFor` + `applyLayoutVariant` +
 * `cascadeLayoutForRaw` + `centerCascade` `MockupStudioStage.tsx`
 * içindeydi. Stage (preview) + Shell `handleExportFrame` (export)
 * bunu kullanıyordu. Phase 114'te right rail layoutVariant canonical
 * oldu AMA rail thumb (`PresetThumbMockup`) hâlâ AYRI hardcoded
 * `MOCKUP_PRESETS[idx].ph` geometrisinden render ediyordu — stage'in
 * gerçek cascade çıktısını YANSITMIYORDU (kullanıcı: "right rail
 * canlı preview surface değil").
 *
 * Phase 115: bu fonksiyonlar paylaşılan module'e çıkarıldı. svg-art
 * (rail thumb) bunu `MockupStudioStage`'ten import edemezdi
 * (circular: Stage zaten svg-art'tan `StageDeviceSVG`/
 * `StudioStageDeviceKind` import ediyor). Ayrı module: Stage +
 * Shell/export + rail thumb ÜÇÜ DE buradan okur → TEK canonical
 * geometri kaynağı, Preview = Export = Rail-thumb yapısal garanti
 * (§11.0 thumb-candidate genişletme).
 *
 * Bu yeni framework DEĞİL — mevcut tek fonksiyon ailesinin
 * paylaşılabilir konuma taşınması (kullanıcı izni: "final ürün
 * kalitesi için küçük/orta yapısal sistemleştirme"). Davranış
 * BİREBİR korunur (Phase 114 baseline). compositionGroup +
 * PLATE_FILL_FRAC Stage'de KALIR (plate-relative locking =
 * shape/layout impl detail, kategori 3 — stage-specific). */

import type { StudioStageDeviceKind } from "./svg-art";
import type { StudioLayoutVariant } from "./types";

export type CascadeItem = {
  si: number;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  z: number;
};

/* Phase 94 — Cascade center alignment (bug #16/#21):
 * Phase 82'de cascade koordinatları sol-üst pivot kullanıyordu —
 * stage-inner 572×504 içinde cascade'in bbox'ı sol-üste yapışıktı.
 * `centerCascade()` bbox hesabı + offset uygulayarak cascade'i
 * stage-inner ortasına çeker. Layout sabitleri değişmiyor; yalnız
 * visual merkez netleşir. (Phase 111 compositionGroup bunu plate'e
 * fit eder — bu fonksiyon yalnız stage-inner-local merkez.) */
export function centerCascade(items: CascadeItem[]): CascadeItem[] {
  if (items.length === 0) return items;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const it of items) {
    minX = Math.min(minX, it.x);
    minY = Math.min(minY, it.y);
    maxX = Math.max(maxX, it.x + it.w);
    maxY = Math.max(maxY, it.y + it.h);
  }
  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  const stageW = 572;
  const stageH = 504;
  const offsetX = Math.round((stageW - bboxW) / 2 - minX);
  const offsetY = Math.round((stageH - bboxH) / 2 - minY);
  return items.map((it) => ({ ...it, x: it.x + offsetX, y: it.y + offsetY }));
}

/* Phase 99 — Exported for Frame export pipeline (preview ↔ export
 * aynı kompozisyon kaynak). Phase 115 — rail thumb da bunu çağırır
 * (candidate variant ile). Shell handleExportFrame slot positions'ı
 * backend'e gönderir; Sharp pipeline aynı koordinatları output
 * canvas'a scale eder. Sözleşme #11 + #13.C divergence sıfır. */
export function cascadeLayoutFor(
  kind: StudioStageDeviceKind,
  layoutCount: 1 | 2 | 3 = 3,
  variant: StudioLayoutVariant = "cascade",
): CascadeItem[] {
  // AYRIM DİSİPLİNİ (Phase 114/115 — kullanıcı yön ayarı):
  //  - cascadeLayoutForRaw = SHAPE-SPECIFIC impl detail (kategori 3):
  //    her productType'ın slot boyut karakteri (telefon dik 416,
  //    sticker kare 220, bookmark dar 90). Registry içinde AYRI kalır,
  //    tek potaya eritilmez.
  //  - applyLayoutVariant = CANONICAL shared parameter (kategori 1)
  //    layoutVariant'ı tüketir: base slot BOYUTLARINI korur, sadece
  //    DİZİLİM/rotation/offset'i variant'a göre üretir. productType-
  //    AGNOSTIC (her shape base'ine aynı dönüşüm). "cascade" = mevcut
  //    Phase 77-113 davranış (regression yok); 5 variant ek.
  const base = cascadeLayoutForRaw(kind).slice(0, layoutCount);
  const arranged = applyLayoutVariant(base, variant);
  return centerCascade(arranged);
}

/* Phase 114 — Layout variant arranger (canonical shared parameter
 * layoutVariant'ı gerçek kompozisyona çevirir). Right rail "Layout
 * Presets" Phase 96-113 boyunca NO-OP idi (sadece thumb highlight);
 * Phase 114 stage cascade + Frame export'a gerçekten yansır; Phase
 * 115 rail thumb da bunu candidate variant ile çağırır (Preview =
 * Export = Rail-thumb §11.0).
 *
 * Girdi: cascadeLayoutForRaw'ın productType base item'ları (slot
 * w/h karakteri korunur). Çıktı: aynı boyutlar, variant'a göre
 * x/y/rotation/z yeniden dizilim. centerCascade sonradan plate'e
 * fit eder (Phase 111 locked-group; bu fonksiyon ham layout üretir,
 * fit/center DEĞİL — sözleşme #2 + Phase 112 composition primitive).
 *
 * Variant tasarımı (Shots.so layout variation library parity):
 *  - cascade:  Phase 77-113 baseline (offset + downstep + tilt)
 *  - centered: tek-merkez yığın (overlap, minimal offset, düz)
 *  - tilted:   simetrik karşıt eğim (fan'a benzer ama daha sıkı)
 *  - stacked:  dikey üst üste (z-stack, küçük y-step, tilt yok)
 *  - fan:      geniş yelpaze (büyük açı yayılımı + yatay yayılım)
 *  - offset:   diyagonal kayık (eşit adım, hafif tek-yön tilt) */
export function applyLayoutVariant(
  base: CascadeItem[],
  variant: StudioLayoutVariant,
): CascadeItem[] {
  const n = base.length;
  if (n === 0) return base;
  // Karakteristik ölçü: ilk (en büyük) slot boyutu — variant
  // spacing'leri buna oranlanır (productType-agnostic).
  const w0 = base[0]!.w;
  const h0 = base[0]!.h;

  if (variant === "cascade") {
    // Phase 77-113 baseline — DEĞİŞMEZ (regression koruması).
    return base.map((b) => ({ ...b }));
  }

  return base.map((b, i) => {
    const mid = (n - 1) / 2;
    const d = i - mid; // merkeze göre ofset (-..0..+)
    const zTop = n - i; // ilk slot en üstte (Phase baseline z davranışı)

    if (variant === "centered") {
      // Tek-merkez yığın: minimal x ofset, tilt yok, hafif y-step.
      return {
        ...b,
        x: Math.round(w0 * 0.5 + d * w0 * 0.16),
        y: Math.round(h0 * 0.12 + Math.abs(d) * h0 * 0.05),
        r: 0,
        z: zTop,
      };
    }
    if (variant === "tilted") {
      // Simetrik karşıt eğim, orta-sıkı yatay yayılım.
      return {
        ...b,
        x: Math.round(d * w0 * 0.62 + w0 * (mid * 0.62)),
        y: Math.round(Math.abs(d) * h0 * 0.07),
        r: Math.round(d * 7),
        z: zTop,
      };
    }
    if (variant === "stacked") {
      // Dikey z-stack: aynı x, küçük y-step, tilt yok, derinlik z.
      return {
        ...b,
        x: Math.round(w0 * 0.12 + Math.abs(d) * w0 * 0.04),
        y: Math.round(i * h0 * 0.14),
        r: 0,
        z: zTop,
      };
    }
    if (variant === "fan") {
      // Geniş yelpaze: büyük açı + geniş yatay yayılım.
      return {
        ...b,
        x: Math.round(d * w0 * 0.78 + w0 * (mid * 0.78)),
        y: Math.round(Math.abs(d) * h0 * 0.11),
        r: Math.round(d * 13),
        z: zTop,
      };
    }
    // offset — diyagonal eşit adım, hafif tek-yön tilt.
    return {
      ...b,
      x: Math.round(i * w0 * 0.42),
      y: Math.round(i * h0 * 0.2),
      r: Math.round(i * -4),
      z: zTop,
    };
  });
}

/* SHAPE-SPECIFIC impl detail (kategori 3 — registry, AYRI kalır).
 * Her productType'ın doğal slot boyut karakteri (PhoneSVG kontrat
 * baseline: wall_art 2:3 portrait, sticker square, bookmark tall-
 * narrow, tshirt body yatay). Layout sabitleri stage canvas 572×504
 * boundary içinde planlandı. Yeni shape = yeni case (layout registry,
 * hack DEĞİL — Phase 112 composition primitive sözleşmesi). */
export function cascadeLayoutForRaw(
  kind: StudioStageDeviceKind,
): CascadeItem[] {
  switch (kind) {
    case "wall_art":
    case "canvas":
    case "printable":
      // 2:3 portrait framed surfaces — wider stance
      return [
        { si: 0, x: 30, y: 30, w: 200, h: 280, r: 0, z: 3 },
        { si: 1, x: 230, y: 70, w: 170, h: 240, r: -5, z: 2 },
        { si: 2, x: 400, y: 110, w: 140, h: 200, r: -10, z: 1 },
      ];
    case "sticker":
    case "clipart":
      // Square die-cuts — playful stacked
      return [
        { si: 0, x: 50, y: 70, w: 220, h: 220, r: 0, z: 3 },
        { si: 1, x: 270, y: 110, w: 180, h: 180, r: -6, z: 2 },
        { si: 2, x: 440, y: 160, w: 130, h: 130, r: -12, z: 1 },
      ];
    case "bookmark":
      // Tall narrow strips — pamphlet-like row
      return [
        { si: 0, x: 130, y: 30, w: 90, h: 320, r: 0, z: 3 },
        { si: 1, x: 250, y: 50, w: 78, h: 280, r: -6, z: 2 },
        { si: 2, x: 360, y: 70, w: 64, h: 240, r: -12, z: 1 },
      ];
    case "tshirt":
    case "hoodie":
    case "dtf":
      // Garment silhouettes — wider chest area
      return [
        { si: 0, x: 20, y: 30, w: 220, h: 260, r: 0, z: 3 },
        { si: 1, x: 240, y: 70, w: 190, h: 225, r: -5, z: 2 },
        { si: 2, x: 430, y: 110, w: 150, h: 180, r: -10, z: 1 },
      ];
    case "phone":
    default:
      // Final HTML iPhone cascade (Phase 77 baseline)
      return [
        { si: 0, x: 20, y: 14, w: 204, h: 416, r: 0, z: 3 },
        { si: 1, x: 224, y: 60, w: 170, h: 346, r: -6, z: 2 },
        { si: 2, x: 398, y: 110, w: 140, h: 284, r: -12, z: 1 },
      ];
  }
}

/* Phase 111 — Plate-relative LOCKED composition group geometry.
 *
 * Phase 111-128 boyunca `MockupStudioStage.tsx` içinde private idi
 * (Stage MockupComposition/FrameComposition + Shell export onu
 * tüketiyordu). Phase 129: navigator viewfinder matematiği de
 * AYNI full-composition geometrisini kullanmak zorunda (viewfinder
 * = middle panel görünür penceresinin navigator-uzayındaki gerçek
 * izdüşümü; keyfi 1/zoom formülü DEĞİL). cascade-layout.ts'e
 * taşındı → Stage (preview) + Shell (export) + rail thumb + navigator
 * viewfinder HEPSİ tek canonical composition geometrisinden okur
 * (§11.0 Preview = Export = Rail-thumb = Navigator-viewfinder
 * yapısal garanti). Davranış BİREBİR korunur (Phase 111 baseline;
 * Stage taraf import edip aynen çağırır).
 *
 * Geometri: gerçek bbox + plate-fit scale (PLATE_FILL_FRAC,
 * aspect-locked, clamp YOK — plate büyürse group orantılı) +
 * items 0-origin normalize (relative offset korunur). stage-inner
 * BBOX-TIGHT → CSS plate-center → group center = plate center
 * (drift sıfır, rotation simetrik). */
export const PLATE_FILL_FRAC = 0.84;

export function compositionGroup(
  items: CascadeItem[],
  plateW: number,
  plateH: number,
): {
  scale: number;
  bboxW: number;
  bboxH: number;
  items: CascadeItem[];
} {
  if (items.length === 0) {
    return { scale: 1, bboxW: 1, bboxH: 1, items };
  }
  /* Phase 133 — ROTATED-AABB bbox (görsel sınır, layout-bbox DEĞİL).
   *
   * KÖK NEDEN (canlı browser + pixel ölçümüyle KANITLANDI): Phase
   * 111-132 bbox layout-bbox idi (item.x..x+w, rotation YOK
   * sayılıyordu). Ama slot CSS `transform:rotate(${r}deg)`
   * (transform-origin center) ile item-merkezi etrafında dönüyor →
   * cascade'in -6°/-12° kartları GÖRSEL olarak layout-bbox dışına
   * taşıyor. stage-inner BBOX-TIGHT layout-bbox merkezli; görsel-
   * bbox değil. MID'de plate büyük → fark ~%1 (göz ardı); rail
   * thumb plate küçük → AYNI rotated-taşma plate'in %29'u (DOM
   * kanıt: P0 compCxOffsetFrac 0.285) → composition sağa kayık +
   * sağdan kart dışına taşıp clip (kullanıcı "sağdan kesik"
   * şikayetinin KALAN kaynağı).
   *
   * Phase 133 fix: bbox = her item'ın `r` açısıyla item-merkezi
   * etrafında döndürülmüş 4 köşesinin gerçek min/max'ı (rotated-
   * AABB = görsel sınır). stage-inner görsel-bbox-tight → composition
   * görsel center = plate center HEM MID HEM rail'de (oransal
   * tutarlı, clip YOK). slot render DEĞİŞMEZ (x/y/w/h/r aynı; CSS
   * rotate item-center etrafında — görsel parity korunur). Stage +
   * Shell export AYNI compositionGroup → export offset de rotated-
   * AABB (Preview = Export Truth §11.0; divergence YOK). Rotasyonsuz
   * (r=0) item'da rotated-AABB = layout-bbox (regression yok). */
  const deg2rad = Math.PI / 180;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const it of items) {
    const cx = it.x + it.w / 2;
    const cy = it.y + it.h / 2;
    const rad = (it.r || 0) * deg2rad;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // 4 köşe item-merkezine göre, rotate, sonra dünya koordinatı.
    const hw = it.w / 2;
    const hh = it.h / 2;
    const corners: ReadonlyArray<readonly [number, number]> = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ];
    for (const [dx, dy] of corners) {
      const wx = cx + dx * cos - dy * sin;
      const wy = cy + dx * sin + dy * cos;
      minX = Math.min(minX, wx);
      minY = Math.min(minY, wy);
      maxX = Math.max(maxX, wx);
      maxY = Math.max(maxY, wy);
    }
  }
  const bboxW = Math.max(1, maxX - minX);
  const bboxH = Math.max(1, maxY - minY);
  // Plate'in hedef iç alanı (border + breathing). bbox bu alana
  // her iki eksende sığacak şekilde aspect-locked fit. CLAMP YOK:
  // plate büyürse scale > 1 (group orantılı büyür — preview parity).
  const targetW = plateW * PLATE_FILL_FRAC;
  const targetH = plateH * PLATE_FILL_FRAC;
  const scale = Math.min(targetW / bboxW, targetH / bboxH);
  // 0-origin normalize: items birbirlerine göre aynı (relative
  // offset korunur), bbox 0..bboxW × 0..bboxH → stage-inner =
  // bbox boyutu → CSS center = group center = plate center.
  const normalized = items.map((it) => ({
    ...it,
    x: it.x - minX,
    y: it.y - minY,
  }));
  return { scale, bboxW, bboxH, items: normalized };
}

/* Phase 133 — Tek canonical plate-box çözücü (container-agnostic
 * aspect-locked bbox-fit).
 *
 * KÖK NEDEN (Phase 133 canlı browser + pixel ölçümüyle KANITLANDI):
 * `StageScenePreview` (rail thumb + zoom panel) iki katmanlı SAHTE
 * boyutlandırma yapıyordu:
 *   (1) dış wrapper `width: PREVIEW_BASE_W(900) height:
 *       PREVIEW_BASE_H(506)` SABİT 16:9-ish + `transform:scale(s)`
 *   (2) içindeki `StageScene` plate'i `plateDims` (aspect-aware)
 *       ile render ediyordu
 * İki katman uyumsuz: scaleWrap sabit 900×506 oranlı, plate aspect
 * değişiyor → 9:16 portrait'te plate scaleWrap'in yalnız %39'unu
 * kaplıyor (DOM kanıt: cardW 146, plateW 57), kalan boş +
 * previewWrap/stageRoot/plate 3 `overflow:hidden` clip ediyor.
 * Middle panel ise plate'i DOĞRUDAN stage'e flex-fill ediyor
 * (scaleWrap YOK) → composition plate'i PLATE_FILL_FRAC ile dengeli
 * dolduruyor. İki yüzey AYNI `StageScene` ama farklı dış sarmalama
 * → "görünüşte tek render path, pratikte değil" (kullanıcı hipotezi
 * doğrulandı: math + visibility birlikte).
 *
 * Phase 133 fix: `PREVIEW_BASE × transform:scale` modeli TAMAMEN
 * KALDIRILDI. Her yüzey kendi container box'ını geçirir; plate
 * DOĞRUDAN o box'a aspect-locked fit edilir (scaleWrap YOK). Middle
 * = viewport-türevli box, rail/zoom = ölçülen kart box → ikisi de
 * AYNI `resolvePlateBox`. frameAspect SHARED state (Phase 95) →
 * 3 yüzeyde plate aspect aynı; composition `compositionGroup`
 * PLATE_FILL_FRAC ile her yüzeyde dengeli (Preview = Export =
 * Rail-thumb = Navigator-viewfinder §11.0; tek render path GERÇEKTEN
 * tek). aspect-agnostic (ratio param) + container-agnostic
 * (containerW/H param) + layout-agnostic (compositionGroup ayrı
 * katman) → custom resolution gelirse yeni aspect tek kaynaktan
 * otomatik tutarlı. */
export interface PlateBoxOpts {
  /** Container'ın kaçını plate hedefler (Stage: viewport padding
   *  payı; rail/zoom: kart kutusu zaten plate-tight → 1.0). */
  fillW?: number;
  fillH?: number;
  /** Üst sınır (Stage: çok geniş ekranda dev plate kötü; rail/zoom:
   *  sınır gereksiz). */
  capW?: number;
  capH?: number;
}

export function resolvePlateBox(
  aspectRatio: number, // w / h (> 0)
  containerW: number,
  containerH: number,
  opts: PlateBoxOpts = {},
): { w: number; h: number } {
  const ratio = aspectRatio > 0 ? aspectRatio : 1;
  const fillW = opts.fillW ?? 1;
  const fillH = opts.fillH ?? 1;
  let availW = Math.max(1, containerW) * fillW;
  let availH = Math.max(1, containerH) * fillH;
  if (opts.capW != null) availW = Math.min(availW, opts.capW);
  if (opts.capH != null) availH = Math.min(availH, opts.capH);
  // Aspect-locked bbox-fit: hem availW hem availH'a sığ, oran SABİT.
  const byWidth = { w: availW, h: availW / ratio };
  if (byWidth.h <= availH) {
    return { w: Math.round(availW), h: Math.round(availW / ratio) };
  }
  return { w: Math.round(availH * ratio), h: Math.round(availH) };
}

/* Phase 134 — Plate corner radius, plate genişliğine ORANSAL
 * (tek chrome-radius kaynağı).
 *
 * studio.css `border-radius: 26px` SABİT'ti: middle plate ~1080px
 * → %2.4 (subtle), rail thumb plate ~146px → %18 (çok yuvarlak)
 * = "preview kartlar daha yuvarlatılmış" bug'ı. Bu helper TEK
 * formül: Stage `plateStyle.borderRadius`, rail selection-ring
 * radius hepsi buradan → middle ile AYNI görsel oran ("aynı
 * sahnenin küçük versiyonu"; sessiz drift §12 YASAK). 0.024 ≈
 * eski 26px @ ~1080px (middle regression yok); rail @~146px →
 * ~3.5px (proportional, subtle). min 4px (çok küçük thumb'da
 * köşe tamamen kaybolmasın). */
export const PLATE_RADIUS_FRAC = 0.024;

export function plateRadiusForWidth(plateW: number): number {
  return Math.max(4, Math.round(plateW * PLATE_RADIUS_FRAC));
}
