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

import { StageScene } from "./MockupStudioStage";
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
  /** Thumb kutu boyutu (preset card iç alanı; CSS'ten ölçülür ya
   *  da sabit). Default preset-card ~ (auto width × 84h). */
  boxW: number;
  boxH: number;
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
  boxW,
  boxH,
}: StageScenePreviewProps) {
  /* StageScene base sahneyi PREVIEW_BASE (büyük) koordinatlarda
   * render eder; wrapper CSS scale ile thumb kutusuna sığdırır.
   * Aspect-locked: en dar eksene fit (Stage compositionGroup
   * paritesi — cascade plate-relative locked, scale ile bozulmaz).
   * Orta panelin BİREBİR küçültülmüş hali. */
  const scale = Math.min(boxW / PREVIEW_BASE_W, boxH / PREVIEW_BASE_H);

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

  return (
    <div
      data-testid="studio-rail-stagescene-preview"
      data-layout-variant={layoutVariant}
      data-frame-aspect={frameAspect}
      style={{
        width: boxW,
        height: boxH,
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
          isPreview
          isRender={false}
          isEmpty={false}
          chromeless
        />
      </div>
    </div>
  );
}
