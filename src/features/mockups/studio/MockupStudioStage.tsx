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
  resolvePlateBackground,
  resolveLensBlurLayout,
  resolveWatermarkLayout,
  type SceneOverride,
} from "./frame-scene";
import {
  PhoneSVG,
  StageDeviceSVG,
  STUDIO_SAMPLE_DESIGNS,
  type StudioStageDeviceKind,
} from "./svg-art";
import {
  cascadeLayoutFor,
  compositionGroup,
  plateRadiusForWidth,
  resolvePlateBox,
} from "./cascade-layout";
import {
  resolveMediaOffsetPx,
  type MediaPosition,
} from "./media-position";
import {
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  clampZoom,
} from "./zoom-bounds";
import type {
  StudioAppState,
  StudioLayoutVariant,
  StudioMode,
  StudioSlotMeta,
} from "./types";

/* Phase 136 — statik monokrom film-grain data-URI (bir kez
 *  encode; render'da yeniden hesaplanmaz). Opacity ayrı prop. */
const BG_GRAIN_DATA_URI =
  'url("data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">' +
      '<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" seed="7" stitchTiles="stitch"/>' +
      '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.6 0.6 0.6 0 0"/></filter>' +
      '<rect width="160" height="160" filter="url(#g)"/></svg>',
  ) +
  '")';

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

/* Phase 116 fu2 — `resolvePlateBackground` paylaşılan `frame-scene.ts`'e
 * taşındı (canonical shared: Stage + rail thumb tek kaynak — "tek
 * sahne çok ekran"). Buradan import edilir; lokal kopya kaldırıldı
 * (sessiz drift YASAK §12 — tek tanım). */

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
  viewportW: number,
  viewportH: number,
  railCollapsed: boolean,
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
  /* Phase 110 — Aspect-locked viewport-aware bbox-fit (Shots.so
   * canonical: aspect daima sabit, plate viewport ile orantılı
   * zoom-out).
   *
   * Phase 95-109 BUG: fixed maxW=1080/maxH=820 + CSS BAĞIMSIZ
   * `max-width:85%` & `max-height:82%` clamp. İki ayrı % cap →
   * biri tetiklenince diğeri orantısal küçülmüyor → 16:9 plate
   * @1440 aspect 1.432, @1180 1.097 (16:9=1.778'den sapıyor;
   * kompozisyon görsel bozuluyor). Kullanıcı "browser daralınca
   * aspect sabit kalmıyor" şikayetinin kök nedeni.
   *
   * Phase 110 fix: available stage alanını viewport'tan hesapla
   * (sidebar 214 + rail 0/202 + padding çıkar), aspect-locked
   * bbox-fit. CSS `.k-studio__stage-plate` max-w/max-h % clamp'ı
   * KALDIRILDI (aspect bozan kaynak) — plate boyutu tamamen bu
   * helper'da, tek aspect-sabit hesapta. cascadeScale plateDims'i
   * kullandığı için otomatik düzelir (plate küçülünce cascade de
   * orantılı = birlikte zoom-out). railCollapsed → rail alanı
   * stage'e geçer (Shots ara aşaması parity). */
  /* Phase 133 — Tek canonical `resolvePlateBox` (cascade-layout.ts).
   *
   * Phase 95-110 manuel hesabı (availW=stage×0.9, availH=stage×0.86,
   * capW=min(.,1180), capH=min(.,880), aspect-locked bbox-fit)
   * resolvePlateBox'ın container-agnostic genelleştirmesinin TAM
   * özel hâli → davranış BİREBİR (viewport-aware + aspect SHARED +
   * cap korunur; regression yok). Tek fark: artık StageScenePreview
   * (rail/zoom) AYNI fonksiyonu kendi ölçülen kart box'ıyla çağırır
   * → "görünüşte tek render path" GERÇEKTEN tek (Preview = Export =
   * Rail-thumb = Navigator-viewfinder §11.0; PREVIEW_BASE+scale
   * sahte sarmalama KALDIRILDI). */
  const cfg = FRAME_ASPECT_CONFIG[frameAspect];
  const SIDEBAR_W = 214;
  const RAIL_W = railCollapsed ? 0 : 202;
  const stageW = Math.max(280, viewportW - SIDEBAR_W - RAIL_W);
  const stageH = Math.max(220, viewportH - 24); // toolbar/padding payı
  return resolvePlateBox(cfg.ratio, stageW, stageH, {
    fillW: 0.9,
    fillH: 0.86,
    capW: 1180,
    capH: 880,
  });
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

/* Phase 115/129 — `centerCascade` + `cascadeLayoutFor` +
 * `applyLayoutVariant` + `cascadeLayoutForRaw` + `compositionGroup`
 * + `PLATE_FILL_FRAC` `./cascade-layout` paylaşılan module'ünde.
 *
 * Phase 115: cascade layout fn'leri taşındı (rail thumb svg-art
 * circular import edemezdi; ayrı module → Stage + Shell/export +
 * rail thumb tek kaynak). compositionGroup Stage'de kalmıştı.
 *
 * Phase 129: navigator viewfinder matematiği de AYNI full-
 * composition geometrisini kullanmak zorunda (viewfinder = middle
 * panel görünür penceresinin navigator-uzayındaki gerçek izdüşümü;
 * keyfi 1/zoom DEĞİL). compositionGroup + PLATE_FILL_FRAC da
 * cascade-layout.ts'e taşındı → Stage (preview) + Shell (export) +
 * rail thumb + navigator viewfinder HEPSİ tek canonical composition
 * geometrisinden okur (§11.0 Preview = Export = Rail-thumb =
 * Navigator-viewfinder yapısal garanti). Stage davranışı BİREBİR
 * korunur (import edip aynen çağırır; Phase 111 baseline). */

