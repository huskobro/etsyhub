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
  type LensBlurTarget,
  normalizeLensBlur,
  type SceneOverride,
} from "./frame-scene";

interface EffectFlyoutProps {
  panel: EffectPanelKey;
  activeScene: SceneOverride;
  lensTargetingSupported: boolean;
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
  lensTargetingSupported,
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

  return (
    <div
      ref={ref}
      className="k-studio__effect-flyout"
      data-testid={`studio-effect-flyout-${panel}`}
      role="dialog"
      aria-label={panel === "lens" ? "Lens Blur settings" : "BG Effects settings"}
    >
      <div className="k-studio__effect-flyout-title">
        {panel === "lens" ? "Lens Blur" : "BG Effects"}
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
          ) : !lensTargetingSupported ? null : (
            <>
              <div>
                <div style={SEG_LABEL_STYLE}>Blur target</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {(
                    [
                      ["plate", "Plate only"],
                      ["all", "Plate + items"],
                    ] as [LensBlurTarget, string][]
                  ).map(([t, lbl]) => {
                    const active = lensCfg.target === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        className="k-studio__tile"
                        data-testid={`studio-lens-target-${t}`}
                        data-active={active ? "true" : "false"}
                        aria-pressed={active}
                        onClick={() =>
                          onChangeSceneOverride({
                            ...activeScene,
                            lensBlur: { ...lensCfg, target: t },
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
            </>
          )}
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
