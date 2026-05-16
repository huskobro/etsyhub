"use client";
/* eslint-disable no-restricted-syntax */

/* Phase 117 — Single-renderer rail thumb (StageScene scaled).
 *
 * File-level eslint-disable: thumb wrapper dinamik `transform:
 * scale(${scale})` + absolute positioning ile orta panelin AYNI
 * StageScene'ini küçültür. Bu Tailwind token sınıfıyla ifade
 * edilemez (runtime-hesaplı scale). MockupStudioStage.tsx /
 * svg-art.tsx ile aynı stage-namespace pattern (Studio
 * compositions yoğun absolute/transform; CSS recipe'ler
 * studio.css'de namespace-d).
 *
 * Yanlış model (Phase 116 fu2 dahil): rail thumb `PresetThumbMockup`
 * AYRI SVG renderer + `fitCascadeToThumb` AYRI fit math + SVG-rect
 * ile yeniden çizilmiş scene/plate. Middle panel `MockupComposition`
 * + CSS plate/scene divs. İki ayrı görsel sistem, elle senkronlanan
 * ("benzetmeye çalışan ikinci renderer").
 *
 * Doğru model (Phase 117): rail thumb = orta panelin AYNI
 * `StageScene` component'i, CSS `transform: scale()` ile küçültülmüş
 * + candidate `layoutVariant`. Ayrı SVG thumb renderer YOK — tek
 * render path, iki ölçek (Contract §6 "right rail = canlı mini
 * middle-panel previews"; §11.0 Preview = Export = Rail-thumb).
 *
 * Phase 118 — iki açık kapatıldı:
 *   1. ASPECT-AWARE plateDims (reactive): Phase 117 sabit 16:9-ish
 *      plateDims geçiyordu → aspect değişince rail thumb STALE.
 *      Phase 118 plateDims FRAME_ASPECT_CONFIG[frameAspect].ratio
 *      ile aspect-locked recompute (Stage plateDimensionsFor
 *      paritesi) → aspect/scene/asset/count/device HEPSİ canlı
 *      bağlı (current middle-panel state re-rendered per candidate).
 *   2. CHROMELESS: Phase 117 `StageScene` TAMAMINI render ediyordu
 *      (stage dark bg + dot-grid + scene tint + floor) → kullanıcı
 *      "siyah kutu / stage frame" görüyordu. Phase 118 chromeless
 *      prop → stage container chrome render edilmez; yalnız plate
 *      + composition (Shots.so rail davranışı). Tek render path
 *      korunur (sessiz drift §12 YASAK).
 *
 * StageScenePreview → MockupStudioStage (StageScene import).
 * PresetRail → StageScenePreview. Stage StageScenePreview'i import
 * ETMEZ → cycle yok (Stage→svg-art, StageScenePreview→Stage,
 * PresetRail→StageScenePreview tek yön).
 *
 * Preview-only: appState="preview" → MockupComposition slot-ring +
 * badge GİZLİ (Phase 77/94 baseline — kategori 4 helper thumb'a
 * GİRMEZ). selectedSlot=-1 + no-op onSelect (etkileşim yok). */

import { useLayoutEffect, useRef, useState } from "react";

import { StageScene } from "./MockupStudioStage";
import {
  cascadeLayoutFor,
  compositionGroup,
  resolvePlateBox,
} from "./cascade-layout";
import {
  MEDIA_POSITION_NEUTRAL,
  normalizePadPointToPosition,
  resolveMediaOffsetPx,
  type MediaPosition,
} from "./media-position";
import {
  FRAME_ASPECT_CONFIG,
  type FrameAspectKey,
} from "./frame-aspects";
import type { SceneOverride } from "./frame-scene";
import type { StudioStageDeviceKind } from "./svg-art";
import type {
  StudioLayoutVariant,
  StudioMode,
  StudioSlotMeta,
} from "./types";