function MockupComposition({
  slots,
  selectedSlot,
  onSelect,
  isPreview,
  deviceKind,
  plateDims,
  layoutCount,
  layoutVariant,
  previewZoom = 1,
}: MockupCompositionProps & {
  plateDims: { w: number; h: number };
  layoutCount: 1 | 2 | 3;
  layoutVariant: StudioLayoutVariant;
  /** Phase 125 — Preview-only zoom (Shots.so canonical: composition
   *  içeriği scale, plate SABİT). cascadeScale ile çarpılır;
   *  plate `overflow:hidden` kırpar (preview-inspection). 1 = no-op.
   *  Rail thumb (chromeless) daima 1 → rail bağımsız. */
  previewZoom?: number;
}) {
  /* Phase 96 — Layout count Shell state ile cascade item count
   * sınırlandı (bug #13). Rail head 1/2/3 buttons → Shell setter →
   * layoutCount → Stage MockupComposition + FrameComposition + rail
   * thumb hepsi aynı limit'i uygular.
   *
   * Phase 97 — slice helper içine taşındı (single-item center fix).
   *
   * Phase 114 — layoutVariant canonical shared parameter. Rail
   * "Layout Presets" no-op idi; artık Shell layoutVariant state →
   * Stage cascade + Frame export + rail thumb HEPSİ bu tek
   * değerden okur (Preview = Export Truth §11.0). cascadeLayoutFor
   * (kind, count, variant). */
  const rawPhones = cascadeLayoutFor(deviceKind, layoutCount, layoutVariant);
  /* Phase 111 — Plate-relative LOCKED composition group.
   *
   * Phase 95-110 baseline: stage-inner sabit 572×504 +
   * `Math.min(innerW/572, innerH/504, 1.0)` (tek-eksen fit +
   * clamp). Plate aspect değişince group bbox/plate oranı kayar
   * (16:9 %55.5 → 1:1 %84.1), 572×504 ≠ plate aspect → group
   * center plate center'da değil + rotation'lı item görsel
   * drift (16:9 @1440 centerDy:22). Cascade plate'e KİLİTLİ
   * DEĞİL.
   *
   * Phase 111: compositionGroup gerçek bbox + plate-fit scale
   * (PLATE_FILL_FRAC, clamp YOK) + items 0-origin normalize.
   * stage-inner BBOX-TIGHT (572×504 değil, bbox boyutu) →
   * CSS plate-center → group center = plate center (drift
   * sıfır, rotation simetrik). Items relative offset korunur
   * (0-origin normalize birbirlerine göre değişmez). Sonuç:
   * aspect/viewport ne olursa olsun plate-relative LOCKED
   * composition (Sözleşme §2 stage continuity + §3 plate +
   * §11.0 Preview=Export + Phase 111 canonical). */
  const grp = compositionGroup(rawPhones, plateDims.w, plateDims.h);
  const phones = grp.items;
  /* Phase 125 — Shots.so canonical: zoom composition layer'ına
   * (plate SABİT). cascadeScale (Phase 111 plate-fit) × previewZoom
   * (operatör zoom). Plate `overflow:hidden` taşmayı kırpar
   * (preview-inspection). previewZoom=1 → Phase 122 BİREBİR. */
  const cascadeScale = grp.scale * previewZoom;
  return (
    <div
      className="k-studio__stage-inner"
      style={{
        width: grp.bboxW,
        height: grp.bboxH,
        transform: `scale(${cascadeScale})`,
        transformOrigin: "center center",
        /* Phase 113 — Layer 3 (item layer) effect layer'ın (Layer
         * 2, z-index 1) ÜSTÜNDE. Cascade DOM'da glass'tan sonra
         * gelir; explicit z-index 2 stacking context robustluğu
         * (grain/glass z1 < cascade z2). Phase 139 — Lens Blur
         * tek-davranışlı: blur plate'in KENDİSİNE (target ayrımı
         * + ayrı content-blur layer KALDIRILDI). */
        position: "relative",
        zIndex: 2,
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
  layoutVariant,
  previewZoom = 1,
}: FrameCompositionProps & {
  deviceKind: StudioStageDeviceKind;
  frameAspect: FrameAspectKey;
  plateDims: { w: number; h: number };
  layoutCount: 1 | 2 | 3;
  layoutVariant: StudioLayoutVariant;
  /** Phase 125 — Preview-only zoom (Shots.so canonical: composition
   *  içeriği scale, plate SABİT). MockupComposition ile BİREBİR
   *  aynı (mode-AGNOSTIC §2). 1 = no-op; rail thumb daima 1. */
  previewZoom?: number;
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

  /* Cascade layout: Mockup mode ile birebir aynı (cascadeLayoutFor
   * + 572×504 inner stage). Phase 87'de scale = 1 (Mockup mode ile
   * aynı boyut). Phase 96 — layoutCount ile slice (bug #13).
   * Phase 97 — slice helper içine taşındı (single-item center fix);
   * cascadeLayoutFor (kind, layoutCount) signature, center slice
   * sonrası.
   *
   * Phase 114 — layoutVariant canonical shared parameter (Frame
   * mode cascade = preview; Frame export aynı variant'ı kullanır,
   * Preview = Export Truth §11.0). */
  const rawPhones = cascadeLayoutFor(deviceKind, layoutCount, layoutVariant);

  const hasAnyAssignedSlot = slots.some((s) => s.assigned);
  const designSource: "slot" | "sample" | "empty" = isEmpty
    ? "empty"
    : hasAnyAssignedSlot
      ? "slot"
      : "sample";

  /* Phase 111 — Plate-relative LOCKED composition group (Frame
   * side; MockupComposition ile BİREBİR aynı — Sözleşme §2 stage
   * continuity mode-AGNOSTIC). compositionGroup gerçek bbox +
   * plate-fit scale (PLATE_FILL_FRAC, clamp YOK) + 0-origin
   * normalize; stage-inner BBOX-TIGHT → CSS plate-center →
   * group center = plate center (drift sıfır, rotation simetrik).
   * Items relative offset korunur. */
  const grp = compositionGroup(rawPhones, plateDims.w, plateDims.h);
  const phones = grp.items;
  /* Phase 125 — Shots.so canonical: zoom composition layer'ına
   * (plate SABİT, mode-AGNOSTIC — MockupComposition ile BİREBİR).
   * cascadeScale × previewZoom; plate `overflow:hidden` kırpar.
   * previewZoom=1 → Phase 122 BİREBİR. */
  const cascadeScale = grp.scale * previewZoom;

  return (
    <>
      <div
        className="k-studio__stage-inner"
        style={{
          width: grp.bboxW,
          height: grp.bboxH,
          transform: `scale(${cascadeScale})`,
          transformOrigin: "center center",
          /* Phase 113 — Layer 3 (item layer) effect layer'ın
           * (Layer 2, z-index 1) ÜSTÜNDE. Mode-AGNOSTIC: Frame
           * mode'da da glass/blur cascade item'ları etkilemez
           * (sözleşme #2 stage continuity + §11.0). */
          position: "relative",
          zIndex: 2,
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
      {/* Phase 122 — Frame mode plate caption (`.k-studio__frame-cap`)
          KALDIRILDI. Kullanıcı: "frame modda plate üzerindeki yazı
          tam okunmuyor, gerekli değilse kaldırabiliriz." Caption
          aspect/dims/deliverable bilgisini gösteriyordu ama bu zaten
          toolbar'da var (Phase 83 baseline: templateLabel "Frame ·
          {deliverable}" + statusLabel "{outputW}×{outputH}"); "Cascade
          · active {slot}" continuity hint'i de Phase 121 rail
          slot-ring/badge ile redundant. Preview-only chrome (exported
          PNG'de yok — §11.0 editing-helper kategorisi); cream plate
          üstünde açık renk okunmuyordu. Kaldırınca SIFIR bilgi kaybı
          (toolbar + rail aynısını taşıyor). */}
    </>
  );
}

/* Phase 117 — Single-renderer: shared StageScene component.
 *
 * Yanlış model (Phase 116 fu2 dahil): middle panel `MockupComposition`
 * + CSS plate/scene divs; rail thumb `PresetThumbMockup` AYRI SVG
 * renderer + `fitCascadeToThumb` AYRI fit math + SVG-rect ile
 * yeniden çizilmiş scene/plate. `cascadeLayoutFor`+`StageDeviceSVG`
 * ortak ama composition + chrome AYRI — elle senkronlanan iki
 * görsel sistem ("benzetmeye çalışan ikinci renderer").
 *
 * Doğru model (Phase 117): TEK render component, İKİ ölçek.
 * `StageScene` = scene→amb→floor→plate→(grain/glass)→
 * MockupComposition/FrameComposition bloğunun tamamı. Stage büyük
 * ekranda render eder (selected layoutVariant); rail thumb AYNI
 * `StageScene`'i CSS `transform: scale()` ile küçültülmüş + küçük
 * sabit plateDims + candidate layoutVariant ile render eder. Ayrı
 * SVG thumb renderer YOK. Tek fark: ölçek + layoutVariant
 * (Contract §6 "right rail = canlı mini middle-panel previews";
 * §11.0 Preview = Export = Rail-thumb — tek render path).
 *
 * compositionGroup/MockupComposition/FrameComposition AYNI dosyada
 * KALIR (Phase 111-116 battle-tested, taşıma riski yok); StageScene
 * onları aynen çağırır. StageScenePreview.tsx (rail) bu component'i
 * import eder (StageScene→svg-art; PresetRail→StageScenePreview→
 * StageScene; Stage StageScenePreview'i import ETMEZ → cycle yok). */
export interface StageSceneProps {
  mode: StudioMode;
  slots: ReadonlyArray<StudioSlotMeta>;
  selectedSlot: number;
  setSelectedSlot: (i: number) => void;
  appState: StudioAppState;
  deviceKind: StudioStageDeviceKind;
  frameAspect: FrameAspectKey;
  activePalette?: readonly [string, string];
  sceneOverride?: SceneOverride;
  layoutCount: 1 | 2 | 3;
  layoutVariant: StudioLayoutVariant;
  /** Resolved plate dims. Stage: viewport-aware plateDimensionsFor.
   *  Thumb: küçük sabit (scale CSS ile minyatür). */
  plateDims: { w: number; h: number };
  isPreview: boolean;
  isRender: boolean;
  isEmpty: boolean;
  /** Phase 118 — Chrome-suppressed render (rail thumb only).
   *
   * Kullanıcı (Phase 118): "right rail'de stage'i / siyah kutuyu
   * görüyorum; Shots.so'daki gibi yalnız preview görünmeli".
   * Phase 117 single-renderer DOĞRU yön (tek render path) ama
   * `StageScene`'in TAMAMINI render ediyordu — `.k-studio__stage`
   * dark bg (--ks-st) + `::before` dot-grid + `.k-studio__stage-
   * scene` ambient tint + `.k-studio__stage-floor` placement floor.
   * Bunlar **stage container chrome'u** (operatör çalışma alanı
   * tonu) — rail thumb'da görünmemeli. Shots.so'da rail thumb
   * yalnız plate + composition gösterir, stage kutusu YOK.
   *
   * chromeless=true:
   *   - `.k-studio__stage` `data-chromeless="true"` → CSS bg
   *     transparent + `::before` dot-grid display:none
   *   - `.k-studio__stage-scene` + `.k-studio__stage-floor`
   *     render EDİLMEZ (görünür stage chrome layer'ları;
   *     `-amb` zaten display:none — Phase 94 baseline)
   *   - Plate + MockupComposition/FrameComposition AYNEN render
   *     (tek render path korunur — sessiz drift §12 YASAK)
   *
   * Stage main fn (orta panel) chromeless=false (default) →
   * Phase 117 davranışı BİREBİR (DOM byte-identical, regression
   * yok). Yalnız StageScenePreview chromeless=true geçer. */
  chromeless?: boolean;
  /** Phase 123 — Preview-only zoom (rail-head Zoom slider).
   *
   * Operatör orta paneldeki kompozisyonu yakınlaştırıp inceleyebilsin
   * (Shots.so preview-inspection kontrolü). Yalnız **orta panel
   * plate'ine** CSS `transform: scale()` olarak uygulanır; canonical
   * visual parameter DEĞİL — Contract kategori 2 (mode/UI-specific
   * helper state). §11.0 Preview = Export Truth: export pipeline
   * (frame-compositor.ts) bu değeri ASLA görmez (zoom = viewing aid,
   * final visual değil). chromeless=true (rail candidate thumb)
   * iken UYGULANMAZ — rail preview'ları bağımsız (Phase 117-118
   * single-renderer + chromeless baseline'ı bozulmaz). 1.0 = no-op
   * (default; Phase 122 davranışı BİREBİR). */
  previewZoom?: number;
  /** Phase 126 — Global canonical media-position. {0,0} = no-op
   *  (Phase 125 byte-identical). Outer wrapper translate; inner
   *  .k-studio__stage-inner zoom scale ayrı (kat 1 vs kat 2). Rail
   *  thumb da yansıtır (canonical — zoom'un AKSİNE). */
  mediaPosition?: MediaPosition;
  /** Stage main fn'in overlay'leri (empty-cap / render-ov / zoom-
   *  pill / edit-pill / render banner) AYNI `k-studio__stage` div'i
   *  içinde sibling olarak kalır → Stage DOM byte-identical.
   *  Thumb children GEÇMEZ (yalnız scene→plate→cascade). */
  children?: React.ReactNode;
}

export function StageScene({
  mode,
  slots,
  selectedSlot,
  setSelectedSlot,
  appState,
  deviceKind,
  frameAspect,
  activePalette,
  sceneOverride,
  layoutCount,
  layoutVariant,
  plateDims,
  isPreview,
  isRender,
  isEmpty,
  chromeless = false,
  previewZoom = 1,
  mediaPosition = { x: 0, y: 0 },
  children,
}: StageSceneProps) {
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
  const plateBgRaw = resolvePlateBackground(
    sceneOverride ?? { mode: "auto" },
    activePalette,
  );
  const plateEffects = resolvePlateEffects(sceneOverride ?? { mode: "auto" });
  const lensBlurActive = plateEffects.filterBlurPx > 0;
  /* Phase 136 — BG Effects (tek-seçimli; resolvePlateEffects'ten
   *  okunur — preview = export aynı pure-TS resolver §11.0).
   *  bgEffect yokken ikisi de 0 → hiçbir layer render edilmez
   *  (DOM byte-identical no-op). */
  const vignetteActive = plateEffects.vignetteAlpha > 0;
  const grainActive = plateEffects.grainOpacity > 0;
  /* Phase 125 — Shots.so canonical zoom: plate SABİT-boyut,
   * composition İÇERİĞİ scale (plate `overflow:hidden` kırpar =
   * preview-inspection). Phase 123/124 plate'i scale ediyordu
   * (chrome büyüyordu); Shots.so canlı browser ölçümü plate'in
   * SABİT kaldığını, içerideki `.component` (≈ Kivasy
   * `.k-studio__stage-inner`) scale ettiğini kanıtladı.
   *
   * effectiveZoom: rail thumb (chromeless=true) DAİMA 1 → rail
   * candidate preview'ları operatör zoom'undan bağımsız (Phase
   * 117-118 single-renderer + chromeless baseline bozulmaz).
   * Orta panel (chromeless=false) → previewZoom. Compositions'a
   * iletilir; plate transform/CSS-var YOK (export Sharp bu
   * değeri ASLA görmez §11.0). */
  const effectiveZoom = chromeless ? 1 : previewZoom;
  /* Phase 134 — Plate radius + drop shadow PLATE GENİŞLİĞİNE
   * ORANSAL (kullanıcı: "right rail preview kartların köşeleri
   * middle paneldekinden daha yuvarlatılmış + koyu gri → siyah →
   * sarı kart stacking").
   *
   * Kök neden: studio.css `.k-studio__stage-plate` `border-radius:
   * 26px` + `box-shadow: 0 26px 51px..., 0 51px 82px...` SABİT px.
   * Middle plate ~900-1180px → 26/1080 ≈ %2.4 (subtle köşe; geniş
   * gölge alana yumuşak yayılır). Rail/zoom thumb plate ~146px →
   * 26/146 ≈ %18 (ÇOK yuvarlak köşe) + 26-51px offset / 51-82px
   * blur SABİT gölge küçük karta oranla DEVASA → kartı saran
   * belirgin siyah halka (rail dark bg `--ks-sh #1C1916` üzerinde
   * "koyu gri → siyah halka → sarı kart" stacking hissi).
   *
   * Fix: radius + shadow plate genişliğine ORANLI (tek formül,
   * iki ölçek — middle ile AYNI görsel oran = "aynı sahnenin
   * küçük versiyonu"). Middle @~1080px → ~26px radius (eski sabit
   * BİREBİR, regression yok); rail @~146px → ~3.5px (proportional,
   * subtle — middle ile aynı görünüm). Inline > stylesheet sabit;
   * CSS recipe fallback olarak proportional baseline'a güncellendi.
   * Tek render path + Phase 133 shared framing DOKUNULMAZ
   * (plateDims/compositionGroup değişmez; yalnız görsel chrome). */
  const plateRadius = plateRadiusForWidth(plateDims.w);
  const sW = plateDims.w;
  const plateBoxShadow = `0 ${Math.round(sW * 0.024)}px ${Math.round(
    sW * 0.047,
  )}px 0 rgba(0,0,0,0.32), 0 ${Math.round(sW * 0.047)}px ${Math.round(
    sW * 0.076,
  )}px 0 rgba(0,0,0,0.30)`;
  /* Lens Blur — TEK-DAVRANIŞLI (Phase 139; target kaldırıldı).
   *  Phase 138 `target="plate"` AYRI content-blur wrapper
   *  kullanıyordu → plate-bg gradyen amber ucu plate kenarına
   *  yayılıp KENARDA TURUNCU BANT (plate overflow:hidden sert
   *  kesim). Çözüm: problemli plate-only yolu KALDIRILDI; tek
   *  yol = eski iyi çalışan "all" davranışı — `filter:blur`
   *  plate'in KENDİSİNE (kenar dahil tüm subtree tek-pass →
   *  koyu stage zemini ile organik harman, turuncu bant YOK,
   *  halo YOK). bg plate'in kendisinde (normal/working yol).
   *  Gerçek plate-only ileride ayrı iş — temiz mimari
   *  (item-izolasyonu zoom/framing'i bozmadan;
   *  known-issues-and-deferred.md). */
  const lensLayout = resolveLensBlurLayout(plateEffects);
  /* Phase 140 — Watermark layout (preview = export AYNI resolver
   * §11.0 Preview = Export Truth).
   *
   * Frame arg = `plateDims` (plate'in GERÇEK render boyutu, ör.
   * 901×507) — `computeFrameCanvasDims` (580×326 cap) DEĞİL.
   *
   * Kök neden: §11.0 sözleşmesi "watermark frame'in AYNI yüzdesel
   * alanını kaplar" demek. Font formülü iki tarafta da
   * `min(dims) × fontPctOfMin`:
   *   - Export (Task 7): min(outputW,outputH) × pct  (16:9 →
   *     min(1920,1080)×0.035 = 37.8px = output yüksekliğinin %3.5'i)
   *   - Preview plateDims ile: min(901,507) × 0.035 = 17.7px =
   *     plate yüksekliğinin %3.5'i  → PARİTE ✓
   *   - Preview computeFrameCanvasDims ile: min(580,326)×0.035 =
   *     11.4px ama plate 507px → %2.25  → ~%36 KÜÇÜK (parite KIRIK)
   * `.k-studio__stage-plate` `computeFrameCanvasDims` boyutunda
   * DEĞİL render ediliyor (browser-DOM: rendered 901×507 =
   * plateDims, inline-style ile birebir). plateDims viewport-aware
   * ama aspect-LOCKED (`FRAME_ASPECT_CONFIG[frameAspect].ratio` —
   * export outputW/outputH ile AYNI oran) → glyph yüzde geometrisi
   * (ratio-invariant, unit-test-kanıtlı) değişmez; yalnız font px
   * doğru ölçeğe oturur. ResizeObserver gerekmez: plateDims zaten
   * deterministik gerçek plate boyutu (DOM ölçümü teyitli).
   * inactive → hiçbir DOM (byte-identical no-op). */
  const wmLayout = resolveWatermarkLayout(
    (sceneOverride ?? { mode: "auto" }).watermark,
    plateDims,
  );
  const plateStyle: React.CSSProperties = {
    width: plateDims.w,
    height: plateDims.h,
    borderRadius: `${plateRadius}px`,
    boxShadow: plateBoxShadow,
    ...(plateBgRaw ? { background: plateBgRaw } : {}),
    ...(lensLayout.plateFilter
      ? { filter: lensLayout.plateFilter }
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
      data-chromeless={chromeless ? "true" : "false"}
      style={sceneStyle}
    >
      {/* Phase 118 — chromeless (rail thumb): stage container chrome
          layer'ları (scene ambient tint + placement floor) render
          EDİLMEZ; `.k-studio__stage` bg + dot-grid CSS ile gizli
          (data-chromeless). Operatör için "siyah kutu / stage
          frame" YOK — yalnız plate + composition (Shots.so parity).
          Orta panel chromeless=false → Phase 117 davranışı BİREBİR. */}
      {!isRender && !chromeless ? (
        <div
          className="k-studio__stage-scene"
          data-testid="studio-stage-scene"
          aria-hidden
        />
      ) : null}
      {!isRender && !chromeless ? (
        <div className="k-studio__stage-amb" />
      ) : null}
      {!isRender && !chromeless ? (
        <div
          className="k-studio__stage-floor"
          data-testid="studio-stage-floor"
          aria-hidden
        />
      ) : null}
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
          data-lens-blur={lensBlurActive ? "true" : "false"}
          data-preview-zoom={String(effectiveZoom)}
          style={plateStyle}
        >
          {/* Phase 136 — Grain layer (compositing: glass'tan ÖNCE
              = altında; plate-bg üstünde). Monokrom film-grain
              (feColorMatrix grayscale çıkış — dijital RGB gürültü
              DEĞİL §4 guardrail). zIndex:1 + DOM'da glass'tan önce
              → eşit zIndex'te glass üstte paint edilir (grain<glass
              composite order). Sharp export greyscale gaussian noise
              ile algısal eşdeğer (§11.0 parity, bit-exact değil). */}
          {grainActive ? (
            <div
              aria-hidden
              data-bg-grain
              data-testid="studio-stage-plate-grain"
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                opacity: plateEffects.grainOpacity,
                backgroundImage: BG_GRAIN_DATA_URI,
                backgroundRepeat: "repeat",
                zIndex: 1,
              }}
            />
          ) : null}
          {plateEffects.glassOverlay ? (
            <div
              className="k-studio__plate-glass"
              data-testid="studio-stage-plate-glass"
              data-glass-variant={sceneOverride?.glassVariant ?? "light"}
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: plateEffects.glassOverlay.background,
                borderRadius: "inherit",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          ) : null}
          {(() => {
            const { ox, oy } = resolveMediaOffsetPx(
              mediaPosition,
              plateDims.w,
              plateDims.h,
            );
            /* Phase 135 — Pan reach ZOOM-AWARE (preview-only).
             *
             * Kök neden (browser+DOM kanıtlandı): `.k-studio__media-
             * pos` translate `ox = mediaPos × plateW × MEDIA_K`
             * ZOOM-BAĞIMSIZ sabit. `.k-studio__stage-inner`
             * composition'ı `scale(grp.scale × effectiveZoom)` ile
             * büyütüyor (Phase 125). Zoom %400'de composition 4×
             * büyük ama pan sabit `plateW×0.5` → mediaPosition=±1
             * (MAX) composition'ın yalnız ~%12.5'ini kaydırır →
             * kullanıcı büyütülmüş composition'ın KÖŞELERİNE pan
             * EDEMEZ ("zoom 400'de fazla kısıtlı"; zoom 75'te tersine
             * aşırı taşar). Marker clamp (Phase 134) SORUN DEĞİL —
             * altındaki pan-reach zaten bozuktu, clamp maskeliyordu.
             *
             * Fix: pan translate `× effectiveZoom`. Composition
             * scale ile orantılı → zoom %400'de mediaPos=±1
             * composition kenarını plate kenarına getirir (köşelere
             * ulaşım korunur; Shots.so `.component` tek transform'da
             * scale+translate birleşik davranışının preview-only
             * eşdeğeri). `effectiveZoom = chromeless ? 1 :
             * previewZoom` → rail thumb DAİMA 1 (Phase 117-118
             * rail-bağımsız korunur). `resolveMediaOffsetPx`
             * (canonical + Sharp export) DEĞİŞMEZ — zoom export'ta
             * YOK (preview-only, Phase 125), export composition
             * scale=1 → pan-reach orada zaten yeterli (§11.0
             * Preview = Export Truth korunur). {0,0} → ox=0 →
             * 0×zoom=0 → translate(0,0) byte-identical no-op
             * (Phase 125/126 baseline). */
            const panZoom = effectiveZoom;
            const oxz = ox * panZoom;
            const oyz = oy * panZoom;
            return (
              <div
                className="k-studio__media-pos"
                data-testid="studio-stage-media-pos"
                data-media-x={mediaPosition.x}
                data-media-y={mediaPosition.y}
                data-pan-zoom={panZoom}
                style={{
                  position: "absolute",
                  inset: 0,
                  // Phase 126 — canonical media-position translate
                  // (outer). Inner .k-studio__stage-inner zoom scale
                  // AYRI (Phase 125 dokunulmaz). Phase 135 — pan
                  // reach × effectiveZoom (composition scale ile
                  // orantılı → zoom yüksekken köşelere ulaşım).
                  // neutral → 0×zoom=0 = DOM byte-identical no-op.
                  transform: `translate(${oxz}px, ${oyz}px)`,
                  transformOrigin: "center center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {mode === "mockup" ? (
                  <MockupComposition
                    slots={slots}
                    selectedSlot={selectedSlot}
                    onSelect={setSelectedSlot}
                    isPreview={isPreview}
                    deviceKind={deviceKind}
                    plateDims={plateDims}
                    layoutCount={layoutCount}
                    layoutVariant={layoutVariant}
                    previewZoom={effectiveZoom}
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
                    layoutCount={layoutCount}
                    layoutVariant={layoutVariant}
                    previewZoom={effectiveZoom}
                  />
                )}
              </div>
            );
          })()}
          {/* Phase 136 — Vignette EN ÜSTTE (glassOverlay + cascade
              composition'dan SONRA DOM'da; zIndex:9 > cascade z:2).
              Lens kenar karartması optik son katman §4. Merkez ~%60
              ŞEFFAF (rgba 0%→60% fully transparent) → subject/portrait
              boğmaz §4 guardrail. Sharp export aynı radial stop'ları
              SVG radialGradient ile composite eder (§11.0 parity). */}
          {vignetteActive ? (
            <div
              aria-hidden
              data-bg-vignette
              data-testid="studio-stage-plate-vignette"
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background:
                  "radial-gradient(ellipse at center, " +
                  "rgba(0,0,0,0) 60%, rgba(0,0,0," +
                  plateEffects.vignetteAlpha +
                  ") 100%)",
                zIndex: 9,
              }}
            />
          ) : null}
          {/* Phase 140 — Watermark overlay EN ÜSTTE (vignette z:9'dan
              SONRA DOM'da; zIndex:10). resolveWatermarkLayout AYNI
              resolver export (Task 7 Sharp SVG) ile → §11.0 Preview =
              Export Truth. Font px = min(plateDims.w,plateDims.h) ×
              fontPctOfMin (export min(outputW,outputH) × fontPctOfMin
              ile AYNI formül; plateDims export output ile AYNI oran →
              font frame'in AYNI yüzdesi = parite). transform anchor
              map = SVG text-anchor (start/middle/end) + dominant-
              baseline:middle eşdeğeri. inactive → hiçbir DOM
              (byte-identical no-op). */}
          {wmLayout.active ? (
            <div
              aria-hidden
              data-wm-overlay
              data-testid="studio-stage-watermark"
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                overflow: "hidden",
                zIndex: 10,
              }}
            >
              {wmLayout.glyphs.map((g, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${g.xPct}%`,
                    top: `${g.yPct}%`,
                    transform:
                      `translate(${
                        wmLayout.anchor === "end"
                          ? "-100%"
                          : wmLayout.anchor === "middle"
                            ? "-50%"
                            : "0"
                      }, -50%) rotate(${g.rotateDeg}deg)`,
                    transformOrigin: "center",
                    whiteSpace: "nowrap",
                    fontFamily: "sans-serif",
                    fontWeight: 600,
                    fontSize: `${
                      Math.min(plateDims.w, plateDims.h) *
                      wmLayout.fontPctOfMin
                    }px`,
                    color: `rgba(255,255,255,${wmLayout.opacity})`,
                    userSelect: "none",
                  }}
                >
                  {g.text}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
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
  /** Phase 114 — Layout variant CANONICAL shared parameter.
   *  Rail "Layout Presets" (Cascade/Centered/Tilted/Stacked/Fan/
   *  Offset) artık no-op değil: Shell layoutVariant state → Stage
   *  cascade + rail thumb + Frame export HEPSİ bu tek değerden
   *  okur (Preview = Export Truth §11.0 — final visual parameter,
   *  UI helper değil). Default "cascade" (Phase 77-113 baseline,
   *  regression yok). */
  layoutVariant?: StudioLayoutVariant;
  /** Phase 110 — Viewport-aware aspect-locked plate scaling.
   *
   * Shell window.innerWidth/innerHeight'i izler ve Stage'e geçirir.
   * plateDimensionsFor available stage alanını bu boyutlardan
   * hesaplar (sidebar 214 + rail 0/202 + padding çıkarılır) ve
   * aspect-locked bbox-fit yapar — CSS bağımsız max-w/max-h %
   * clamp'ı KALDIRILDI (Phase 95-109'da iki ayrı % cap aspect'i
   * bozuyordu: 16:9 plate @1440 aspect 1.432, @1180 1.097).
   * cascadeScale otomatik düzelir (plateDims artık viewport-aware).
   * Shots.so canonical: aspect daima sabit, plate+cascade beraber
   * zoom-out. railCollapsed → stage rail alanını kazanır. */
  viewportW?: number;
  viewportH?: number;
  railCollapsed?: boolean;
  /** Phase 123 — Preview-only zoom (rail-head Zoom slider). Shell
   *  state; yalnız orta panel plate'ine uygulanır (StageScene
   *  previewZoom). Canonical visual param DEĞİL — export'a girmez
   *  (§11.0), rail candidate thumb'lara uygulanmaz. 1.0 = no-op. */
  previewZoom?: number;
  /** Phase 124 — Stage zoom-pill (−/%/+/Fit) için yüzde + setter.
   *  Pill rail slider (Phase 123) ile AYNI Shell state'i sürer
   *  (Shots.so canonical: tek zoom state, iki kontrol yüzeyi,
   *  % senkron). Yüzde (100 = no-op). Setter React functional
   *  updater'ı da kabul eder (pill ±10 step rapid-click
   *  accumulate: stale-closure batching fix). */
  previewZoomPct?: number;
  onChangePreviewZoom?: (next: number | ((prev: number) => number)) => void;
  /** Phase 126 — Global canonical media-position (Shell state).
   *  StageScene'e iletilir; rail thumb da yansıtır. {0,0} no-op. */
  mediaPosition?: MediaPosition;
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
  layoutVariant = "cascade",
  viewportW = 1440,
  viewportH = 900,
  railCollapsed = false,
  previewZoom = 1,
  previewZoomPct = 100,
  onChangePreviewZoom,
  mediaPosition = { x: 0, y: 0 },
}: MockupStudioStageProps) {
  const isPreview = appState === "preview" || appState === "renderDone";
  const isRender = appState === "render";
  const isEmpty = appState === "empty";

  /* Phase 117 — Single-renderer: Stage scene→plate→composition
   * artık paylaşılan `StageScene` component'inde. Stage main fn
   * yalnız viewport-aware `plateDims`'i hesaplar (Stage-shell
   * concern) ve `<StageScene>`'e geçirir; scene/plate resolution
   * (sceneTones/plateBgRaw/plateEffects/plateStyle/lensLayout)
   * StageScene İÇİNDE yapılır (lokal duplicate kaldırıldı, tek
   * tanım — sessiz drift §12 YASAK). Overlay'ler (empty-cap /
   * render-ov / render-banner / edit-pill / zoom-pill) StageScene
   * children olarak AYNI `k-studio__stage` div'inde sibling kalır
   * → Stage DOM byte-identical. Rail thumb AYNI StageScene'i
   * scaled render eder (StageScenePreview) — tek render path. */
  const plateDims = plateDimensionsFor(
    mode,
    frameAspect,
    viewportW,
    viewportH,
    railCollapsed,
  );

  return (
    <StageScene
      mode={mode}
      slots={slots}
      selectedSlot={selectedSlot}
      setSelectedSlot={setSelectedSlot}
      appState={appState}
      deviceKind={deviceKind}
      frameAspect={frameAspect}
      activePalette={activePalette}
      sceneOverride={sceneOverride}
      layoutCount={layoutCount ?? 3}
      layoutVariant={layoutVariant}
      plateDims={plateDims}
      isPreview={isPreview}
      isRender={isRender}
      isEmpty={isEmpty}
      previewZoom={previewZoom}
      mediaPosition={mediaPosition}
    >
      <StageSceneOverlays
        mode={mode}
        appState={appState}
        setAppState={setAppState}
        onCreateMockup={onCreateMockup}
        isPreview={isPreview}
        isRender={isRender}
        isEmpty={isEmpty}
        previewZoomPct={previewZoomPct}
        onChangePreviewZoom={onChangePreviewZoom ?? (() => {})}
      />
    </StageScene>
  );
}

/* Phase 117 — Stage-only overlays (empty-cap / render-ov /
 * render-banner / edit-pill / zoom-pill). Bunlar operatör
 * etkileşim/durum katmanları — rail thumb'da GÖRÜNMEZ (thumb
 * yalnız scene→plate→cascade). StageScene children olarak AYNI
 * `k-studio__stage` div'inde render edilir (Stage DOM byte-
 * identical; eski sibling sırası korunur). */
function StageSceneOverlays({
  mode,
  appState,
  setAppState,
  onCreateMockup,
  isPreview,
  isRender,
  isEmpty,
  previewZoomPct,
  onChangePreviewZoom,
}: {
  mode: StudioMode;
  appState: StudioAppState;
  setAppState: (next: StudioAppState) => void;
  onCreateMockup?: () => void;
  isPreview: boolean;
  isRender: boolean;
  isEmpty: boolean;
  /** Phase 124 — Stage zoom-pill ↔ rail slider TEK kaynak.
   *  previewZoom yüzde (100 = no-op); pill `−`/`%`/`+`/`Fit`
   *  Shell state'i Phase 123 rail slider ile AYNI günceller
   *  (Shots.so canonical: bir zoom state, iki kontrol yüzeyi,
   *  % senkron). Mode-AGNOSTIC. */
  previewZoomPct: number;
  onChangePreviewZoom: (next: number | ((prev: number) => number)) => void;
}) {
  /* Phase 124 — Zoom step/fit (Shots.so canonical): ±ZOOM_STEP
   * adım, ZOOM_MIN–ZOOM_MAX clamp, Fit = ZOOM_DEFAULT reset.
   * −/+ React functional updater kullanır → rapid-click
   * accumulate (stale-closure batching fix).
   *
   * Phase 134 — Lokal ZOOM_MIN=25/ZOOM_MAX=200/clampZoom KALDIRILDI;
   * shared zoom-bounds.ts (min 75 / max 400 / default 100) tek
   * kaynak. Rail slider, reset, viewfinder math AYNI modül →
   * pill ve slider aynı clamp ("hidden eski değer" YOK §12). */
  const stepZoom = (delta: number) =>
    onChangePreviewZoom((prev) => clampZoom(prev + delta));
  return (
    <>
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

      {/* Phase 124 — Zoom-pill çalışıyor; rail slider (Phase 123)
          ile AYNI Shell previewZoom state'i sürer → iki kontrol
          yüzeyi senkron, % her yerde aynı (Shots.so canonical).
          Phase 134 — −/+ ±ZOOM_STEP, Fit = ZOOM_DEFAULT, disabled
          eşikleri shared ZOOM_MIN/ZOOM_MAX (zoom-bounds.ts tek
          kaynak; min 75 / max 400). Preview-only helper: export'a
          girmez (§11.0), rail candidate thumb'lara uygulanmaz.
          Mode-AGNOSTIC (Mockup + Frame aynı davranış). */}
      {!isRender ? (
        <div
          className="k-studio__zoom-pill"
          data-testid="studio-stage-zoom-pill"
          data-zoom={previewZoomPct}
        >
          <button
            type="button"
            className="k-studio__zp-btn"
            aria-label="Zoom out"
            data-testid="studio-stage-zoom-out"
            disabled={previewZoomPct <= ZOOM_MIN}
            onClick={() => stepZoom(-ZOOM_STEP)}
          >
            −
          </button>
          <span
            className="k-studio__zp-val"
            data-testid="studio-stage-zoom-val"
          >
            {previewZoomPct}%
          </span>
          <button
            type="button"
            className="k-studio__zp-btn"
            aria-label="Zoom in"
            data-testid="studio-stage-zoom-in"
            disabled={previewZoomPct >= ZOOM_MAX}
            onClick={() => stepZoom(ZOOM_STEP)}
          >
            +
          </button>
          <button
            type="button"
            className="k-studio__zp-fit"
            data-testid="studio-stage-zoom-fit"
            aria-label="Fit (reset zoom to default)"
            disabled={previewZoomPct === ZOOM_DEFAULT}
            onClick={() => onChangePreviewZoom(ZOOM_DEFAULT)}
          >
            <StudioIcon name="mountain" size={10} />
            Fit
          </button>
        </div>
      ) : null}
    </>
  );
}
