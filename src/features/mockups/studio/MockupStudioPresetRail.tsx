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

import { useState } from "react";
import { StudioIcon } from "./icons";
import {
  resolvePresetThumbScene,
  type SceneOverride,
} from "./frame-scene";
/* Phase 96 — Unified Mockup+Frame rail: tek PresetThumbMockup
 * kullanılır. PresetThumbFrame Phase 86-95 baseline'da Frame mode
 * için ayrı bounded cream canvas içeren thumb idi; Phase 96'da rail
 * mode-AGNOSTIC olduğu için sadece Mockup thumb kullanılır
 * (svg-art.tsx'te PresetThumbFrame export hâlâ var — gelecek
 * kullanım için kalır). */
import { PresetThumbMockup } from "./svg-art";
import type { StudioAppState, StudioMode } from "./types";

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
 * ile uyumlu). */
const LAYOUT_PRESETS = ["Cascade", "Centered", "Mirror", "Landscape", "Fan", "Stack"];

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
}

export function MockupStudioPresetRail({
  mode,
  appState,
  activePalette,
  sceneOverride,
  layoutCount,
  onChangeLayoutCount,
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
  const [active, setActive] = useState(0);
  const isPreview = appState === "preview" || appState === "renderDone";
  /* Phase 96 — Unified rail: Mockup ve Frame için tek preset family
   * + tek thumb component. Phase 95 aspect SHARED state ile Mockup ↔
   * Frame plate aynı aspect taşıyor; Phase 96 rail thumb da aynı
   * layout variation library'sinden render olur. Operator için
   * "tek kompozisyon, mode-aware sol panel" parity (Shots.so
   * canonical: rail mode-AGNOSTIC). */
  const presets = LAYOUT_PRESETS;
  const Thumb = PresetThumbMockup;
  /* Phase 89 — Resolve preset thumb scene (auto/solid/gradient). */
  const thumbScene = resolvePresetThumbScene(
    sceneOverride ?? { mode: "auto" },
    activePalette,
  );
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
        >
          {/* Phase 86 — Rail head live thumb operator asset paletini
              taşır (selected slot palette). Operator için "şu anki
              seçtiğin kompozisyon" preview.
              Phase 89 — Scene-aware bg (operator Frame mode Solid/
              Gradient swatch'larıyla scene override etti ise live
              thumb da bunu yansıtır). */}
          <Thumb
            idx={active}
            palette={activePalette}
            sceneBg={
              thumbScene.kind === "solid" || thumbScene.kind === "gradient"
                ? thumbScene
                : undefined
            }
            displayCount={layout}
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
          <div key={`${mode}-${i}`}>
            <button
              type="button"
              className="k-studio__preset-card"
              aria-pressed={active === i}
              onClick={() => setActive(i)}
              data-testid={`studio-rail-preset-${i}`}
              data-asset-aware={activePalette ? "true" : "false"}
              data-scene-mode={sceneOverride?.mode ?? "auto"}
            >
              {/* Phase 86 — Asset-aware preset thumb. Operator selected
                  slot palette'i preset card'a yansır; rail artık statik
                  decoration değil, gerçek karar destek yüzeyi
                  (Shots.so parity).
                  Phase 89 — Scene-aware preset thumb bg. Operator Frame
                  mode Solid/Gradient swatch tıklayınca thumb bg'leri
                  scene'i yansıtır (mod-AGNOSTIC rail davranışı). */}
              <Thumb
                idx={i}
                palette={activePalette}
                sceneBg={
                  thumbScene.kind === "solid" || thumbScene.kind === "gradient"
                    ? thumbScene
                    : undefined
                }
                displayCount={layout}
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