/* Phase 132 — Tek shared framing model (KÖK NEDEN düzeltmesi).
 *
 * Phase 117-131 BUG: StageScenePreview StageScene'i SABİT
 * PREVIEW_BASE (900×506) boyutta render edip üstüne wrapper
 * `transform: scale(min(boxW/plateW, boxH/plateH))` uyguluyordu;
 * `plateDims` da PREVIEW_BASE-türevi (`{maxW:900*0.85,
 * maxH:506*0.85}`) idi. Middle panel ise `plateDimensionsFor`
 * (viewport-türevi) plateDims kullanıyordu. `compositionGroup`'a
 * giren `plateDims` MUTLAK boyutu iki yüzeyde farklı (+ Preview'da
 * ekstra wrapper scale) → `grp.scale = min(plateW×F/bboxW,
 * plateH×F/bboxH)` farklı → composition'ın plate-içi oranı
 * (compFracOfPlate) ayrışıyor (9:16'da %40, kullanıcı: "çok
 * bariz").
 *
 * Phase 132 fix: PREVIEW_BASE + wrapper-scale modeli KALDIRILDI.
 * StageScenePreview artık Middle ile AYNI `resolvePlateBox`
 * (cascade-layout.ts shared helper) çağrısını kullanır —
 * container = measured card/pad box. StageScene plate'i doğrudan
 * bu plateDims'e fit eder (Middle'da olduğu gibi); ayrı wrapper
 * scale YOK. 3 yüzey de:
 *   container → resolvePlateBox(aspect, cW, cH) → plateDims
 *   → compositionGroup → scale + bbox
 * AYNI zincir. frameAspect SHARED state olduğundan
 * compFracOfPlate plate MUTLAK boyutundan BAĞIMSIZ birebir
 * (aspect-locked). "Tek görsel mantık, çoklu görünüm."
 * future-proof: aspectRatio + container parametre — custom
 * resolution geldiğinde sistem yeniden ayrışmaz. */

export interface StageScenePreviewProps {
  /** Candidate layout variant (rail preset). Stage selected
   *  variant'ı gösterir; thumb "bu layout seçilseydi" halini. */
  layoutVariant: StudioLayoutVariant;
  mode: StudioMode;
  slots: ReadonlyArray<StudioSlotMeta>;
  deviceKind: StudioStageDeviceKind;
  frameAspect: FrameAspectKey;
  activePalette?: readonly [string, string];
  sceneOverride?: SceneOverride;
  layoutCount: 1 | 2 | 3;
  /** Phase 126 — Global canonical media-position. StageScene'e
   *  iletilir (rail thumb yansıtır — canonical). Pad overlay
   *  handle bunu sürer. Undefined → {0,0} no-op. */
  mediaPosition?: MediaPosition;
  /** Pad handle drag setter (Shell setMediaPosition). Verilmezse
   *  pad overlay görünmez (rail candidate thumb'lar yalnız
   *  yansıtır, sürmez — yalnız rail-head pad sürer). */
  onChangeMediaPosition?: (next: MediaPosition) => void;
  /** Phase 127 — Preview zoom yüzdesi (Shell previewZoom, 100 =
   *  no-op). Pad overlay viewfinder rectangle'ının BOYUTU bununla
   *  ters orantılı (Shots.so canonical: zoom artınca görünür
   *  pencere daralır, `1/zoom` — 146% → pad×0.685). Yalnız pad
   *  overlay GÖSTERİMİ; canonical mediaPosition/export/composition
   *  DEĞİŞMEZ (kategori 2 preview-only helper). */
  previewZoomPct?: number;
}

