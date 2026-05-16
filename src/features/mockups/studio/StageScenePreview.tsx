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

/* Phase 133 — `PREVIEW_BASE 900×506 + transform:scale` modeli
 * TAMAMEN KALDIRILDI (kök neden, canlı browser + pixel ölçümüyle
 * KANITLANDI).
 *
 * Phase 117-132 boyunca thumb iki katmanlı SAHTE boyutlandırma
 * yapıyordu: (1) dış scaleWrap `width:PREVIEW_BASE_W(900) height:
 * PREVIEW_BASE_H(506)` SABİT 16:9-ish + `transform:scale(s)`,
 * (2) içindeki StageScene plate'i aspect-aware plateDims ile
 * render. İki katman uyumsuz: scaleWrap sabit 900×506 oranlı,
 * plate aspect değişiyor → 9:16 portrait'te plate scaleWrap'in
 * yalnız %39'unu kaplıyor (DOM kanıt: cardW 146, plateW 57),
 * kalan boş + previewWrap/stageRoot/plate 3 `overflow:hidden`
 * clip ediyor (kullanıcı "thumb'da küçük görüntü + boş alan +
 * sağdan kesik" hipotezi DOĞRULANDI: math + visibility birlikte).
 *
 * Phase 133 doğru model: StageScene DOĞRUDAN ölçülen kart box'ını
 * doldurur (scaleWrap YOK, transform:scale YOK). plateDims =
 * resolvePlateBox(ratio, boxW, boxH) — AYNI fonksiyon middle
 * panelin de kullandığı (Stage plateDimensionsFor). frameAspect
 * SHARED state → 3 yüzeyde plate aspect aynı; composition
 * compositionGroup PLATE_FILL_FRAC ile dengeli (middle ile BİREBİR
 * içerik uzayı/crop/fit/visibility — tek render path GERÇEKTEN
 * tek; §11.0). */

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
  /** Phase 133 — Container'ın BİLİNEN px boyutu (PresetRail
   *  `cardW`/`cardHr`'den). Verilince ResizeObserver `box` state'i
   *  TAMAMEN bypass edilir → stale-init bug'ı (Phase 119 `box`
   *  initial `{167,90}` 16:9-ish, 9:16 kartta ResizeObserver
   *  güncellemeyince plate kartın %39'u kalıyordu) kökten çözülür.
   *  Deterministik: PresetRail `idealW/plateAspect` ile cardW/cardHr
   *  zaten hesaplı; ölçüm tekrarı + getBoundingClientRect stale
   *  riski YOK. Verilmezse (legacy/diğer consumer) eski self-measure
   *  fallback. */
  boxW?: number;
  boxH?: number;
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
  boxW: boxWProp,
  boxH: boxHProp,
}: StageScenePreviewProps) {
  /* Phase 133 — Container box: BİLİNEN prop (deterministik) ya da
   * self-measure fallback.
   *
   * Phase 119'da boxW/boxH yalnız ResizeObserver `box` state'inden
   * geliyordu; init `{167,90}` (16:9-ish). Mount'ta host henüz
   * layout almadan ölçülürse veya getBoundingClientRect stale
   * dönerse (extension-context kanıtlandı) `box` init'te takılıyor
   * → 9:16 kartta resolvePlateBox(0.5625, 167, 90) = {51,90} →
   * plate kartın %39'u (kullanıcı "thumb'da küçük + boş alan").
   *
   * Phase 133 fix: PresetRail zaten kartın px boyutunu hesaplıyor
   * (railInnerW → cardW/cardHr, idealW/plateAspect). Bunu prop
   * geçir → `box` state + ResizeObserver TAMAMEN bypass (stale
   * imkânsız, render-time deterministik). Prop yoksa eski
   * self-measure korunur (geriye uyum). */
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [measuredBox, setMeasuredBox] = useState<{
    w: number;
    h: number;
  }>({
    w: 167,
    h: 90,
  });
  const propBoxGiven =
    typeof boxWProp === "number" &&
    typeof boxHProp === "number" &&
    boxWProp > 0 &&
    boxHProp > 0;
  useLayoutEffect(() => {
    if (propBoxGiven) return; // prop authoritative — ölçüm gereksiz
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setMeasuredBox({ w: r.width, h: r.height });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [propBoxGiven]);
  const box = propBoxGiven
    ? { w: boxWProp as number, h: boxHProp as number }
    : measuredBox;
  const boxW = box.w;
  const boxH = box.h;
  /* Phase 133 — Plate DOĞRUDAN ölçülen kart box'a aspect-locked
   * fit (AYNI resolvePlateBox middle panelin kullandığı). scaleWrap
   * + transform:scale YOK; StageScene host kart box'ını doldurur,
   * plate o box içinde plateDims boyutunda render edilir. fillW/
   * fillH=1 (kart kutusu zaten plate-tight — MockupStudioPresetRail
   * previewCardH = railContentW / plateAspect; aspect-match). Tek
   * render path: middle viewport-box, rail/zoom kart-box, ikisi de
   * AYNI fonksiyon → birebir içerik uzayı/crop/fit (§11.0). */
  const ratio = FRAME_ASPECT_CONFIG[frameAspect].ratio; // w/h
  const plateDims = resolvePlateBox(ratio, boxW, boxH);
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
        /* Phase 133 — Kart box'ını DOĞRUDAN doldur; StageScene host
         * (`.k-studio__stage` flex:1) bu flex container'a yerleşir,
         * plate o box içinde plateDims boyutunda render edilir
         * (scaleWrap + transform:scale YOK — sahte sarmalama
         * KALDIRILDI). overflow:hidden sub-pixel taşmayı güvenle
         * kırpar (plate aspect kart aspect ile match — taşma yok).
         * Box gerçek px ResizeObserver ile → plate kart'a exact
         * fit, responsive-safe. */
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        pointerEvents: "none",
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
            // px dikdörtgeni. Phase 133 — plate DOĞRUDAN plateDims
            // boyutunda render edilir (scaleWrap + transform:scale
            // YOK); host kart box'ını doldurur, plate host-merkezli
            // plateDims boyutunda. Viewfinder/dim bu px-sabit
            // wrapper içinde plate-rel % → navigator background
            // (StageScene-plate) ile BİREBİR overlap (§11.0 Preview
            // = Export = Navigator-viewfinder; ek scale çarpanı YOK).
            const plateRectW = plateDims.w;
            const plateRectH = plateDims.h;
            /* Phase 134 — Center marker CLAMP (kullanıcı: "white
             * center dot zoom panelin DIŞINA çıkamasın; viewfinder
             * büyüyüp taşabilir ama marker panel içinde kalmalı —
             * Shots.so davranışı"). Rectangle vs marker semantiği
             * AYRILDI:
             *   - viewfinder rectangle (vfCx/vfCy) SERBEST: media
             *     pan büyükse plate-rect dışına taşabilir (görünür
             *     pencere overflow — Shots.so canonical, navigator
             *     "kapsam dışı" sinyali; DEĞİŞMEZ).
             *   - center dot AYRI element, konumu plate-rect içine
             *     CLAMP. Dot ~14px (radius 7px) → merkezi ∈ [7px,
             *     plateRectW-7px] → % cinsinden marginX/Y. Dot
             *     rectangle'ın ÇOCUĞU DEĞİL (Phase 128 `::after`
             *     pseudo KALDIRILDI) → plate-rect'in doğrudan
             *     çocuğu, rectangle taşsa bile bağımsız clamp'lı.
             *     Marker daima panel içinde = control affordance
             *     kaybolmaz. Canonical mediaPosition/export DEĞİŞMEZ
             *     (yalnız dot GÖSTERİM konumu clamp'lı). */
            const DOT_PX = 14;
            const dotMarginXPct =
              plateRectW > 0
                ? ((DOT_PX / 2) / plateRectW) * 100
                : 0;
            const dotMarginYPct =
              plateRectH > 0
                ? ((DOT_PX / 2) / plateRectH) * 100
                : 0;
            const dotCx = Math.max(
              dotMarginXPct,
              Math.min(100 - dotMarginXPct, vfCx),
            );
            const dotCy = Math.max(
              dotMarginYPct,
              Math.min(100 - dotMarginYPct, vfCy),
            );
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
                  {/* Phase 134 — Viewfinder rectangle: konum/boyut
                      SERBEST (vfCx/vfCy plate-rect dışına taşabilir
                      = görünür pencere overflow, Shots.so canonical;
                      navigator "kapsam dışı" sinyali). Center dot
                      ARTIK ayrı element (aşağıda, clamp'lı) — Phase
                      128 `::after` pseudo KALDIRILDI. Boyut =
                      compFracOfPlate × visibleFrac (middle görünür
                      crop'un navigator full-comp izdüşümü; zoom
                      artınca daralır — gerçek crop oranı), konum =
                      media pan full-comp izdüşümü. */}
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
                  {/* Phase 134 — Center marker AYRI element, plate-
                      rect'in DOĞRUDAN çocuğu (viewfinder'ın değil).
                      Konum dotCx/dotCy = vfCx/vfCy'nin plate-rect
                      içine CLAMP'lı hali → marker viewfinder taşsa
                      bile DAİMA panel içinde (kullanıcı: control
                      affordance kaybolmasın). Rectangle overflow ≠
                      marker visibility (ayrım net). */}
                  <div
                    className="k-studio__pad-marker"
                    data-testid="studio-rail-pad-marker"
                    data-clamped={
                      dotCx !== vfCx || dotCy !== vfCy
                        ? "true"
                        : "false"
                    }
                    aria-hidden
                    style={{
                      left: `${dotCx}%`,
                      top: `${dotCy}%`,
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
