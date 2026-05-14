"use client";
/* eslint-disable no-restricted-syntax */

/* Phase 77 — Studio center stage.
 *
 * Final HTML StudioStage paritesi (mode + appState dispatch):
 *   - Mockup mode: device cascade (3 phones, slot ring + dim/lit badge)
 *   - Frame mode: bounded frame canvas (gradient surface + device inside)
 *   - All modes: zoom pill, ambient glow (mockup only), empty caption,
 *     render overlay (spinner), render-done banner (success), edit pill
 *     (preview state)
 *
 * File-level eslint-disable: stage compositions yoğun absolute positioning
 * + drop-shadow filter chains + per-slot transform rotations. Stable
 * recipes studio.css'de namespace-d.
 */

import { StudioIcon } from "./icons";
import {
  FRAME_ASPECT_CONFIG,
  computeFrameCanvasDims,
  type FrameAspectKey,
} from "./frame-aspects";
import {
  resolveSceneStyle,
  resolvePlateEffects,
  type SceneOverride,
} from "./frame-scene";
import {
  PhoneSVG,
  StageDeviceSVG,
  STUDIO_SAMPLE_DESIGNS,
  type StudioStageDeviceKind,
} from "./svg-art";
import type { StudioAppState, StudioMode, StudioSlotMeta } from "./types";

/* Phase 88 — Hex → rgba conversion for asset-aware scene CSS
 * custom property injection. Stage scene'in radial gradient
 * layer'ları operator palette tone'larını subtle alpha ile
 * uygular. Geçersiz hex → neutral fallback. */
