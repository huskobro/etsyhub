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
