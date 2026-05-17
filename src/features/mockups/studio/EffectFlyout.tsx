"use client";
/* eslint-disable no-restricted-syntax */

/* Phase 137 — Effect Settings Flyout (Lens Blur + BG Effects
 * secondary panel).
 *
 * File-level eslint-disable rationale: studio shell konvansiyonu —
 * MockupStudioSidebar'dan taşınan Lens segment + BG segment tile
 * button gridleri tone-aware dynamic inline visual (active/disabled
 * renk, --ks-* CSS variable) kullanıyor (Sidebar/Stage/
 * FrameExportResultBanner ile aynı pattern). Stable recipe'ler
 * studio.css'de namespace-d (k-studio__effect-flyout*); geri kalan
 * dynamic style'lar JSX'te (sibling studio dosyalarıyla tutarlı). */

import { useEffect, useRef } from "react";
import {
  type BgEffectIntensity,
  type BgEffectKind,
  type EffectPanelKey,
  LENS_BLUR_DEFAULT,
  type LensBlurIntensity,
  normalizeLensBlur,
  normalizeWatermark,
  type SceneOverride,
  WM_TEXT_MAX,
  type WmOpacity,
  type WmPlacement,
} from "./frame-scene";

interface EffectFlyoutProps {
  panel: EffectPanelKey;
  activeScene: SceneOverride;
  onChangeSceneOverride: (next: SceneOverride) => void;
  onClose: () => void;
}

const SEG_LABEL_STYLE: React.CSSProperties = {
  fontSize: 9.5,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ks-t3)",
  marginBottom: 4,
};

/* Phase 137 — Effect Settings Flyout. Sol-sidebar-bitişik
 *  secondary panel: feature ayar yüzeyi (seçim DEĞİL — seçim
 *  sceneOverride'a yazılır, tile yansıtır). Esc + dışarı-tık
 *  ile kapanır; mode değişiminde Shell unmount eder. sceneOverride
 *  modeli DEĞİŞMEZ — yalnız bu değerleri set eden UI yüzeyi. */
