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
  MEDIA_POSITION_NEUTRAL,
  normalizePadPointToPosition,
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

/* Thumb iç sahne "büyük ekran" koordinat uzayında (StageScene'in
 * gerçek plate/cascade boyutları), sonra CSS transform: scale ile
 * thumb kutusuna küçültülür → orta panelin BİREBİR minyatürü
 * (aynı plate/scene/cascade chrome, ölçek farkı). Sabit referans
 * boyut: Stage'in tipik 16:9-ish plate alanına yakın bir base;
 * gerçek plate aspect StageScene plateDims'ten gelir, scale onu
 * thumb kutusuna oturtur. */
const PREVIEW_BASE_W = 900;
const PREVIEW_BASE_H = 506;

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
  /* Phase 118 — Plate dims ASPECT-AWARE (reactive to frameAspect).
   *
   * Phase 117 BUG: plateDims `{ w: PREVIEW_BASE_W*0.85, h:
   * PREVIEW_BASE_H*0.85 }` SABİT 16:9-ish oran idi → operatör
   * Frame mode'da aspect (9:16 / 1:1 / 4:5 / 3:4) değiştirdiğinde
   * `frameAspect` prop reaktif akıyordu (data-frame-aspect doğru
   * güncelleniyordu) AMA plate boyutu hiç recompute edilmiyordu
   * → rail thumb aspect STALE (orta panel 9:16 portrait, rail
   * thumb hâlâ 16:9 landscape). Kullanıcı bug "right rail aspect
   * ratio değişince güncellenmiyor" tam bu.
   *
   * Phase 118 fix: Stage `plateDimensionsFor`'un aspect-locked
   * bbox-fit mantığını PREVIEW_BASE ölçeğinde uygula. ratio =
   * FRAME_ASPECT_CONFIG[frameAspect].ratio (w/h, Shell SHARED
   * state — Stage ile AYNI kaynak). Plate PREVIEW_BASE'in ~%85'i
   * (Stage avail %86-90 paritesi); aspect-locked: hem maxW hem
   * maxH'a sığ, oran SABİT. Sonuç: aspect değişince rail thumb
   * plate de orta panelle AYNI oranda recompute (Preview = Export
   * = Rail-thumb §11.0; canlı bağlı çok-ekran). */
  const ratio = FRAME_ASPECT_CONFIG[frameAspect].ratio; // w/h
  const maxW = PREVIEW_BASE_W * 0.85;
  const maxH = PREVIEW_BASE_H * 0.85;
  const fitByWidth = { w: maxW, h: maxW / ratio };
  const plateDims =
    fitByWidth.h <= maxH
      ? { w: maxW, h: maxW / ratio }
      : { w: maxH * ratio, h: maxH };

  /* Phase 119 — Preview-first framing (Shots.so parity).
   *
   * Phase 117/118 BUG: `scale = Math.min(boxW/PREVIEW_BASE_W,
   * boxH/PREVIEW_BASE_H)` TÜM 900×506 PREVIEW_BASE canvas'ını
   * box'a sığdırıyordu. Ama plate canvas'ın yalnız ~%85'i +
   * portrait aspect'lerde çok daha dar (`maxH*ratio`) → box'ta
   * plate %80 width / %85 height kaplıyor, çevresinde transparent
   * stage-padding kalıyor. Kullanıcı "thumb içinde küçük görüntü,
   * etrafında fazla siyah/boş alan, preview küçük görünüyor"
   * şikayeti tam bu (chromeless ile stage bg kalktı ama scale
   * hâlâ tüm canvas'a göre → plate küçük + boş çevre).
   *
   * Phase 119 fix: scale'i **plate**'in box'a sığması için hesapla
   * (full canvas değil). Plate PREVIEW_BASE merkezinde; plateDims
   * biliniyor. Box'a plate-fit: `min(boxW/plateW, boxH/plateH) ×
   * FILL`. overflow:hidden çevredeki transparent stage-padding'i
   * KIRPAR (crop) → preview box'ı doldurur. Tek render path
   * KORUNUR (aynı StageScene, candidate layout mantığı bozulmaz
   * — yalnız framing/crop/scale değişir).
   *
   * Phase 120 — FILL 0.96 → 1.0. Phase 119'da 0.96 küçük
   * breathing-room inset bırakıyordu (kart aspect ≠ plate aspect
   * iken void zaten vardı, inset onu artırıyordu). Phase 120 rail
   * kartı artık plate ile TRUE aspect-match (MockupStudioPresetRail
   * previewCardH = railContentW / plateAspect) → kart aspect ≈
   * plate aspect. FILL=1.0 + aspect-match → plate kartı EDGE-TO-EDGE
   * doldurur (her iki eksende ~%100): "layout container ile AYNI
   * boyut, küçük kalmaz" (kullanıcı talebi). overflow:hidden
   * sub-pixel taşmayı güvenle kırpar. */
  const PREVIEW_FILL = 1.0;
  const scale =
    Math.min(boxW / plateDims.w, boxH / plateDims.h) * PREVIEW_FILL;
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
      prevPosRef.current,
    );
    prevPosRef.current = next;
    onChangeMediaPosition(next);
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
        /* Phase 119 — Kartı %100 doldur (hardcoded box DEĞİL).
         * Gerçek render boyutu ResizeObserver ile ölçülür → scale
         * exact + responsive-safe. overflow:hidden çevre transparent
         * stage-padding'i crop eder (preview-first Shots.so). */
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: PREVIEW_BASE_W,
          height: PREVIEW_BASE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
          /* StageScene root `.k-studio__stage` CSS `flex:1` — flex
           * parent gerekir yoksa height 0 collapse (plate center
           * kaybolur). Bu wrapper flex container yaparak stage'i
           * PREVIEW_BASE boyutuna doldurur (Stage'de stage alanı
           * flex-fill ettiği gibi). chromeless: stage bg/dot-grid/
           * scene/floor render edilmez — yalnız plate görünür. */
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
            /* Phase 128 — Pad = NAVIGATOR + VIEWFINDER GROUP
             *  (Shots.so canonical, gerçek browser DOM ölçümüyle
             *  doğrulandı).
             *
             *  Shots.so yapısı (canlı kanıt):
             *   - `.position-pad-safearea` = sabit navigator
             *     surface (pad'in tamamı).
             *   - `.pad-preview > .layout-item` = full-extent
             *     background, `transform: none` SABİT (pad'i tam
             *     doldurur — navigator'ın değişmeyen zemini).
             *   - `.drag-handle` = hareket eden GROUP (`transform:
             *     translate(...)`), pan'ı uygular.
             *   - `.viewfinder-div` = `.drag-handle`'ın ÇOCUĞU →
             *     handle ile AYNI center (canlı ölçüm: dx:0 dy:0).
             *     Beyaz nokta + rectangle aynı GROUP, birlikte
             *     hareket eder.
             *   - zoom → viewfinder boyutu (1/zoom; canlı ölçüm
             *     zoom %101 → pad'in %99'u).
             *   - pan → handle GROUP translate (bg SABİT kalır;
             *     "görünür pencereyi navigator üzerinde taşıyorum").
             *
             *  Phase 127 yanlıştı: handle pad'e sabit anchor +
             *  viewfinder ayrı ters-izdüşüm idi (kullanıcı: "beyaz
             *  nokta bağımsız sabit anchor değil — viewfinder
             *  rectangle'ın merkez marker'ı; rectangle ile birlikte
             *  hareket etmeli"). Phase 128: dot + rectangle TEK
             *  GROUP (`.k-studio__pad-viewfinder`), AYNI center'da
             *  birlikte hareket; pad arka planı (StageScene thumb
             *  zaten arkada — navigator/full-extent) SABİT.
             *
             *  Yalnız pad overlay GÖSTERİMİ. Canonical mediaPosition
             *  state, shared resolver, export matematiği, composition
             *  translate, candidate thumb mantığı DEĞİŞMEZ (pad
             *  interaction hâlâ aynı mediaPosition'ı yazar; spec
             *  §state-export bozma; rail-head pad navigator semantiği
             *  ile preset-thumb canonical preview AYRI). */
            const z = Number.isFinite(previewZoomPct)
              ? previewZoomPct
              : 100;
            /* Viewfinder GROUP boyut oranı = BASE inset × (1/zoom).
             *  BASE_FRAC (0.78): zoom %100'de bile viewfinder pad'i
             *  TAM kaplamaz → mediaPosition'ın her zaman (zoom %100
             *  dahil) viewfinder GROUP'u kaydıracak hareket alanı
             *  (travel>0) olur. Zoom artınca viewfinder daralır
             *  (Shots.so 1/zoom — canlı ölçüm zoom %101 → %99). */
            const BASE_FRAC = 0.78;
            const vfFrac = Math.max(
              0.18,
              Math.min(BASE_FRAC, BASE_FRAC * (100 / z)),
            );
            const vfPct = vfFrac * 100;
            /* Serbest alan oranı: viewfinder GROUP pad içinde ne
             *  kadar gezinebilir (kenardan taşmaz). vfFrac ≤ 0.78
             *  → travel daima > 0. mediaPosition izdüşümü: media +x
             *  → viewfinder GROUP +x (Shots.so `.drag-handle` media-
             *  position anchor: handle/group media yönünde hareket;
             *  kullanıcı "görünür pencereyi navigator alanı üzerinde
             *  taşıyorum"). */
            const travel = (1 - vfFrac) * 50;
            const vfCx = 50 + mediaPosition.x * travel;
            const vfCy = 50 + mediaPosition.y * travel;
            return (
              <>
                {/* Dim: viewfinder GROUP DIŞINI karart (group ile
                    hareket eder — Shots.so viewfinder dim paritesi).
                    Navigator'ın "kapsam dışı" alanını gösterir. */}
                <div
                  className="k-studio__pad-dim"
                  data-testid="studio-rail-pad-dim"
                  aria-hidden
                  style={{
                    clipPath: `polygon(
                      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                      ${vfCx - vfPct / 2}% ${vfCy - vfPct / 2}%,
                      ${vfCx - vfPct / 2}% ${vfCy + vfPct / 2}%,
                      ${vfCx + vfPct / 2}% ${vfCy + vfPct / 2}%,
                      ${vfCx + vfPct / 2}% ${vfCy - vfPct / 2}%,
                      ${vfCx - vfPct / 2}% ${vfCy - vfPct / 2}%
                    )`,
                  }}
                />
                {/* Viewfinder GROUP: rectangle + center dot TEK
                    eleman, AYNI center'da (Shots.so `.drag-handle`
                    > `.viewfinder-div` çocuk ilişkisi, dx:0 dy:0).
                    Boyut zoom (1/zoom), konum mediaPosition. Dot,
                    rectangle'ın geometrik merkez marker'ı (::after
                    pseudo, studio.css) — bağımsız anchor DEĞİL. */}
                <div
                  className="k-studio__pad-viewfinder"
                  data-testid="studio-rail-pad-viewfinder"
                  data-vf-frac={vfFrac.toFixed(4)}
                  aria-label="Media viewfinder"
                  style={{
                    left: `${vfCx}%`,
                    top: `${vfCy}%`,
                    width: `${vfPct}%`,
                    height: `${vfPct}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
