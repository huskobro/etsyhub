"use client";

/**
 * Phase 70 — Recipe editor first slice (blendMode + shadow on/off + intensity).
 *
 * Operatör render davranışını authoring sırasında kontrol eder:
 *   - blendMode: normal | multiply | screen
 *   - shadow on/off (binding config'te shadow field opsiyonel)
 *   - shadow intensity: opacity (0-1) + blur (px) + offset X/Y (px)
 *
 * Backend (Phase 8 recipe-applicator.ts) zaten bu config'i okuyor —
 * UI sadece exposure. Yeni big abstraction yok; mevcut MockupRecipeSchema
 * + ShadowSpecSchema ile birebir parity.
 *
 * Form factor:
 *   - Compact card (k-card pattern)
 *   - blendMode k-segment toggle (Phase 59 filter affordance parity)
 *   - shadow toggle button + reveal/hide intensity controls
 *   - Intensity controls: numeric input + range slider for opacity,
 *     numeric input for blur/offset (pixel-precise)
 *   - Mode-aware tooltips (operator hangi blend ne işe yarar bilir)
 *
 * Phase 70 scope:
 *   - blendMode + shadow opt-in
 *   - Sane defaults: opacity 0.4, blur 8, offset 4/4 (subtle drop shadow)
 *   - 1 sample shadow preset (operator hızlı başlangıç için)
 *
 * Phase 71+ candidate (bilinçli scope dışı):
 *   - Multi-shadow stack
 *   - Color shadow (şu an sadece siyah)
 *   - Inner shadow / glow
 *   - Lighting / cornerRadius / mask (V2 reserve, schema ekleme gerek)
 */

import { Sun, X } from "lucide-react";

export type Recipe = {
  blendMode: "normal" | "multiply" | "screen";
  shadow?: {
    offsetX: number;
    offsetY: number;
    blur: number;
    opacity: number;
  };
};

const BLEND_OPTIONS = [
  {
    value: "normal" as const,
    label: "Normal",
    desc: "Design overlays as-is",
  },
  {
    value: "multiply" as const,
    label: "Multiply",
    desc: "Printed-on-fabric look (darker pixels show through)",
  },
  {
    value: "screen" as const,
    label: "Screen",
    desc: "Light overlay (lighter pixels boost the base)",
  },
];

const DEFAULT_SHADOW: NonNullable<Recipe["shadow"]> = {
  offsetX: 4,
  offsetY: 4,
  blur: 8,
  opacity: 0.4,
};

export type RecipeEditorProps = {
  value: Recipe;
  onChange: (next: Recipe) => void;
  disabled?: boolean;
};

export function RecipeEditor({
  value,
  onChange,
  disabled = false,
}: RecipeEditorProps) {
  const shadowEnabled = !!value.shadow;
  const shadow = value.shadow ?? DEFAULT_SHADOW;

  const setBlend = (b: Recipe["blendMode"]) => {
    onChange({ ...value, blendMode: b });
  };

  const toggleShadow = () => {
    if (shadowEnabled) {
      // Strip shadow field (binding config schema treats it as optional)
      const { shadow: _drop, ...rest } = value;
      void _drop;
      onChange(rest);
    } else {
      onChange({ ...value, shadow: DEFAULT_SHADOW });
    }
  };

  const updateShadow = (
    field: keyof NonNullable<Recipe["shadow"]>,
    raw: number,
  ) => {
    if (Number.isNaN(raw)) return;
    let v = raw;
    if (field === "opacity") v = Math.max(0, Math.min(1, v));
    if (field === "blur") v = Math.max(0, v);
    onChange({
      ...value,
      shadow: { ...shadow, [field]: v },
    });
  };

  return (
    <div
      className="rounded-md border border-line bg-paper p-4"
      data-testid="recipe-editor"
    >
      <label className="block text-[13px] font-semibold text-ink">Recipe</label>
      <p className="mt-0.5 text-[12px] text-ink-3">
        Render behavior — how the design composites onto the base asset.
      </p>

      {/* Blend mode */}
      <div className="mt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="k-segment"
            role="group"
            aria-label="Blend mode"
            data-testid="recipe-editor-blend-toggle"
          >
            {BLEND_OPTIONS.map((opt) => {
              const active = value.blendMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBlend(opt.value)}
                  disabled={disabled}
                  data-testid={`recipe-editor-blend-${opt.value}`}
                  data-active={active}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            {BLEND_OPTIONS.find((o) => o.value === value.blendMode)?.desc}
          </span>
        </div>
      </div>

      {/* Shadow toggle + controls */}
      <div className="mt-4 border-t border-line-soft pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-ink-3" aria-hidden />
            <span className="text-[13px] font-semibold text-ink">
              Drop shadow
            </span>
          </div>
          <button
            type="button"
            onClick={toggleShadow}
            disabled={disabled}
            className="k-btn k-btn--ghost"
            data-size="sm"
            data-testid="recipe-editor-shadow-toggle"
            data-active={shadowEnabled}
            title={
              shadowEnabled
                ? "Disable drop shadow"
                : "Enable drop shadow with subtle defaults"
            }
          >
            {shadowEnabled ? (
              <>
                <X className="h-3 w-3" aria-hidden /> Disable
              </>
            ) : (
              <>+ Enable</>
            )}
          </button>
        </div>

        {shadowEnabled ? (
          <div
            className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
            data-testid="recipe-editor-shadow-controls"
          >
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                Opacity
              </span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={shadow.opacity}
                disabled={disabled}
                onChange={(e) =>
                  updateShadow("opacity", Number.parseFloat(e.target.value))
                }
                className="h-8 rounded-md border border-line bg-paper px-2 font-mono text-[12px] text-ink focus:border-k-orange focus:outline-none disabled:opacity-50"
                data-testid="recipe-editor-shadow-opacity"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                Blur (px)
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={shadow.blur}
                disabled={disabled}
                onChange={(e) =>
                  updateShadow("blur", Number.parseFloat(e.target.value))
                }
                className="h-8 rounded-md border border-line bg-paper px-2 font-mono text-[12px] text-ink focus:border-k-orange focus:outline-none disabled:opacity-50"
                data-testid="recipe-editor-shadow-blur"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                Offset X
              </span>
              <input
                type="number"
                step={1}
                value={shadow.offsetX}
                disabled={disabled}
                onChange={(e) =>
                  updateShadow("offsetX", Number.parseFloat(e.target.value))
                }
                className="h-8 rounded-md border border-line bg-paper px-2 font-mono text-[12px] text-ink focus:border-k-orange focus:outline-none disabled:opacity-50"
                data-testid="recipe-editor-shadow-offsetx"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                Offset Y
              </span>
              <input
                type="number"
                step={1}
                value={shadow.offsetY}
                disabled={disabled}
                onChange={(e) =>
                  updateShadow("offsetY", Number.parseFloat(e.target.value))
                }
                className="h-8 rounded-md border border-line bg-paper px-2 font-mono text-[12px] text-ink focus:border-k-orange focus:outline-none disabled:opacity-50"
                data-testid="recipe-editor-shadow-offsety"
              />
            </label>
          </div>
        ) : null}

        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          {shadowEnabled
            ? `Shadow rendered by self-hosted Sharp pipeline · opacity ${shadow.opacity} · blur ${shadow.blur}px`
            : "No shadow — design renders flat on the base asset"}
        </p>
      </div>
    </div>
  );
}