export function StageScenePreview({
  layoutVariant,
  mode,
  slots,
  deviceKind,
  frameAspect,
  activePalette,
  sceneOverride,
  layoutCount,
  mediaPosition = { x: 0, y: 0 },
  onChangeMediaPosition,
  previewZoomPct = 100,
}: StageScenePreviewProps) {
  /* Phase 119 — Self-measuring box (gerçek render boyutu).
   *
   * Phase 117/118'de boxW/boxH PresetRail'den HARDCODED (172×88
   * live / 172×72 preset) geliyordu — ama kart CSS `width:100%`
   * (≈167px ölçülen) × CSS height (102/92px) idi. Hardcoded box ≠
   * gerçek kart → plate-fit scale hatalı + responsive resize'da
   * stale. Phase 119: wrapper parent'ı %100 doldurur, gerçek px'i
   * ResizeObserver ile ölçer → scale gerçek karta göre exact,
   * responsive-safe. Tek render path KORUNUR (yalnız ölçüm
   * kaynağı prop → self-measure; framing doğruluğu). */
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({
    w: 167,
    h: 90,
  });
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setBox({ w: r.width, h: r.height });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const boxW = box.w;
  const boxH = box.h;
  /* Phase 132 — plateDims = Middle ile AYNI `resolvePlateBox`
   * (cascade-layout.ts shared helper). Container = measured
   * card/pad box (boxW × boxH); Stage'de container = viewport-
   * türevi stageW/stageH. AYNI aspect-locked bbox-fit algoritması,
   * AYNI fillW/fillH (rail thumb için cap YOK — küçük container'da
   * dev plate riski yok). frameAspect SHARED state (Stage ile aynı
   * kaynak — Shell). Sonuç: 3 yüzey de
   *   container → resolvePlateBox(aspect, cW, cH) → plateDims
   *   → compositionGroup → scale + bbox
   * AYNI zincir; compFracOfPlate plate MUTLAK boyutundan BAĞIMSIZ
   * birebir (aspect-locked). Eski PREVIEW_BASE-türevi plate +
   * wrapper-scale modeli KALDIRILDI (ayrışma kök nedeni).
   *
   * fillW/fillH 1.0: rail kartı Phase 120'den beri plate ile
   * aspect-match (MockupStudioPresetRail card aspect = plate
   * aspect); container'ı edge-to-edge doldur (Middle stage padding
   * için 0.9/0.86 kullanır — kart zaten plate-aspect, ek padding
   * gereksiz). overflow:hidden sub-pixel taşmayı kırpar. */
  const ratio = FRAME_ASPECT_CONFIG[frameAspect].ratio; // w/h
  const plateDims = resolvePlateBox(ratio, boxW, boxH, {
    fillW: 1.0,
    fillH: 1.0,
  });
  /* Phase 129 — Rail-head live pad = navigator/control surface.
   *
   * Phase 128'de viewfinder GROUP doğru hareket etse de arka
   * plandaki StageScene hâlâ canonical mediaPosition ile render
   * oluyordu. Sonuç: kullanıcı pad içinde "görünür pencereyi
   * navigator üzerinde taşıyorum" yerine "mini preview de onunla
   * birlikte oynuyor" hissi alıyordu. Doğru model:
   *   - rail-head live pad (onChangeMediaPosition VAR) = SABİT
   *     full-extent navigator background
   *   - onun üstünde hareket eden = viewfinder group
   *   - candidate preset thumb'lar = canonical preview mantığına
   *     devam eder, mediaPosition'ı yansıtır
   *
   * Bu yüzden yalnız interaktif rail-head pad'de StageScene arka
   * planı neutral mediaPosition ile render edilir. Canonical state,
   * export, resolver ve preset thumb mantığı DOKUNULMAZ. */
  const stageMediaPosition = onChangeMediaPosition
    ? MEDIA_POSITION_NEUTRAL
    : mediaPosition;

  /* Phase 126 — Pad overlay pointer drag. Pure-math mapping
   * normalizePadPointToPosition'a delege (DOM-free; spec §5).
   * prevPosRef: Shift precision delta'sının kaynağı (her drag
   * başında mediaPosition'a senkronlanır). Pointer capture +
   * up + cancel temiz (spec §4 — drag pad dışına taşsa da takip,
   * release güvenli). */
  const padRef = useRef<HTMLDivElement | null>(null);
  const prevPosRef = useRef<MediaPosition>(mediaPosition);

  const applyFromEvent = (
    clientX: number,
    clientY: number,
    shift: boolean,
  ) => {
    const el = padRef.current;
    if (!el || !onChangeMediaPosition) return;
    const r = el.getBoundingClientRect();
    const next = normalizePadPointToPosition(
      clientX,
      clientY,
      { left: r.left, top: r.top, width: r.width, height: r.height },
      shift,
      { x: -prevPosRef.current.x, y: -prevPosRef.current.y },
    );
    const canonicalNext = { x: -next.x, y: -next.y };
    prevPosRef.current = canonicalNext;
    onChangeMediaPosition(canonicalNext);
  };

  const onPadPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!onChangeMediaPosition) return;
    e.preventDefault();
    prevPosRef.current = mediaPosition;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    applyFromEvent(e.clientX, e.clientY, e.shiftKey);
  };
  const onPadPointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (e.buttons === 0) return;
    applyFromEvent(e.clientX, e.clientY, e.shiftKey);
  };
  const onPadPointerUpCancel = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    const el = e.currentTarget as HTMLDivElement;
    if (el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      ref={hostRef}
      data-testid="studio-rail-stagescene-preview"
      data-layout-variant={layoutVariant}
      data-frame-aspect={frameAspect}
      style={{
        /* Phase 132 — Dış div = measured card/pad CONTAINER kutusu
         * (ResizeObserver: boxW × boxH). resolvePlateBox bu
         * container'a aspect-fit edilmiş plateDims döndürür (Middle
         * ile AYNI helper). overflow:hidden sub-pixel taşmayı
         * kırpar. */
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          /* Phase 132 — StageScene host'u measured box'ı doldurur
           * (PREVIEW_BASE + wrapper-scale modeli KALDIRILDI). Middle
           * panel `.k-studio__stage` `flex:1` ile stage alanını
           * doldurup plate'i merkeze koyar; burada da AYNI: wrapper
           * box'ı doldurur, StageScene plate'i `plateDims`
           * (resolvePlateBox ile box'a aspect-fit edilmiş, Middle
           * ile AYNI semantik) boyutunda merkezde render eder.
           * Ayrı wrapper scale YOK → compositionGroup'a giren
           * plateDims = gerçek render plate (Middle ile aynı zincir
           * → compFracOfPlate birebir). StageScene root flex:1 için
           * bu wrapper flex container. chromeless: stage bg/
           * dot-grid/scene/floor render edilmez. */
          position: "absolute",
          inset: 0,
          display: "flex",
        }}
      >
        <StageScene
          mode={mode}
          slots={slots}
          selectedSlot={-1}
          setSelectedSlot={() => {}}
          appState="preview"
          deviceKind={deviceKind}
          frameAspect={frameAspect}
          activePalette={activePalette}
          sceneOverride={sceneOverride}
          layoutCount={layoutCount}
          layoutVariant={layoutVariant}
          plateDims={plateDims}
          /* Phase 129 — candidate preset thumb'lar canonical
             mediaPosition'ı yansıtır; interaktif rail-head pad ise
             stable navigator background için neutral render edilir. */
          mediaPosition={stageMediaPosition}
          isPreview
          isRender={false}
          isEmpty={false}
          chromeless
        />
      </div>
      {/* Phase 126 — Pad overlay yalnız onChangeMediaPosition
          verildiğinde (rail-head pad). Preset thumb'lar overlay
          GÖSTERMEZ — yalnız mediaPosition'ı yansıtır (sürmez).
          Overlay subtle: safe-area çerçevesi + framing dim +
          küçük handle (canlı preview'ı boğmaz; spec §2). Root
          wrapper pointerEvents:none ama .k-studio__pad-overlay
          CSS pointer-events:auto → handle/pad etkileşimli. */}
      {onChangeMediaPosition ? (
        <div
          ref={padRef}
          className="k-studio__pad-overlay"
          data-testid="studio-rail-media-pad"
          data-media-x={mediaPosition.x}
          data-media-y={mediaPosition.y}
          onPointerDown={onPadPointerDown}
          onPointerMove={onPadPointerMove}
          onPointerUp={onPadPointerUpCancel}
          onPointerCancel={onPadPointerUpCancel}
        >
          {(() => {
            /* Phase 129 — Viewfinder = middle panel görünür
             *  penceresinin navigator-uzayındaki GERÇEK izdüşümü.
             *
             *  Phase 126-128 BUG (kök neden): viewfinder boyutu
             *  keyfi `BASE_FRAC(0.78) × 100/zoom`, konumu keyfi
             *  `50 - media×50` idi — navigator background'daki full
             *  composition ile HİÇBİR matematiksel bağ yoktu.
             *  Sonuç: zoom %100'de middle panel'de TÜM composition
             *  görünürken (plate full-comp'tan büyük, crop yok)
             *  viewfinder pad'in yalnız %78'ini kaplıyordu →
             *  viewfinder middle görünür alandan KÜÇÜK → kenar
             *  içerik (PAS5) viewfinder dışında. "Viewfinder içinde
             *  ne görüyorsam middle panel'de onu görmeliyim"
             *  garantisi YOKtu.
             *
             *  Doğru model (Shots.so canlı DOM ölçümüyle kanıtlandı:
             *  viewfinderFracOfPad === visibleWindow/fullComp her
             *  zoom'da): navigator background = full composition
             *  (zoom/pan UYGULANMAMIŞ; StageScene chromeless +
             *  stageMediaPosition NEUTRAL + effectiveZoom 1 zaten
             *  bunu render eder). Viewfinder, o full-comp'un içinde
             *  middle panel'in görünür crop'unu çerçeveler.
             *
             *  Middle panel render uzayı (StageScene chromeless=false):
             *    grp = compositionGroup(cascadeLayoutFor(...),
             *      plateDims) → fullCompVisual = grp.bbox × grp.scale
             *      × previewZoom; görünür pencere = plateDims
             *      (overflow:hidden); media pan = mediaPosition ×
             *      plateDims × MEDIA_K (resolveMediaOffsetPx).
             *  Navigator uzayı: full-comp = grp.bbox × grp.scale
             *      (zoom-suz); navigator-plate ≈ pad (StageScene
             *      plate FILL=1.0 + aspect-match → pad-frac =
             *      plate-frac). compFracOfPad = grp.bbox×grp.scale /
             *      plateDims.
             *
             *  → viewfinder boyutu (pad-frac) = compFracOfPad ×
             *    visibleFrac, visibleFrac = min(1, plateDims /
             *    fullCompVisual) per eksen.
             *  → viewfinder konumu = full-comp merkezinden media
             *    pan'in full-comp uzayındaki normalize izdüşümü
             *    (composition +x pan → middle içerik sağa → görünür
             *    pencere full-comp'un SOL kısmını gösterir →
             *    navigator viewfinder SOLA).
             *
             *  Aynı `compositionGroup` + `cascadeLayoutFor`
             *  (cascade-layout.ts tek kaynak) Stage/export/rail-thumb
             *  ile birebir → §11.0 Preview = Export = Rail-thumb =
             *  Navigator-viewfinder yapısal garanti. Canonical
             *  mediaPosition state, shared resolver, export
             *  matematiği, composition translate, candidate thumb
             *  mantığı DEĞİŞMEZ (yalnız pad overlay GÖSTERİMİ;
             *  pad interaction hâlâ aynı mediaPosition'ı yazar). */
            const zPct = Number.isFinite(previewZoomPct)
              ? previewZoomPct
              : 100;
            const previewZoom = zPct / 100;
            const grp = compositionGroup(
              cascadeLayoutFor(deviceKind, layoutCount, layoutVariant),
              plateDims.w,
              plateDims.h,
            );
            /* Phase 130 — Viewfinder = middle panel GÖRÜNÜR
             * PENCERESİ'nin (plate) navigator full-comp uzayındaki
             * izdüşümü. Composition DEĞİL — görünür pencere.
             *
             * Phase 129 BUG: viewfinder boyutu `compFracOfPlate ×
             * visibleFrac`, visibleFrac = `min(1, plateDims/
             * fullCompVisual)`. `min(1,...)` clamp viewfinder'ı
             * composition-size'a SABİTLİYORDU: zoom<100'de comp
             * küçülür, görünür pencere comp'tan ÇOK büyük (zoom
             * %25 → MID_plateOverComp w:4.76 — middle'da comp + 4.76×
             * padding görünür), ama visibleFrac=min(1,4.76)=1 →
             * viewfinder navInner'ı aşmıyor, %84'te DONUYOR
             * (kullanıcı: "zoom out'ta viewport büyümüyor").
             * Ayrıca zoom %100'de bile comp etrafındaki plate-
             * padding'i (MID_plateOverComp w:1.19) çerçevelemiyor
             * (kullanıcı: "tam görünür alan değil").
             *
             * Phase 130 fix: viewfinder = middle görünür pencere /
             * composition oranı, CLAMP YOK. Middle composition
             * görsel boyutu = bbox × grp.scale × previewZoom
             * (cascadeScale). Görünür pencere = plateDims.
             * winOverCompW = plateDims.w / (bbox × grp.scale ×
             * previewZoom) = middle'da görünür-alan/comp oranı
             * (MID_plateOverComp ile BİREBİR — DOM kanıt: zoom100
             * 1.19, zoom25 4.76, zoom160 0.744). Bu navInner'a
             * (full-comp, navigator) göre viewfinder size:
             * zoom<100 >1 (navInner'ı taşar — comp etrafındaki
             * boşluk da görünür), zoom>100 <1 (crop). Center-
             * preserving: no-pan'da winOverComp eksen-bağımsız,
             * vfCx=50 sabit (drift yok). */
            const cascadeScaleW = grp.scale * previewZoom;
            const cascadeScaleH = grp.scale * previewZoom;
            const fullCompW = grp.bboxW * cascadeScaleW;
            const fullCompH = grp.bboxH * cascadeScaleH;
            // Görünür pencere (plate) / composition görsel boyutu.
            // CLAMP YOK — zoom<100'de >1 (pencere comp'tan büyük,
            // viewfinder navInner'ı taşar; comp etrafı da görünür).
            const winOverCompW = plateDims.w / fullCompW;
            const winOverCompH = plateDims.h / fullCompH;
            // Navigator background = StageScene chromeless plate
            // (zoom-suz, pan-suz full-comp = navInner). grp.scale
            // plate'in PLATE_FILL_FRAC'ini kaplar → navInner plate-
            // relative oranı (compFracOfPlate).
            const compFracOfPlateW =
              (grp.bboxW * grp.scale) / plateDims.w;
            const compFracOfPlateH =
              (grp.bboxH * grp.scale) / plateDims.h;
            // Viewfinder PLATE-rect-relative %: navInner'a göre
            // winOverComp, sonra navInner'ın plate-rect'teki yeri
            // (compFracOfPlate) ile çarp. = winOverComp ×
            // compFracOfPlate. Aspect-locked grp.scale'de bu ≈
            // 1/previewZoom (zoom100→%84·1.19=100%? hayır: 1.19×
            // 0.84=1.0 → viewfinder plate-rect'in TAMAMI = tüm
            // görünür alan ✓; zoom25→4.76×0.84=4.0 → %400 plate-
            // rect taşar ✓; zoom160→0.744×0.84=0.625 → %62.5 crop
            // ✓). Math.max(3,...) yalnız dejenerasyon guard'ı;
            // clamp YOK (>100 izinli — viewfinder plate-rect'i
            // taşabilir, overflow görsel kırpılır, crop anlamı
            // korunur).
            const vfPctW = Math.max(
              3,
              winOverCompW * compFracOfPlateW * 100,
            );
            const vfPctH = Math.max(
              3,
              winOverCompH * compFracOfPlateH * 100,
            );
            // Media pan'in full-comp uzayındaki normalize izdüşümü
            // (PLATE-relative). resolveMediaOffsetPx (shared) ile
            // middle panel AYNI formül: ofset = mediaPosition ×
            // plateDims × MEDIA_K. Görünür pencere full-comp'a göre
            // -ofset yönünde kayar → navigator viewfinder o yönde.
            // no-pan (ox=oy=0) → vfCx=vfCy=50 (CENTER-PRESERVING:
            // zoom değişse de merkez sabit, drift YOK).
            const { ox, oy } = resolveMediaOffsetPx(
              mediaPosition,
              plateDims.w,
              plateDims.h,
            );
            const vfCx =
              50 - (ox / fullCompW) * compFracOfPlateW * 100;
            const vfCy =
              50 - (oy / fullCompH) * compFracOfPlateH * 100;
            const vfPct = vfPctW; // legacy data attr (≈ width frac)
            const vfFrac = vfPctW / 100;
            // PLATE-rect: StageScene-plate'in kart içindeki gerçek
            // px dikdörtgeni. Phase 132: wrapper-scale KALDIRILDI;
            // StageScene plate'i doğrudan `plateDims` (resolvePlateBox
            // ile measured box'a aspect-fit edilmiş, Middle ile AYNI
            // semantik) boyutunda render edilir → plate-rect =
            // plateDims (ek scale çarpanı YOK). Viewfinder/dim bu
            // px-sabit wrapper içinde plate-rel % → navigator
            // background (StageScene-plate) ile BİREBİR overlap
            // (§11.0 Preview = Export = Navigator-viewfinder). */
            const plateRectW = plateDims.w;
            const plateRectH = plateDims.h;
            return (
              <>
                {/* Dim: viewfinder GROUP DIŞINI karart (group ile
                    hareket eder — Shots.so viewfinder dim paritesi).
                    Navigator'ın "kapsam dışı" alanını gösterir. */}
                {/* PLATE-rect wrapper: pad-overlay (host=card) içinde
                    kart-merkezli, px-sabit (scale×plateDims) — Stage-
                    Scene-plate ile BİREBİR overlap. Viewfinder + dim
                    bu wrapper içinde PLATE-relative % → navigator
                    background full-comp ile aynı uzay (cardW=box
                    belirsizliği YOK; §11.0 Preview = Navigator-
                    viewfinder). */}
                <div
                  data-testid="studio-rail-pad-platerect"
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: `${plateRectW}px`,
                    height: `${plateRectH}px`,
                    transform: "translate(-50%, -50%)",
                    pointerEvents: "none",
                  }}
                >
                  <div
                    className="k-studio__pad-dim"
                    data-testid="studio-rail-pad-dim"
                    aria-hidden
                    style={{
                      clipPath: `polygon(
                        0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                        ${vfCx - vfPctW / 2}% ${vfCy - vfPctH / 2}%,
                        ${vfCx - vfPctW / 2}% ${vfCy + vfPctH / 2}%,
                        ${vfCx + vfPctW / 2}% ${vfCy + vfPctH / 2}%,
                        ${vfCx + vfPctW / 2}% ${vfCy - vfPctH / 2}%,
                        ${vfCx - vfPctW / 2}% ${vfCy - vfPctH / 2}%
                      )`,
                    }}
                  />
                  {/* Viewfinder GROUP: rectangle + center dot TEK
                      eleman, AYNI center'da (Shots.so `.drag-handle`
                      > `.viewfinder-div` çocuk ilişkisi, dx:0 dy:0).
                      Boyut = compFracOfPlate × visibleFrac (middle
                      görünür crop'un navigator full-comp izdüşümü;
                      zoom artınca daralır — gerçek crop oranı), konum
                      = media pan full-comp izdüşümü. Dot, rectangle'ın
                      geometrik merkez marker'ı (::after pseudo,
                      studio.css) — bağımsız anchor DEĞİL. */}
                  <div
                    className="k-studio__pad-viewfinder"
                    data-testid="studio-rail-pad-viewfinder"
                    data-vf-frac={vfFrac.toFixed(4)}
                    data-vf-frac-h={(vfPctH / 100).toFixed(4)}
                    aria-label="Media viewfinder"
                    style={{
                      left: `${vfCx}%`,
                      top: `${vfCy}%`,
                      width: `${vfPctW}%`,
                      height: `${vfPctH}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                </div>
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
