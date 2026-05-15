"use client";
/* eslint-disable no-restricted-syntax */

/* Phase 77 — Studio preset rail (right side).
 *
 * Final HTML PresetRail paritesi:
 *   - Top: export capsule (block) + layout toggle (1/2/3) + view tabs
 *     (Zoom / Tilt / Precision) + live thumbnail + zoom slider
 *   - Bottom (scroll): "Layout Presets" section label + preset cards
 *     (mode-aware: Mockup 6 thumbs, Frame 8 thumbs)
 *   - Phase 77 görsel state: preview/renderDone iken altta secondary
 *     export CTA görünür
 */

import { useLayoutEffect, useRef, useState } from "react";
import { StudioIcon } from "./icons";
import type { SceneOverride } from "./frame-scene";
/* Phase 96 — Unified Mockup+Frame rail: tek PresetThumbMockup
 * kullanılır. PresetThumbFrame Phase 86-95 baseline'da Frame mode
 * için ayrı bounded cream canvas içeren thumb idi; Phase 96'da rail
 * mode-AGNOSTIC olduğu için sadece Mockup thumb kullanılır
 * (svg-art.tsx'te PresetThumbFrame export hâlâ var — gelecek
 * kullanım için kalır). */
import { type StudioStageDeviceKind } from "./svg-art";
import { StageScenePreview } from "./StageScenePreview";
import { FRAME_ASPECT_CONFIG, type FrameAspectKey } from "./frame-aspects";
import {
  STUDIO_LAYOUT_VARIANTS,
  STUDIO_LAYOUT_VARIANT_LABELS,
  type StudioAppState,
  type StudioLayoutVariant,
  type StudioMode,
  type StudioSlotMeta,
} from "./types";

/* Phase 96 — Unified LAYOUT_PRESETS family (Shots.so canonical
 * parity). Phase 77 baseline Mockup için 6 isim + Frame için 8
 * isim ayrı listeler taşıyordu — kullanıcı bug #28 "Mockup ve
 * Frame modunda right rail hâlâ fazla farklı hissettiriyor".
 *
 * Shots.so gerçek browser araştırması (real image yüklü, Mockup ↔
 * Frame mode geçiş + layout count buttons): rail Mockup + Frame'de
 * aynı 6 layout varyasyonu içerir — `Centered`, `Cascade`, `Mirror`,
 * `Landscape`, `Fan`, `Stack`. Her preset gerçek rotated/tilted/
 * offset/stacked composition; sadece label değil **gerçek layout
 * variation library**. Mockup mode = Frame mode rail (sol panel
 * swap, rail aynı kompozisyon varyasyonları).
 *
 * Phase 96 her iki mod için tek LAYOUT_PRESETS family kullanır;
 * Frame mode'a özel preset isimleri (Offset/Bleed/Angled/Duo/
 * Story/Comparison/Flat Lay) kaldırıldı — Mockup label'ları
 * canonical (Phase 77 baseline + svg-art MOCKUP_PRESETS config'i
 * ile uyumlu).
 *
 * Phase 97 — Label rationalization (Shots-aligned).
 *
 * Phase 96 label'ları: "Cascade / Centered / Mirror / Landscape /
 * Fan / Stack". "Mirror" + "Landscape" Shots terminolojisi DEĞİL
 * (Shots'ta layout variation library "Tilted / Stacked / Offset"
 * vb. semantic'ler kullanır). Operator için "Mirror" → iki yan
 * yana ayna gibi yanıltıcı; aslında MOCKUP_PRESETS index=2 phone
 * positions tilted/mirrored variation taşır.
 *
 * Phase 114 — preset list artık CANONICAL kaynaktan
 * (STUDIO_LAYOUT_VARIANTS + LABELS, types.ts). Index parity
 * garantili; rail preset i. kart = STUDIO_LAYOUT_VARIANTS[i]
 * = Stage cascade + Frame export aynı variant. String drift yok
 * (Phase 96-97 hardcoded label array → canonical türetme).
 * Cascade / Centered / Tilted / Stacked / Fan / Offset. */