function hexToRgba(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return `rgba(0,0,0,${alpha})`;
  const h = match[1]!;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* Phase 91 — Plate bg resolver.
 *
 * Stage'in ortasında bounded surface plate'in arka planını
 * sceneOverride + activePalette'ten hesaplar. Phase 88-90'da
 * resolveSceneStyle alpha < 1 ile stage-wide ambient tint
 * üretiyordu; Phase 91'de plate fully opaque surface (alpha 1.0)
 * — operatör için "objenin arkasında gerçek görünen plate" hissi.
 *
 *   - solid {color}      → solid color
 *   - gradient {from,to} → 135deg linear gradient
 *   - auto + palette     → palette[0] → palette[1] 135deg gradient
 *   - auto + no palette  → neutral cream/warm gradient (CSS fallback)
 *
 * Plate bg her iki modda da kullanılır (mode-AGNOSTIC). Phase 89
 * sceneOverride'ı plate'in bg'sini kontrol eder; ambient scene
 * (Phase 88-90) plate'in dışında padding alanı için subtle
 * vignette katmanı olarak yaşamaya devam eder. */
function resolvePlateBackground(
  override: SceneOverride,
  activePalette: readonly [string, string] | undefined,
): string | undefined {
  if (override.mode === "solid" && override.color) {
    return override.color;
  }
  if (override.mode === "gradient" && override.color && override.colorTo) {
    return `linear-gradient(135deg, ${override.color} 0%, ${override.colorTo} 100%)`;
  }
  // auto mode
  if (activePalette) {
    return `linear-gradient(135deg, ${activePalette[0]} 0%, ${activePalette[1]} 100%)`;
  }
  // No palette → CSS default fallback (neutral cream). Return undefined
  // so plate CSS fallback (background: linear-gradient(135deg, #f0e9d8...))
  // takes over.
  return undefined;
}

/* Phase 91 — Plate dimensions resolver (mode-aware).
 *
 * Mockup mode: default 4:3 aspect (Shots.so canonical Frame default),
 * stage'in ~%72 genişlik × %62 yükseklik bbox içine sığar.
 * Frame mode: frameAspect'ten (computeFrameCanvasDims pattern parity)
 * hesaplanır, aynı bbox.
 *
 * Stage outer typical 1009×800-ish (viewport-dependent); plate max
 * dimensions sabit absolute pixel olarak set ediliyor — operator
 * stage zoom'u plate boyutunu etkilemez (Phase 87 baseline: aspect
 * stage'i shrink/grow yapmaz, sadece export hint). Plate bu kontratı
 * korur. */
function plateDimensionsFor(
  _mode: StudioMode,
  frameAspect: FrameAspectKey,
): { w: number; h: number } {
  /* Phase 95 — Aspect SHARED state (Mockup ↔ Frame) + larger bbox
   * (Shots.so live davranış doğrulaması):
   *
   * Phase 94'te Mockup mode'da plate 4:3 zorla yapıyordu. Shots.so
   * gerçek browser testi (image upload + Frame'de 9:16 seç + Mockup'a
   * dön) kanıtladı: **aspect SHARED state** — Frame mode'da seçilen
   * aspect Mockup'a da geçer; Mockup'ta plate Frame'den miras aspect
   * gösterir. Kullanıcı bug #27 ("Frame'de aspect ayarlanınca
   * Mockup'ta farklı görünüyor") gerçek davranışı tarif ediyor.
   *
   * Phase 95 düzeltme:
   *   - Mockup ve Frame her ikisi de aynı frameAspect'i takip eder
   *   - mode argümanı kabul edilir ama dimensions'a etkisi yok
   *     (mode-AGNOSTIC aspect inheritance)
   *   - maxW/maxH 720/640 → **920/720** (Shots-paritesi plate
   *     stage'in ~%85'ini kaplar; Kivasy %85 max ile uyumlu)
   *
   * Aspect-driven bbox-fit:
   *   - 16:9 → width-fit (920×518)
   *   - 4:5 → height-fit (~576×720)
   *   - 9:16 → height-fit (~405×720)
   *   - 1:1 → square fit (720×720)
   *   - 3:4 → height-fit (~540×720)
   *   - 2:3 → height-fit (~480×720)
   *   - 3:2 → width-fit (920×613)
   *
   * CSS `.k-studio__stage-plate` max-width:85% / max-height:82% +
   * bu helper birlikte viewport-küçük responsive guard.
   *
   * Phase 97 — maxW 920 → 1080, maxH 720 → 820 (viewport-aware artış).
   *
   * Phase 95 baseline maxW=920 / maxH=720 idi. Audit (Phase 96 sonrası,
   * viewport 1364×990): plate 806×518 (CSS max-width:85%×948=805 cap),
   * stage 948×952 — dikey alanın %46'sı boş; 16:9 default'ta plate
   * height/stage = 518/952 = %54. Root cause: 16:9 width-fit'te
   * height = width/1.777; maxW=920 → max possible height 518. Yalnız
   * maxH artırmak 16:9'da plate height'ı değiştirmez — width-bounded.
   *
   * Phase 97 düzeltmesi:
   *   - maxW 920 → 1080: CSS max-width:85% guard hâlâ aktif; geniş
   *     viewport'ta plate width artar → 16:9 height de ~608'e çıkar
   *     (1080/1.777). Küçük viewport'ta CSS guard daraltır
   *     (responsive korunur).
   *   - maxH 720 → 820: portrait aspect'lerde (9:16, 4:5) plate
   *     height artar.
   *
   * Stage padding korunur (CSS %85 width + %82 height guard); viewport
   * küçüldüğünde orantısal küçülme aynı pattern. Stage çok daha
   * dolu hissedilir. Sözleşme #3 (Plate behavior — stage ~%85-90
   * hedef) ile uyumlu. */
  const maxW = 1080;
  const maxH = 820;
  const cfg = FRAME_ASPECT_CONFIG[frameAspect];
  const ratio = cfg.ratio; // w/h
  const fitByWidth = { w: maxW, h: Math.round(maxW / ratio) };
  if (fitByWidth.h <= maxH) return fitByWidth;
  return { w: Math.round(maxH * ratio), h: maxH };
}

interface MockupCompositionProps {
  slots: ReadonlyArray<StudioSlotMeta>;
  selectedSlot: number;
  onSelect: (i: number) => void;
  isPreview: boolean;
  /** Phase 82 — productType-aware stage shape. Bookmark vertical
   *  strip, wall art frame, sticker die-cut, tshirt silhouette vb.
   *  PhoneSVG hardcoded placeholder Phase 77-81 baseline'da idi;
   *  Phase 82 gerçek surface'i gösterir. Bilinmeyen kategori →
   *  phone fallback (legacy + final HTML parity). */
  deviceKind: StudioStageDeviceKind;
}

/* Phase 82 — Per-device cascade layout. Final HTML telefon 3-phone
 * cascade idi (204×416, 170×346, 140×284); diğer device kind'larda
 * aynı 3-slot cascade kompoze edilir ama her shape'in doğal aspect
 * ratio'su korunur. PhoneSVG kontrat'ı baseline kaldı → wall_art
 * 2:3 portrait, sticker square, bookmark tall-narrow, tshirt body
 * yatay genişlik. Layout sabitleri stage canvas 572×504 boundary
 * içine sığacak şekilde planlandı (mevcut studio.css stage-inner
 * geometrisini bozmaz).
 *
 * Phase 94 — Cascade center alignment (bug #16/#21):
 * Phase 82'de cascade koordinatları sol-üst pivot kullanıyordu —
 * stage-inner 572×504 içinde cascade'in bbox'ı sol-üste yapışıktı.
 * Phase 94'te `centerCascade()` helper bbox hesabı + offset
 * uygulayarak cascade'i stage-inner ortasına çeker. Layout
 * sabitleri değişmiyor; yalnız visual merkez netleşiyor. */
function centerCascade(
  items: { si: number; x: number; y: number; w: number; h: number; r: number; z: number }[],
): { si: number; x: number; y: number; w: number; h: number; r: number; z: number }[] {
  if (items.length === 0) return items;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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

/* Phase 97 — layoutCount-aware center.
 *
 * Phase 94'te `centerCascade` 3-cascade'in bbox'ını merkezliyor,
 * caller `.slice(0, layoutCount)` uyguluyordu. Sonuç: N=1 case'inde
 * slot 0 cascade'in en sol pozisyonu olduğu için plate'in sol-
 * yarısına kayık (audit: x=543 plate-center=688, 145px sapma).
 *
 * Phase 97 düzeltmesi: slice helper içine taşındı; center slice
 * sonrası uygulanır. N=1 slot 0 plate ortasında; N=2 cascade
 * bbox center; N=3 baseline davranışı korundu.
 *
 * Sözleşme #8 (Layout count behavior) — single-item cascade plate
 * ORTASINDA. */
/* Phase 99 — Exported for Frame export pipeline (preview ↔ export aynı
 * kompozisyon kaynak). Shell handleExportFrame bu helper'ı çağırıp
 * slot positions'ı backend'e gönderir; backend Sharp pipeline aynı
 * koordinatları output canvas'a scale eder. Sözleşme #11 + #13.C
 * preview ↔ export divergence sıfır. */
export function cascadeLayoutFor(
  kind: StudioStageDeviceKind,
  layoutCount: 1 | 2 | 3 = 3,
): { si: number; x: number; y: number; w: number; h: number; r: number; z: number }[] {
  const raw = cascadeLayoutForRaw(kind).slice(0, layoutCount);
  return centerCascade(raw);
}

function cascadeLayoutForRaw(
  kind: StudioStageDeviceKind,
): { si: number; x: number; y: number; w: number; h: number; r: number; z: number }[] {
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

function MockupComposition({
  slots,
  selectedSlot,
  onSelect,
  isPreview,
  deviceKind,
  plateDims,
  layoutCount,
}: MockupCompositionProps & {
  plateDims: { w: number; h: number };
  layoutCount: 1 | 2 | 3;
}) {
  /* Phase 96 — Layout count Shell state ile cascade item count
   * sınırlandı (bug #13). Rail head 1/2/3 buttons → Shell setter →
   * layoutCount → Stage MockupComposition + FrameComposition + rail
   * thumb hepsi aynı limit'i uygular.
   *
   * Phase 97 — slice helper içine taşındı (single-item center fix).
   * cascadeLayoutFor artık (kind, layoutCount) signature; center
   * slice sonrası uygulanır. */
  const phones = cascadeLayoutFor(deviceKind, layoutCount);
  /* Phase 95 — Cascade portrait scale-down (bug #32):
   * Cascade 572×504 sabit bbox; plate aspect değişince (örn. 9:16
   * portrait 405×720) cascade plate dışına taşıyordu — bazı items
   * clip ediliyordu. Phase 95'te plate'in iç boyutu (minus border +
   * padding) cascade'in 572×504'üne göre scale faktörü hesaplanır;
   * cascade orantısal küçülür, plate içine sığar. */
  const innerW = Math.max(0, plateDims.w - 32); // border + breathing
  const innerH = Math.max(0, plateDims.h - 32);
  const cascadeScale = Math.min(innerW / 572, innerH / 504, 1.0);
  return (
    <div
      className="k-studio__stage-inner"
      style={{
        width: 572,
        height: 504,
        transform: cascadeScale < 1 ? `scale(${cascadeScale})` : undefined,
        transformOrigin: "center center",
      }}
      data-testid="studio-stage-mockup-comp"
      data-cascade-scale={cascadeScale.toFixed(3)}
    >
      {phones.map(({ si, x, y, w, h, r, z }) => {
        const slot = slots[si];
        if (!slot) return null;
        const isActive = selectedSlot === si && !isPreview;
        const isGhost = !slot.assigned && !isActive;
        /* Phase 94 — Selection chrome cleanup (bug #22):
         * Phase 78+ baseline active filter'ında orange glow halo
         * (`drop-shadow(0 0 36px rgba(232,93,37,0.13))`) + agresif
         * 32px black shadow cascade'in dışına geniş gölge bırakıyordu
         * — operator için "preview/final ürün ile çalışma görünümü
         * arasında dramatic fark" sebebi. Shots.so selection chrome
         * yalnız subtle outline; cascade gölgesi tek-katmanlı ve
         * uniform. Phase 94'te active/inactive aynı sade shadow
         * pattern; selection ring (slot-ring) sinyali tek başına
         * yeterli. Preview state'inde ring + badge zaten gizli
         * (Phase 77 baseline). */
        const filter = isGhost
          ? "none"
          : "drop-shadow(0 16px 32px rgba(0,0,0,0.5)) drop-shadow(0 4px 10px rgba(0,0,0,0.35))";
        return (
          <div
            key={si}
            className="k-studio__slot-wrap"
            onClick={() => {
              if (!isPreview) onSelect(si);
            }}
            style={{
              left: x,
              top: y,
              zIndex: z,
              transform: `rotate(${r}deg)`,
              filter,
              opacity: isGhost ? 0.26 : 1,
            }}
            data-testid={`studio-stage-slot-${si}`}
            data-active={isActive ? "true" : "false"}
            data-ghost={isGhost ? "true" : "false"}
          >
            {isActive ? (
              <div className="k-studio__slot-ring" data-on="true" />
            ) : null}
            {!isPreview && !isGhost ? (
              <div
                className="k-studio__slot-badge"
                data-tone={isActive ? "lit" : "dim"}
              >
                {String(slot.id).padStart(2, "0")} {slot.name}
              </div>
            ) : null}
            <StageDeviceSVG
              kind={deviceKind}
              w={w}
              h={h}
              design={slot.assigned ? slot.design : null}
              isEmpty={!slot.assigned}
              idx={si}
            />
            {isGhost && !isPreview ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.18)",
                  fontSize: 16,
                  pointerEvents: "none",
                }}
              >
                +
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

interface FrameCompositionProps {
  isEmpty: boolean;
  isPreview: boolean;
  /* Phase 85 — Selected-slot continuity: Frame mode artık Mockup
   * mode'da operatörün seçtiği slot'un design'ını bounded canvas
   * içine taşır. Önceden hardcoded STUDIO_SAMPLE_DESIGNS.d1
   * gösteriyordu — mode geçişinde operator "şu anki çalışmasını"
   * kaybediyor + iki ayrı sayfa hissi doğuyordu. Shots.so'da mode
   * tab yok, tek sidebar var; biz mode dichotomy'yi korurken
   * stage composition continuity'sini sağlıyoruz. Selected slot
   * boşsa (assigned=false) sample fallback. */
  slots: ReadonlyArray<StudioSlotMeta>;
  selectedSlot: number;
}

function FrameComposition({
  isEmpty,
  isPreview,
  deviceKind,
  frameAspect,
  slots,
  selectedSlot,
  plateDims,
  layoutCount,
}: FrameCompositionProps & {
  deviceKind: StudioStageDeviceKind;
  frameAspect: FrameAspectKey;
  plateDims: { w: number; h: number };
  layoutCount: 1 | 2 | 3;
}) {
  /* Phase 87 — True stage continuity (bounded canvas removed).
   *
   * Phase 85 baseline'da Frame mode'a geçince stage'in IÇINDE
   * bounded cream canvas (`linear-gradient(145deg,#E4DDD1,...)`)
   * çıkıyor, cascade onun içine `cascadeScale ≈ 0.5-0.94` ile
   * sığdırılıyordu. Phase 86'da preset rail/Magic Preset asset-
   * aware oldu.
   *
   * Phase 87 real-browser araştırması (Shots.so + MockupViews
   * yeniden gez):
   *   - Mockup ↔ Frame geçişinde stage'in CONTAINER'I değişmez.
   *   - Stage bg (cream/dark gradient) mode-AGNOSTIC.
   *   - Aspect ratio değişimi stage'i shrink/grow yapmaz — sadece
   *     "export dimensions hint" + sağ rail preset thumbnail
   *     aspect refresh.
   *   - Frame mode = stage'in CHROME'unu (bg/scene/effects) kontrol
   *     eder, CONTAINER'ını değil.
   *
   * Phase 87 düzeltmesi: bounded cream canvas wrap'i kaldırıldı.
   * Frame mode'da cascade Mockup mode'la TAM AYNI 572×504 inner
   * stage'inde, AYNI ölçekte, AYNI placement floor + ambient glow
   * (CSS data-mode="frame" şu an floor'u gizliyor, ama bunu da
   * kaldıracağız — frame mode'da da floor görünmeli, Shots'taki
   * gibi tek cream stage hissi).
   *
   * Aspect ratio bilgisi: caption ("1920 × 1080 · 16:9 · ...")
   * ve sağ rail preset thumb aspect refresh ile yaşar — stage'in
   * kendisi container'ı değiştirmez.
   *
   * Continuity contract (Phase 87 final):
   *   stage container   = mode-AGNOSTIC + aspect-AGNOSTIC
   *   stage composition = mode-AGNOSTIC (cascade her iki modda
   *                         birebir aynı pozisyon + ölçek)
   *   sidebar           = mode-aware swap
   *   right rail        = mode-aware preset set, mode-AGNOSTIC chrome
   *   toolbar           = mode-AGNOSTIC
   *   aspect ratio      = "export hint" (caption + sağ rail thumb
   *                         aspect ratio), stage'i shrink/grow
   *                         YAPMAZ
   *
   * Empty state (sw="empty") → cascade görünmez; explicit reset. */
  const aspectCfg = FRAME_ASPECT_CONFIG[frameAspect];

  /* Cascade layout: Mockup mode ile birebir aynı (cascadeLayoutFor
   * + 572×504 inner stage). Phase 87'de scale = 1 (Mockup mode ile
   * aynı boyut). Phase 96 — layoutCount ile slice (bug #13).
   * Phase 97 — slice helper içine taşındı (single-item center fix);
   * cascadeLayoutFor (kind, layoutCount) signature, center slice
   * sonrası. */
  const phones = cascadeLayoutFor(deviceKind, layoutCount);

  const activeSlot = slots[selectedSlot] ?? null;
  const hasAnyAssignedSlot = slots.some((s) => s.assigned);
  const designSource: "slot" | "sample" | "empty" = isEmpty
    ? "empty"
    : hasAnyAssignedSlot
      ? "slot"
      : "sample";

  /* Phase 95 — Cascade portrait scale-down (bug #32 Frame side):
   * Aynı pattern MockupComposition'la — plate dimensions değişince
   * cascade orantısal küçülür, plate içine sığar. 9:16 portrait
   * plate 405×720 → cascade 572×504 sığmaz; scale uygulanmadan items
   * clip ediliyordu (Side yarım, Back tamamen kaybolmuştu). */
  const innerW = Math.max(0, plateDims.w - 32);
  const innerH = Math.max(0, plateDims.h - 32);
  const cascadeScale = Math.min(innerW / 572, innerH / 504, 1.0);

  return (
    <>
      <div
        className="k-studio__stage-inner"
        style={{
          width: 572,
          height: 504,
          transform: cascadeScale < 1 ? `scale(${cascadeScale})` : undefined,
          transformOrigin: "center center",
        }}
        data-testid="studio-stage-frame-comp"
        data-frame-aspect={frameAspect}
        data-design-source={designSource}
        data-active-slot={selectedSlot}
        data-cascade-scale={cascadeScale.toFixed(3)}
      >
        {/* Phase 87 — Frame mode cascade carry-over (no bounded canvas).
            Mockup mode'daki cascade buraya BİREBİR taşınır, AYNI
            572×504 inner stage'inde, AYNI 1.0 scale ile. Operator
            için stage container tek kompozisyon, Frame mode sadece
            "presentation chrome" katmanı (sol panel: bg/scene/effects
            + sağ rail preset aspect refresh + caption aspect hint). */}
        {!isEmpty
          ? phones.map(({ si, x, y, w, h, r, z }) => {
              const slot = slots[si];
              if (!slot) return null;
              const isGhost = !slot.assigned;
              const designForSlot = slot.assigned
                ? slot.design
                : hasAnyAssignedSlot
                  ? null
                  : STUDIO_SAMPLE_DESIGNS.d1;
              /* Phase 94 — Frame mode selection chrome cleanup (bug #18):
               * Phase 85+87 baseline Frame mode'a geçince Mockup mode
               * selection chrome (slot-ring + active orange glow filter)
               * cascade'le birlikte Frame'e taşınıyordu. Shots.so Frame
               * mode'da selection chrome yok — Frame "presentation
               * surface" rolünde operator'ın final output'unu önizler;
               * selection sinyali yalnız Mockup mode (object styling
               * sahnesi) için anlamlı. Phase 94 Frame mode'da active
               * outline + orange shadow halo tamamen gizli. Filter
               * sadece uniform shadow (Mockup Phase 94 cleanup parity). */
              const filter = isGhost
                ? "none"
                : "drop-shadow(0 16px 32px rgba(0,0,0,0.5)) drop-shadow(0 4px 10px rgba(0,0,0,0.35))";
              return (
                <div
                  key={si}
                  className="k-studio__slot-wrap"
                  style={{
                    left: x,
                    top: y,
                    zIndex: z,
                    transform: `rotate(${r}deg)`,
                    filter,
                    opacity: isGhost ? 0.26 : 1,
                  }}
                  data-testid={`studio-stage-frame-slot-${si}`}
                  data-active="false"
                  data-ghost={isGhost ? "true" : "false"}
                >
                  <StageDeviceSVG
                    kind={deviceKind}
                    w={w}
                    h={h}
                    design={designForSlot}
                    isEmpty={!designForSlot}
                    idx={si}
                  />
                </div>
              );
            })
          : null}
      </div>
      {!isPreview ? (
        <div className="k-studio__frame-cap" data-testid="studio-stage-frame-cap">
          {aspectCfg.outputW} × {aspectCfg.outputH} · {aspectCfg.label}
          <span
            style={{
              marginLeft: 8,
              opacity: 0.6,
              fontStyle: "normal",
            }}
            data-testid="studio-stage-frame-deliverable"
          >
            · {aspectCfg.deliverable}
          </span>
          {/* Phase 85 — Continuity hint. Frame mode artık tüm cascade'i
              taşıdığı için caption "From Cascade · {active slot name}"
              sinyali verir. Operator için: stage'deki kompozisyonun
              Mockup mode'dakiyle aynı olduğu ve hangi slot'un active
              ring taşıdığı net görünür. */}
          {designSource !== "empty" ? (
            <span
              style={{
                marginLeft: 10,
                opacity: 0.5,
                fontStyle: "normal",
              }}
              data-testid="studio-stage-frame-source"
              data-source={designSource}
            >
              ·{" "}
              {designSource === "slot" && activeSlot
                ? `Cascade · active ${activeSlot.name}`
                : "Cascade · sample preview"}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export interface MockupStudioStageProps {
  mode: StudioMode;
  slots: ReadonlyArray<StudioSlotMeta>;
  selectedSlot: number;
  setSelectedSlot: (i: number) => void;
  appState: StudioAppState;
  setAppState: (next: StudioAppState) => void;
  /** Phase 79 — render-done banner "Create Mockup" CTA + RenderDone /
   *  re-render. Mockup pipeline POST /api/mockup/jobs trigger. */
  onCreateMockup?: () => void;
  /** Phase 82 — productType-aware stage shape. Shell resolve eder
   *  (selection items[0].productTypeKey) ve Stage'e geçirir. Bookmark
   *  vertical strip, wall art frame, sticker die-cut, tshirt
   *  silhouette vb. Bilinmeyen → phone fallback. */
  deviceKind: StudioStageDeviceKind;
  /** Phase 83 — Frame mode bounded canvas aspect ratio. Shell
   *  state taşır (1:1 / 4:5 / 9:16 / 16:9 / 3:4). Mockup mode'da
   *  görmezden gelinir; Frame mode'da bounded canvas dims + caption
   *  + deliverable type label aspect'e göre live update edilir. */
  frameAspect: FrameAspectKey;
  /** Phase 88 — Ambient scene surface palette propagation.
   *
   * Shots.so/MockupViews real-image-upload: stage'in arkasında
   * always-on scene surface var, operator asset paletinden
   * auto-generated. Selected slot palette `--ks-stage-scene-warm`
   * + `--ks-stage-scene-deep` CSS custom properties olarak inject
   * edilir; Phase 88 stage-scene radial-gradient layer'ı bu
   * tone'ları kullanır.
   *
   * Phase 86 baseline'da preset rail + Magic Preset thumb için
   * activePalette zaten resolve ediliyor; Phase 88 aynı palette'i
   * stage scene'e taşır. */
  activePalette?: readonly [string, string];
  /** Phase 89 — Frame mode scene control override.
   *
   * Shell sceneOverride state'i Stage'e iletir; resolveSceneStyle
   * mode'a göre warm/deep CSS custom properties hesaplar:
   *   - auto: Phase 88 baseline (activePalette × 0.10 / 0.55)
   *   - solid: operator tek renk (× 0.04 / 0.92, dominant)
   *   - gradient: operator two-tone (× 0.15 / 0.65, vibrant subtle)
   *
   * Mode-AGNOSTIC: hem Mockup hem Frame modunda scene aynı şekilde
   * render edilir; Frame mode controls Shell state'i değiştirir,
   * Mockup mode'da değişim görünür kalır. */
  sceneOverride?: SceneOverride;
  /** Phase 96 — Layout count Shell state (bug #13).
   *  Stage cascade item count'unu sınırlar. Rail head 1/2/3 buttons
   *  ile aynı Shell state'i paylaşır. */
  layoutCount?: 1 | 2 | 3;
}

export function MockupStudioStage({
  mode,
  slots,
  selectedSlot,
  setSelectedSlot,
  appState,
  setAppState,
  onCreateMockup,
  deviceKind,
  frameAspect,
  activePalette,
  sceneOverride,
  layoutCount,
}: MockupStudioStageProps) {
  const isPreview = appState === "preview" || appState === "renderDone";
  const isRender = appState === "render";
  const isEmpty = appState === "empty";

  /* Phase 88 + Phase 89 — Scene surface CSS custom property inject.
   *
   * Phase 88 baseline'da yalnız selected slot palette'ten asset-aware
   * subtle ambient gradient (warm × 0.10 + deep × 0.55) hesaplanıyordu.
   *
   * Phase 89: Frame mode swatch controls (Magic/Solid/Gradient)
   * scene'i override edebilir. Shell sceneOverride state'i Stage'e
   * iletilir; resolveSceneStyle mode'a göre warm/deep değerleri
   * hesaplar:
   *   - auto: Phase 88 baseline (activePalette × 0.10 / 0.55)
   *   - solid: operator tek renk (× 0.04 / 0.92, dominant)
   *   - gradient: operator two-tone (× 0.15 / 0.65, vibrant subtle)
   *
   * Mode-AGNOSTIC: scene Mockup mode'da da görünür; Frame mode'da
   * operator değiştirdikten sonra Mockup'a geri dönerse scene
   * korunur — Shots.so canonical continuity. */
  const sceneTones = resolveSceneStyle(
    sceneOverride ?? { mode: "auto" },
    activePalette,
  );
  const sceneStyle = sceneTones
    ? ({
        "--ks-stage-scene-warm": sceneTones.warm,
        "--ks-stage-scene-deep": sceneTones.deep,
      } as React.CSSProperties)
    : undefined;

  /* Phase 91 — Visible background plate (bounded canvas surface).
   *
   * Phase 88-90 ambient scene tint stage'in geneli için subtle
   * radial gradient'di; Shots.so research'i (boş + Frame mode +
   * Mockup mode birebir aynı kanıt) bounded plate'in stage'in
   * ortasında ana subject olduğunu gösterdi. Phase 91 plate'i
   * Stage'in ortasında bounded surface olarak ekler; cascade
   * plate'in İÇİNDE yaşar. Plate her iki modda görünür; sceneOverride
   * plate'in bg'sini kontrol eder. Ambient scene plate'in dışında
   * padding alanı için subtle vignette katmanı olarak korunur. */
  const plateBgRaw = resolvePlateBackground(
    sceneOverride ?? { mode: "auto" },
    activePalette,
  );
  const plateDims = plateDimensionsFor(mode, frameAspect);
  /* Phase 98 — Plate effects (Glass + Lens Blur) resolved from
   * sceneOverride. Sözleşme #11: Frame controls plate bg'sini
   * değiştirir; #3: plate mode-AGNOSTIC görünür. Glass overlay
   * plate'in İÇ üst katmanı (backdrop-filter); Lens Blur plate
   * bg'sine CSS filter blur uygular. */
  const plateEffects = resolvePlateEffects(sceneOverride ?? { mode: "auto" });
  const plateStyle: React.CSSProperties = {
    width: plateDims.w,
    height: plateDims.h,
    ...(plateBgRaw ? { background: plateBgRaw } : {}),
    /* Phase 98 — Lens Blur (Frame Effects "Lens Blur" tile).
     *
     * Plate bg + cascade içeriği üzerine CSS filter blur uygular.
     * Cascade visibility kaybolmasın diye `cascadeScale 1.0` ve
     * scaled inner stage'te zaten transform vardı; filter blur
     * tüm plate-child'larını yumuşatır (operator için "out-of-focus
     * atmospheric scene" hissi). Mockup mode'a continuity ile
     * taşınır (sözleşme #2 stage continuity). */
    ...(plateEffects.filterBlurPx > 0
      ? { filter: `blur(${plateEffects.filterBlurPx}px)` }
      : {}),
  };

  return (
    <div
      className="k-studio__stage"
      data-testid="studio-stage"
      data-mode={mode}
      data-state={appState}
      data-device-kind={deviceKind}
      data-frame-aspect={frameAspect}
      data-scene-asset-aware={activePalette ? "true" : "false"}
      style={sceneStyle}
    >
      {/* Phase 88 — Always-on ambient scene surface.
       *
       * Shots.so + MockupViews real-upload research kanıtı: her iki
       * üründe boş state'te bile stage'de gradient surface aktif;
       * asset upload sonrası asset-aware Magic bg auto-generate.
       * Operator için "asset bir sahnede yaşıyor" hissi.
       *
       * Bizde Phase 87 baseline tek dark void idi. Phase 88 ambient
       * scene ekledi: Shell activePalette CSS custom properties
       * olarak inject eder, scene layer subtle warm/deep radial
       * vignette ile asset-aware tinting yapar. Mode-AGNOSTIC.
       *
       * z-index: -1 stage'in arka katmanı; ambient glow + placement
       * floor + slot wrap üstte yaşar. Pointer-events: none —
       * operator slot click davranışı bozulmaz. */}
      {!isRender ? (
        <div
          className="k-studio__stage-scene"
          data-testid="studio-stage-scene"
          aria-hidden
        />
      ) : null}
      {/* Phase 87 — Ambient glow (her iki modda görünür).
       *
       * Phase 84 baseline'da yalnız Mockup mode'da görünüyordu çünkü
       * Frame mode'da kendi bounded canvas'ı vardı. Phase 87'de
       * bounded canvas kaldırıldı: Frame mode'da da cascade aynı
       * stage'de yaşar, ambient glow da o sahnenin bir parçası
       * olarak korunur. Operator için "tek sahne" continuity. */}
      {!isRender ? (
        <div className="k-studio__stage-amb" />
      ) : null}
      {/* Phase 87 — Placement floor (her iki modda görünür).
       *
       * Phase 84 baseline'da Frame mode'da floor display:none idi
       * çünkü Frame mode'da bounded cream canvas vardı. Phase 87'de
       * bounded canvas kaldırıldı — cascade Frame mode'da da Mockup
       * mode'la aynı placement floor + contact shadow üzerinde
       * yaşar. Operator için Mockup ↔ Frame geçişinde sahne
       * BIREBIR aynı, sadece sol panel content swap. */}
      {!isRender ? (
        <div
          className="k-studio__stage-floor"
          data-testid="studio-stage-floor"
          aria-hidden
        />
      ) : null}

      {/* Phase 91 — Visible background plate (Shots.so canonical
       *  bounded surface). Plate stage'in ortasında, mode-aware
       *  aspect dimensions, sceneOverride-driven bg. Cascade
       *  composition plate'in İÇİNDE merkezi olarak yaşar.
       *  Operator için: "objenin arkasında gerçek görünen surface"
       *  ana subject. */}
      {!isRender ? (
        <div
          className="k-studio__stage-plate"
          data-testid="studio-stage-plate"
          data-mode={mode}
          data-frame-aspect={frameAspect}
          data-scene-mode={sceneOverride?.mode ?? "auto"}
          data-glass-variant={
            sceneOverride?.mode === "glass"
              ? (sceneOverride.glassVariant ?? "light")
              : ""
          }
          data-lens-blur={
            (sceneOverride?.lensBlur ?? false) ? "true" : "false"
          }
          style={plateStyle}
        >
          {mode === "mockup" ? (
            <MockupComposition
              slots={slots}
              selectedSlot={selectedSlot}
              onSelect={setSelectedSlot}
              isPreview={isPreview}
              deviceKind={deviceKind}
              plateDims={plateDims}
              layoutCount={layoutCount ?? 3}
            />
          ) : (
            <FrameComposition
              isEmpty={isEmpty}
              isPreview={isPreview}
              deviceKind={deviceKind}
              frameAspect={frameAspect}
              slots={slots}
              selectedSlot={selectedSlot}
              plateDims={plateDims}
              layoutCount={layoutCount ?? 3}
            />
          )}
          {/* Phase 98 — Glass overlay (Frame Glass swatch).
           *
           * Sözleşme #11: Frame Glass swatch'ları plate bg'sini
           * değiştirir. Phase 98 düzeltmesi: glass overlay plate'in
           * IÇ üst katmanı, `backdrop-filter: blur()` ile altta
           * yatan plate bg + cascade'i frosted-glass-effect olarak
           * gösterir; ayrıca variant tone + subtle border ile cam-üstü
           * hissi.
           *
           * Mode-AGNOSTIC: glass override Frame mode'da seçilir
           * ama overlay Mockup mode'a da continuity ile taşınır
           * (sözleşme #2 stage continuity). Plate'in cascade
           * pozisyonunu/ölçeğini bozmaz — yalnız üstüne overlay
           * katmanı koyar.
           *
           * pointer-events: none — operator slot click davranışı
           * bozulmaz; selection chrome cascade'in altında yaşadığı
           * için glass overlay yine de görünebilir. */}
          {plateEffects.glassOverlay ? (
            <div
              className="k-studio__plate-glass"
              data-testid="studio-stage-plate-glass"
              data-glass-variant={
                sceneOverride?.glassVariant ?? "light"
              }
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: plateEffects.glassOverlay.background,
                backdropFilter: "blur(10px) saturate(1.05)",
                WebkitBackdropFilter: "blur(10px) saturate(1.05)",
                borderRadius: "inherit",
                border: `1px solid ${plateEffects.glassOverlay.borderTone}`,
                pointerEvents: "none",
                zIndex: 3,
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.12)",
              }}
            />
          ) : null}
        </div>
      ) : null}

      {isEmpty && !isPreview && !isRender ? (
        <div
          className="k-studio__empty-cap"
          data-testid="studio-stage-empty-cap"
        >
          {mode === "mockup"
            ? "Drop media in the panel to begin"
            : "Select a background to start your frame"}
        </div>
      ) : null}

      {isRender ? (
        <div className="k-studio__render-ov" data-testid="studio-stage-render-overlay">
          <div className="k-studio__spinner" />
          <span className="k-studio__render-cap">Rendering…</span>
          <span className="k-studio__render-sub">
            4096 × 4096 · 3 variants
          </span>
          <button
            type="button"
            className="k-studio__render-cancel"
            onClick={() => setAppState("renderDone")}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {appState === "renderDone" ? (
        <div
          className="k-studio__render-banner"
          data-testid="studio-stage-render-banner"
        >
          <StudioIcon
            name="check"
            size={13}
            color="rgba(135,215,165,0.9)"
          />
          <span className="k-studio__render-banner-text">
            Render ready · 4096×4096 · 3 variants · 1.4s
          </span>
          <button type="button" className="k-studio__render-action">
            <StudioIcon name="download" size={11} />
            Download
          </button>
          <button
            type="button"
            className="k-studio__render-action"
            data-primary="true"
            onClick={() => {
              if (mode === "frame") return;
              if (onCreateMockup) onCreateMockup();
            }}
            disabled={mode === "frame" || !onCreateMockup}
            data-testid="studio-stage-create-mockup"
            title={
              mode === "frame"
                ? "Frame output — coming Phase 80+"
                : "Render another mockup pack"
            }
          >
            Create {mode === "frame" ? "Frame" : "Mockup"}
          </button>
        </div>
      ) : null}

      {isPreview ? (
        <button
          type="button"
          className="k-studio__edit-pill"
          onClick={() => setAppState("working")}
          data-testid="studio-stage-edit-pill"
        >
          <StudioIcon
            name="arrowL"
            size={11}
            color="rgba(255,255,255,0.38)"
          />
          Back to Edit
        </button>
      ) : null}

      {!isRender ? (
        <div className="k-studio__zoom-pill" data-testid="studio-stage-zoom-pill">
          <button type="button" className="k-studio__zp-btn" aria-label="Zoom out">
            −
          </button>
          <span className="k-studio__zp-val">50%</span>
          <button type="button" className="k-studio__zp-btn" aria-label="Zoom in">
            +
          </button>
          <button type="button" className="k-studio__zp-fit">
            <StudioIcon name="mountain" size={10} />
            Fit
          </button>
        </div>
      ) : null}
    </div>
  );
}
