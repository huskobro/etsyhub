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
import { PresetThumbFrame, PresetThumbMockup } from "./svg-art";
import type { StudioAppState, StudioMode } from "./types";

const MOCKUP_PRESETS = ["Cascade", "Centered", "Mirror", "Landscape", "Fan", "Stack"];
const FRAME_PRESETS = [
  "Centered",
  "Offset",
  "Bleed",
  "Angled",
  "Duo",
  "Story",
  "Comparison",
  "Flat Lay",
];

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
}

export function MockupStudioPresetRail({
  mode,
  appState,
}: MockupStudioPresetRailProps) {
  const [layout, setLayout] = useState<1 | 2 | 3>(1);
  const [viewTab, setViewTab] = useState<"zoom" | "tilt" | "precision">("zoom");
  const [active, setActive] = useState(0);
  const isPreview = appState === "preview" || appState === "renderDone";
  const presets = mode === "mockup" ? MOCKUP_PRESETS : FRAME_PRESETS;
  const Thumb = mode === "mockup" ? PresetThumbMockup : PresetThumbFrame;
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
        <div className="k-studio__live-thumb" data-testid="studio-rail-live-thumb">
          <Thumb idx={active} />
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
            >
              <Thumb idx={i} />
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