export function EffectFlyout({
  panel,
  activeScene,
  onChangeSceneOverride,
  onClose,
}: EffectFlyoutProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointer(e: PointerEvent) {
      const el = ref.current;
      const node = e.target;
      if (!el || !(node instanceof Node)) return;
      if (el.contains(node)) return;
      const tileWrap =
        node instanceof Element
          ? node.closest("[data-effect-tile]")
          : null;
      if (tileWrap) return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [onClose]);

  const lensCfg = normalizeLensBlur(activeScene.lensBlur);
  const bgKind: BgEffectKind | "none" =
    activeScene.bgEffect?.kind ?? "none";
  const bgIntensity: BgEffectIntensity =
    activeScene.bgEffect?.intensity ?? "medium";
  const wmCfg = normalizeWatermark(activeScene.watermark);

  return (
    <div
      ref={ref}
      className="k-studio__effect-flyout"
      data-testid={`studio-effect-flyout-${panel}`}
      role="dialog"
      aria-label={
        panel === "lens"
          ? "Lens Blur settings"
          : panel === "watermark"
            ? "Watermark settings"
            : "BG Effects settings"
      }
    >
      <div className="k-studio__effect-flyout-title">
        {panel === "lens"
          ? "Lens Blur"
          : panel === "watermark"
            ? "Watermark"
            : "BG Effects"}
      </div>

      {panel === "lens" ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {(
              [
                [true, "On"],
                [false, "Off"],
              ] as [boolean, string][]
            ).map(([en, lbl]) => {
              const active = lensCfg.enabled === en;
              return (
                <button
                  key={String(en)}
                  type="button"
                  className="k-studio__tile"
                  data-testid={`studio-lens-enable-${en ? "on" : "off"}`}
                  data-active={active ? "true" : "false"}
                  aria-pressed={active}
                  onClick={() =>
                    onChangeSceneOverride({
                      ...activeScene,
                      lensBlur: en
                        ? { ...LENS_BLUR_DEFAULT }
                        : { ...lensCfg, enabled: false },
                    })
                  }
                  style={{
                    flex: 1,
                    minHeight: 30,
                    fontSize: 10.5,
                    color: active ? "var(--ks-or-bright)" : "var(--ks-t2)",
                    borderColor: active
                      ? "var(--ks-orb)"
                      : "rgba(255,255,255,0.12)",
                  }}
                >
                  {lbl}
                </button>
              );
            })}
          </div>

          {!lensCfg.enabled ? (
            <div
              data-testid="studio-lens-disabled-note"
              style={{
                fontSize: 10.5,
                color: "var(--ks-t3)",
                padding: "4px 0",
              }}
            >
              Lens Blur is off — enable to adjust.
            </div>
          ) : (
            /* Phase 139 — "Blur target" segment KALDIRILDI
               (plate-only/all ayrımı problemli; tek-davranışlı).
               Yalnız Intensity. */
            <div>
              <div style={SEG_LABEL_STYLE}>Intensity</div>
              <div style={{ display: "flex", gap: 4 }}>
                {(
                  [
                    ["soft", "Soft"],
                    ["medium", "Medium"],
                    ["strong", "Strong"],
                  ] as [LensBlurIntensity, string][]
                ).map(([iv, lbl]) => {
                  const active = lensCfg.intensity === iv;
                  return (
                    <button
                      key={iv}
                      type="button"
                      className="k-studio__tile"
                      data-testid={`studio-lens-intensity-${iv}`}
                      data-active={active ? "true" : "false"}
                      aria-pressed={active}
                      onClick={() =>
                        onChangeSceneOverride({
                          ...activeScene,
                          lensBlur: { ...lensCfg, intensity: iv },
                        })
                      }
                      style={{
                        flex: 1,
                        minHeight: 30,
                        fontSize: 10.5,
                        color: active
                          ? "var(--ks-or-bright)"
                          : "var(--ks-t2)",
                        borderColor: active
                          ? "var(--ks-orb)"
                          : "rgba(255,255,255,0.12)",
                      }}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : panel === "watermark" ? (
        <div style={{ display: "grid", gap: 8 }}>
          {/* Enable On/Off */}
          <div style={{ display: "flex", gap: 4 }}>
            {(
              [
                [true, "On"],
                [false, "Off"],
              ] as [boolean, string][]
            ).map(([en, lbl]) => {
              const active = wmCfg.enabled === en;
              return (
                <button
                  key={String(en)}
                  type="button"
                  className="k-studio__tile"
                  data-testid={`studio-wm-enable-${en ? "on" : "off"}`}
                  data-active={active ? "true" : "false"}
                  aria-pressed={active}
                  onClick={() =>
                    onChangeSceneOverride({
                      ...activeScene,
                      watermark: { ...wmCfg, enabled: en },
                    })
                  }
                  style={{
                    flex: 1,
                    minHeight: 30,
                    fontSize: 10.5,
                    color: active ? "var(--ks-or-bright)" : "var(--ks-t2)",
                    borderColor: active
                      ? "var(--ks-orb)"
                      : "rgba(255,255,255,0.12)",
                  }}
                >
                  {lbl}
                </button>
              );
            })}
          </div>

          {/* Text input + counter */}
          <div>
            <div style={SEG_LABEL_STYLE}>Text</div>
            <input
              type="text"
              data-testid="studio-wm-text"
              value={wmCfg.text}
              maxLength={WM_TEXT_MAX}
              placeholder="e.g. © Your Shop"
              onChange={(e) =>
                onChangeSceneOverride({
                  ...activeScene,
                  watermark: { ...wmCfg, text: e.target.value },
                })
              }
              style={{
                width: "100%",
                boxSizing: "border-box",
                minHeight: 30,
                fontSize: 11,
                padding: "4px 8px",
                color: "var(--ks-t1)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 4,
              }}
            />
            <div
              data-testid="studio-wm-counter"
              style={{
                fontSize: 9.5,
                color: "var(--ks-t3)",
                textAlign: "right",
                marginTop: 2,
              }}
            >
              {wmCfg.text.trim().length} / {WM_TEXT_MAX}
            </div>
            {wmCfg.text.trim().length === 0 ? (
              <div
                data-testid="studio-wm-empty-note"
                style={{
                  fontSize: 10.5,
                  color: "var(--ks-t3)",
                  padding: "2px 0",
                }}
              >
                Enter watermark text to preview.
              </div>
            ) : null}
          </div>

          {/* Opacity segment */}
          <div>
            <div style={SEG_LABEL_STYLE}>Opacity</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(
                [
                  ["soft", "Soft"],
                  ["medium", "Medium"],
                  ["strong", "Strong"],
                ] as [WmOpacity, string][]
              ).map(([iv, lbl]) => {
                const active = wmCfg.opacity === iv;
                return (
                  <button
                    key={iv}
                    type="button"
                    className="k-studio__tile"
                    data-testid={`studio-wm-opacity-${iv}`}
                    data-active={active ? "true" : "false"}
                    aria-pressed={active}
                    onClick={() =>
                      onChangeSceneOverride({
                        ...activeScene,
                        watermark: { ...wmCfg, opacity: iv },
                      })
                    }
                    style={{
                      flex: 1,
                      minHeight: 30,
                      fontSize: 10.5,
                      color: active
                        ? "var(--ks-or-bright)"
                        : "var(--ks-t2)",
                      borderColor: active
                        ? "var(--ks-orb)"
                        : "rgba(255,255,255,0.12)",
                    }}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Placement segment */}
          <div>
            <div style={SEG_LABEL_STYLE}>Placement</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(
                [
                  ["br", "Bottom-right"],
                  ["center", "Center"],
                  ["tile", "Diagonal"],
                ] as [WmPlacement, string][]
              ).map(([pv, lbl]) => {
                const active = wmCfg.placement === pv;
                return (
                  <button
                    key={pv}
                    type="button"
                    className="k-studio__tile"
                    data-testid={`studio-wm-placement-${pv}`}
                    data-active={active ? "true" : "false"}
                    aria-pressed={active}
                    onClick={() =>
                      onChangeSceneOverride({
                        ...activeScene,
                        watermark: { ...wmCfg, placement: pv },
                      })
                    }
                    style={{
                      flex: 1,
                      minHeight: 30,
                      fontSize: 10,
                      color: active
                        ? "var(--ks-or-bright)"
                        : "var(--ks-t2)",
                      borderColor: active
                        ? "var(--ks-orb)"
                        : "rgba(255,255,255,0.12)",
                    }}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <div style={SEG_LABEL_STYLE}>Effect</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(
                [
                  ["none", "None"],
                  ["vignette", "Vignette"],
                  ["grain", "Grain"],
                ] as [BgEffectKind | "none", string][]
              ).map(([kd, lbl]) => {
                const active = bgKind === kd;
                return (
                  <button
                    key={kd}
                    type="button"
                    className="k-studio__tile"
                    data-testid={`studio-bg-kind-${kd}`}
                    data-active={active ? "true" : "false"}
                    aria-pressed={active}
                    onClick={() =>
                      onChangeSceneOverride({
                        ...activeScene,
                        bgEffect:
                          kd === "none"
                            ? undefined
                            : {
                                kind: kd,
                                intensity: bgIntensity,
                              },
                      })
                    }
                    style={{
                      flex: 1,
                      minHeight: 30,
                      fontSize: 10.5,
                      color: active
                        ? "var(--ks-or-bright)"
                        : "var(--ks-t2)",
                      borderColor: active
                        ? "var(--ks-orb)"
                        : "rgba(255,255,255,0.12)",
                    }}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={SEG_LABEL_STYLE}>Intensity</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(
                [
                  ["soft", "Soft"],
                  ["medium", "Medium"],
                  ["strong", "Strong"],
                ] as [BgEffectIntensity, string][]
              ).map(([iv, lbl]) => {
                const disabled = bgKind === "none";
                const active = !disabled && bgIntensity === iv;
                return (
                  <button
                    key={iv}
                    type="button"
                    className="k-studio__tile"
                    data-testid={`studio-bg-intensity-${iv}`}
                    data-active={active ? "true" : "false"}
                    data-disabled={disabled ? "true" : "false"}
                    aria-pressed={active}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      onChangeSceneOverride({
                        ...activeScene,
                        bgEffect: {
                          kind: bgKind as BgEffectKind,
                          intensity: iv,
                        },
                      });
                    }}
                    style={{
                      flex: 1,
                      minHeight: 30,
                      fontSize: 10.5,
                      opacity: disabled ? 0.4 : 1,
                      cursor: disabled ? "not-allowed" : "pointer",
                      color: active
                        ? "var(--ks-or-bright)"
                        : "var(--ks-t2)",
                      borderColor: active
                        ? "var(--ks-orb)"
                        : "rgba(255,255,255,0.12)",
                    }}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