const LAYOUT_PRESETS = STUDIO_LAYOUT_VARIANTS.map(
  (v) => STUDIO_LAYOUT_VARIANT_LABELS[v],
);

function LayoutIcon({ n }: { n: 1 | 2 | 3 }) {
  if (n === 1) {
    return (
      <svg width={13} height={13} viewBox="0 0 13 13" aria-hidden>
        <rect x={4} y={1} width={5} height={11} rx={1.5} fill="currentColor" />
      </svg>
    );
  }
  if (n === 2) {
    return (
      <svg width={13} height={13} viewBox="0 0 13 13" aria-hidden>
        <rect x={1} y={2} width={4.5} height={9} rx={1.5} fill="currentColor" />
        <rect x={7.5} y={2} width={4.5} height={9} rx={1.5} fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width={13} height={13} viewBox="0 0 13 13" aria-hidden>
      <rect x={0} y={3} width={3.5} height={7} rx={1} fill="currentColor" />
      <rect x={4.75} y={1.5} width={3.5} height={10} rx={1} fill="currentColor" />
      <rect x={9.5} y={3} width={3.5} height={7} rx={1} fill="currentColor" />
    </svg>
  );
}

export interface MockupStudioPresetRailProps {
  mode: StudioMode;
  appState: StudioAppState;
  /** Phase 86 — Asset-aware preset thumbnails.
   *
   * Shots.so'daki "operator asset'i değişince preset thumbnails da
   * yeniden render olur" davranışına ulaşmak için, shell selected
   * slot'un palette'ini buraya geçirir. Palette undefined ise
   * Phase 77 baseline statik karanlık preset thumbs gösterilir
   * (operator hiç slot atamamışsa veya assigned=false). */
  activePalette?: readonly [string, string];
  /** Phase 89 — Scene-aware preset thumbnails.
   *
   * Shots.so real-image-upload: operator Frame mode'da Magic/Solid/
   * Gradient swatch tıklayınca **sağ rail preset thumbnails da
   * scene-aware yeniden render oluyor**. Phase 89 fix: shell
   * sceneOverride prop'u ile rail'e iletir; preset thumb
   * `sceneOverride` prop'unu alır ve scene-aware bg gösterir
   * (auto: Phase 86 baseline palette darken; solid: tek renk;
   * gradient: two-tone). */
  sceneOverride?: SceneOverride;
  /** Phase 96 — Layout count Shell state (bug #13).
   *
   *  Shots.so rail head 1/2/3 buttons rail thumb'ları + stage cascade
   *  item count'unu birlikte değiştirir. Phase 96'da Shell-level state;
   *  buttons → setter; thumb + stage aynı limit'i uygular. */
  layoutCount?: 1 | 2 | 3;
  onChangeLayoutCount?: (next: 1 | 2 | 3) => void;
  /** Phase 114 — CANONICAL shared layout variant. Rail "Layout
   *  Presets" Phase 96-113 boyunca NO-OP idi (local `active`
   *  state, sadece thumb highlight). Phase 114: Shell layoutVariant
   *  state → preset card seçimi Shell setter'a gider → Stage
   *  cascade + rail thumb + Frame export HEPSİ aynı değerden okur
   *  (Preview = Export Truth §11.0). Fallback local state legacy
   *  (Shell prop yoksa). */
  layoutVariant?: StudioLayoutVariant;
  onChangeLayoutVariant?: (next: StudioLayoutVariant) => void;
  /** Phase 115 — Current scene device shape (Shell
   *  stageDeviceForProductType). Rail thumb geometri kaynağı
   *  productType-aware: thumb `cascadeLayoutFor(deviceShape, count,
   *  candidateVariant)` ile Stage + export ile AYNI canonical
   *  cascade'den türer (Preview = Export = Rail-thumb §11.0).
   *  Undefined → "phone" baseline. */
  deviceShape?: StudioStageDeviceKind;
  /** Phase 116 — Gerçek selection slots (Shell hydrate; real
   *  MinIO imageUrl). Rail thumb generic MockupPh yerine Stage'in
   *  AYNI StageDeviceSVG + AYNI real asset ile render edilir →
   *  thumb = orta panelin candidate-layout dizilmiş minyatür canlı
   *  türevi (§11.0). Stage `slots` prop ile AYNI referans. */
  slots?: ReadonlyArray<StudioSlotMeta>;
  /** Phase 117 — Frame aspect (Shell state). StageScenePreview
   *  AYNI `StageScene`'i render eder; `frameAspect` Stage ile
   *  birebir aynı plate/composition için gerekli (single-renderer
   *  parity). Undefined → "16:9" baseline. */
  frameAspect?: FrameAspectKey;
}

export function MockupStudioPresetRail({
  mode,
  appState,
  activePalette,
  sceneOverride,
  layoutCount,
  onChangeLayoutCount,
  layoutVariant,
  onChangeLayoutVariant,
  deviceShape,
  slots,
  frameAspect = "16:9",
}: MockupStudioPresetRailProps) {
  /* Phase 96 — Layout count Shell state'ten geliyor; fallback local
   * state (legacy). Operator buttons → onChangeLayoutCount → Shell
   * setter → tüm rail thumb + stage senkron. */
  const [localLayout, setLocalLayout] = useState<1 | 2 | 3>(3);
  const layout = layoutCount ?? localLayout;
  const setLayout = (n: 1 | 2 | 3) => {
    if (onChangeLayoutCount) onChangeLayoutCount(n);
    else setLocalLayout(n);
  };
  const [viewTab, setViewTab] = useState<"zoom" | "tilt" | "precision">("zoom");
  /* Phase 114 — Active preset = CANONICAL Shell layoutVariant
   * index (fallback local legacy). Phase 96-113 `const [active,
   * setActive] = useState(0)` LOCAL idi → preset seçimi yalnız
   * rail thumb highlight'ı değiştiriyordu, Stage cascade + export
   * DEĞİŞMİYORDU (Contract §6 sözü ↔ kod gerçeği ayrışması, Madde
   * #12 sessiz drift). Phase 114: active Shell variant'tan türer;
   * preset card onClick → onChangeLayoutVariant (Shell setter) →
   * Stage cascade + rail thumb + Frame export HEPSİ senkron
   * (Preview = Export Truth §11.0). */
  const [localVariant, setLocalVariant] =
    useState<StudioLayoutVariant>("cascade");
  const activeVariant = layoutVariant ?? localVariant;
  const active = Math.max(
    0,
    STUDIO_LAYOUT_VARIANTS.indexOf(activeVariant),
  );
  const selectVariant = (i: number) => {
    const v = STUDIO_LAYOUT_VARIANTS[i];
    if (!v) return;
    if (onChangeLayoutVariant) onChangeLayoutVariant(v);
    else setLocalVariant(v);
  };
  const isPreview = appState === "preview" || appState === "renderDone";
  /* Phase 120 — Aspect-adaptive rail item CONTAINER + layout
   * container'ı TAM doldurur (middle panel fit/fill parity).
   *
   * Sorun: Phase 117-119 yalnız preview İÇERİĞİNİ aspect-aware
   * yaptı; rail item kutusu SABİT landscape `height: 92px` kaldı.
   * 16:9 idare ediyordu ama 9:16 portrait'te plate kart
   * genişliğinin %74'ünü void bırakıyordu. CSS `aspect-ratio` +
   * `max-height` + `width:100%` denemesi de çelişti (width:100%
   * width'i kilitliyor, aspect bozuluyor → hâlâ ~%30 void;
   * kullanıcı "container içinde layout küçük kalıyor, container
   * daha da büyüsün layout tamamen doldursun").
   *
   * Phase 120 final fix — JS-computed EXACT aspect kart geometry:
   *
   *  1. Rail-scroll iç genişliği `ResizeObserver` ile ÖLÇÜLÜR
   *     (hardcoded değil; responsive-safe). idealW = ölçülen
   *     genişlik. idealH = idealW / plateAspect (kart aspect =
   *     plate aspect BİREBİR).
   *  2. idealH bir üst sınırı (RAIL_CARD_MAX_H, rail-scroll
   *     bütçesi — 6 portrait kart scroll'u zorlamasın) aşarsa
   *     YÜKSEKLİK clamp'lenir VE genişlik de aspect'i korumak
   *     için ORANTISAL küçültülür (cardW = cardH * plateAspect).
   *     Böylece kart her aspect'te plate'le BİREBİR oranlı;
   *     portrait'te dar+uzun (rail'de ortalı), landscape'te
   *     geniş+kısa. Aspect ASLA bozulmaz.
   *  3. StageScenePreview `PREVIEW_FILL = 1.0` + kart aspect =
   *     plate aspect → plate kartı EDGE-TO-EDGE doldurur (her
   *     iki eksende ~%100; "layout container ile AYNI boyut,
   *     küçük kalmaz").
   *
   * Aspect değişince kart geometry + plate fill BİRLİKTE yeniden
   * hesaplanır (middle panel'in plate'i stage'e sığdığı AYNI
   * fit/fill ilişkisi). Tek render path KORUNUR (StageScene). */
  /* Phase 120 — Ölçüm kaynağı = kart WRAPPER `<div>` (content-flow
   * içinde, scrollbar/gutter SKEW'i YOK). rail-scroll `clientWidth`
   * `scrollbar-gutter: stable both-edges` ile ilk ölçümde stale
   * olabiliyordu → 16:9 kart content box'tan 16px taşıyordu
   * (rightGap -16). Wrapper div tam available genişlik (padding +
   * gutter + scrollbar SONRASI); cardW = bu genişlik → ASLA taşmaz,
   * yatay simetri exact. */
  const wrapMeasureRef = useRef<HTMLDivElement | null>(null);
  const [railInnerW, setRailInnerW] = useState<number>(167);
  useLayoutEffect(() => {
    const el = wrapMeasureRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setRailInnerW(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const plateAspect = FRAME_ASPECT_CONFIG[frameAspect].ratio; // w/h
  /* Rail-scroll bütçesi: çok uzun portrait kart (9:16 →
   * idealW/0.5625) 6 preset'i scroll'da zorlamasın. Üst sınır
   * aşılınca height clamp + width orantısal küçülür → aspect
   * EXACT korunur. */
  const RAIL_CARD_MAX_H = 260;
  const idealW = railInnerW;
  const idealH = idealW / plateAspect;
  const cardH = Math.min(idealH, RAIL_CARD_MAX_H);
  const cardW =
    cardH < idealH ? Math.round(cardH * plateAspect) : Math.round(idealW);
  const cardHr = Math.round(cardH);
  /* Phase 96 — Unified rail: Mockup ve Frame için tek preset family
   * + tek thumb component. Phase 95 aspect SHARED state ile Mockup ↔
   * Frame plate aynı aspect taşıyor; Phase 96 rail thumb da aynı
   * layout variation library'sinden render olur. Operator için
   * "tek kompozisyon, mode-aware sol panel" parity (Shots.so
   * canonical: rail mode-AGNOSTIC). */
  const presets = LAYOUT_PRESETS;
  /* Phase 117 — Ayrı thumb renderer (PresetThumbMockup) +
   * resolvePresetThumbScene KALDIRILDI. Rail thumb artık orta
   * panelin AYNI StageScene'i (StageScenePreview, scaled +
   * candidate layoutVariant). Scene/plate/cascade chrome Stage
   * StageScene içinde resolve edilir — rail ayrı scene resolve
   * ETMEZ (tek render path, sessiz drift §12 YASAK). */
  return (
    <aside className="k-studio__rail" data-testid="studio-rail">
      <div className="k-studio__rail-head">
        <button
          type="button"
          className="k-studio__export-cap"
          data-block="true"
          data-testid="studio-rail-export"
        >
          <StudioIcon name="upload" size={11} />
          Export · 1× · PNG
        </button>
        <div
          className="k-studio__layout-tog"
          role="group"
          aria-label="Layout"
        >
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              className="k-studio__layout-btn"
              aria-pressed={layout === n}
              onClick={() => setLayout(n as 1 | 2 | 3)}
              data-testid={`studio-rail-layout-${n}`}
            >
              <LayoutIcon n={n as 1 | 2 | 3} />
            </button>
          ))}
        </div>
        <div className="k-studio__view-tabs" role="tablist" aria-label="View">
          {(["zoom", "tilt", "precision"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className="k-studio__view-tab"
              aria-pressed={viewTab === t}
              onClick={() => setViewTab(t)}
              data-testid={`studio-rail-view-${t}`}
            >
              {t[0]!.toUpperCase()}
              {t.slice(1)}
            </button>
          ))}
        </div>
        <div
          className="k-studio__live-thumb"
          data-testid="studio-rail-live-thumb"
          data-asset-aware={activePalette ? "true" : "false"}
          data-scene-mode={sceneOverride?.mode ?? "auto"}
          data-frame-aspect={frameAspect}
          style={{ width: cardW, height: cardHr }}
        >
          {/* Phase 117 — Rail head live thumb = orta panelin AYNI
              StageScene'i, ACTIVE (selected) layoutVariant ile,
              küçültülmüş. Ayrı SVG thumb renderer YOK; tek render
              path (StageScenePreview → StageScene). Operator için
              "şu anki seçtiğin kompozisyonun mini hali" — orta panel
              ile candidate-layout dışında BİREBİR. */}
          <StageScenePreview
            layoutVariant={activeVariant}
            mode={mode}
            slots={slots ?? []}
            deviceKind={deviceShape ?? "phone"}
            frameAspect={frameAspect}
            activePalette={activePalette}
            sceneOverride={sceneOverride}
            layoutCount={layout}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span className="k-studio__range-cap">Zoom</span>
          <input
            type="range"
            className="k-studio__range"
            min={25}
            max={200}
            defaultValue={100}
            aria-label="Zoom"
          />
          <span
            className="k-studio__range-val"
            style={{ minWidth: 32 }}
          >
            100%
          </span>
        </div>
      </div>
      <div className="k-studio__rail-scroll">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            margin: "8px 0 7px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--ks-fm)",
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: "0.13em",
              textTransform: "uppercase",
              color: "var(--ks-t3)",
            }}
          >
            Layout Presets
          </span>
          <span
            style={{
              flex: 1,
              height: 1,
              background: "rgba(255,255,255,0.05)",
              marginLeft: 6,
            }}
          />
        </div>
        {presets.map((label, i) => (
          <div
            key={`${mode}-${i}`}
            ref={i === 0 ? wrapMeasureRef : undefined}
          >
            <button
              type="button"
              className="k-studio__preset-card"
              aria-pressed={active === i}
              onClick={() => selectVariant(i)}
              data-testid={`studio-rail-preset-${i}`}
              data-variant={STUDIO_LAYOUT_VARIANTS[i]}
              data-asset-aware={activePalette ? "true" : "false"}
              data-scene-mode={sceneOverride?.mode ?? "auto"}
              data-frame-aspect={frameAspect}
              style={{ width: cardW, height: cardHr }}
            >
              {/* Phase 117 — Preset thumb = orta panelin AYNI
                  StageScene'i, CANDIDATE layoutVariant
                  (STUDIO_LAYOUT_VARIANTS[i]) ile, küçültülmüş.
                  "thumb = middle panel if rendered in that layout":
                  ayrı SVG thumb renderer YOK, tek render path
                  (StageScenePreview → StageScene). Fark yalnız
                  candidate layoutVariant; plate/scene/cascade/chrome/
                  asset Stage ile BİREBİR (§11.0, Contract §6). */}
              <StageScenePreview
                layoutVariant={
                  STUDIO_LAYOUT_VARIANTS[i] ?? "cascade"
                }
                mode={mode}
                slots={slots ?? []}
                deviceKind={deviceShape ?? "phone"}
                frameAspect={frameAspect}
                activePalette={activePalette}
                sceneOverride={sceneOverride}
                layoutCount={layout}
              />
            </button>
            <div
              className="k-studio__preset-cap"
              data-active={active === i ? "true" : "false"}
            >
              {label}
            </div>
          </div>
        ))}
        {isPreview ? (
          <button
            type="button"
            className="k-studio__export-cap"
            data-block="true"
            style={{ marginTop: 6, height: 32 }}
            data-testid="studio-rail-preview-export"
          >
            <StudioIcon name="upload" size={12} />
            Export {mode === "frame" ? "Frame" : "Mockup"}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
