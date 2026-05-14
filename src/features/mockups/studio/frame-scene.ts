/* eslint-disable no-restricted-syntax */
/* Phase 89 — Frame mode scene control model.
 *
 * File-level eslint-disable rationale: Phase 89 scene preset palettes
 * (SOLID_PRESETS + GRADIENT_PRESETS) Studio dark shell ile uyumlu
 * spesifik hex değerleri taşır; design-tokens.ts üzerinden CSS variable
 * yapılamaz çünkü bu sabitler Frame mode swatch grid'ini besler
 * (operator click → Shell state → Stage CSS custom property inject).
 * Stable recipes studio.css'de namespace-d; bu modül palette data
 * source.
 *
 * Phase 88 stage'e always-on ambient scene surface ekledi
 * (asset-aware, mode-AGNOSTIC). Phase 89 Frame mode swatch
 * controls (Magic / Solid / Gradient) bu scene surface'i
 * gerçekten override etmesini sağlar.
 *
 * Tasarım sözleşmesi (Shots.so real-browser research'tan):
 *   - Scene state Shell'de tutulur (sceneOverride)
 *   - Frame mode'da operator swatch tıklayınca state güncellenir
 *   - Stage CSS custom properties (--ks-stage-scene-warm +
 *     --ks-stage-scene-deep) override edilir
 *   - Mockup mode'da swatch'lar görünmez ama scene ETKİSİ görünür
 *   - Right rail preset thumbs scene-aware bg gösterir
 *   - "Auto" mode (Magic ON, default) Phase 88 baseline'a düşer
 *     (selected slot palette × 0.10 / 0.55)
 *
 * Niye 3 mod (auto / solid / gradient)?
 *   - Magic Shots'ta default-on; bizde "Auto" olarak adlandırıldı
 *     (kafa karıştırıcı "Magic ✨" yerine operator-anlamlı)
 *   - Solid tam doygun renk (Shots'ta da Solid swatches operator-driven)
 *   - Gradient two-tone (Shots'ta da Gradient swatches)
 *   - Glass Phase 89 scope dışı (Frame canvas frosted effect ileri
 *     ürün davranışı; Phase 89 baseline 3 mod yeterli)
 */

export type SceneMode = "auto" | "solid" | "gradient";

export interface SceneOverride {
  mode: SceneMode;
  /** Solid mode: tek renk (#RRGGBB).
   *
   *  Auto mode: undefined (Phase 88 baseline activePalette'den
   *  türetir).
   *  Gradient mode: from color (gradient first stop). */
  color?: string;
  /** Gradient mode: second stop color (#RRGGBB).
   *
   *  Auto + Solid mode: undefined. */
  colorTo?: string;
}

/** Phase 89 — Auto mode default (Phase 88 baseline parity). */
export const SCENE_AUTO: SceneOverride = { mode: "auto" };

/** Phase 89 — Solid scene preset palette (Frame mode Solid section).
 *
 * 6 swatch: Studio dark base, light cream, warm cream, neutral
 * gray, medium gray, charcoal. Operator için "müsterik renk" set
 * (Shots'taki Solid 4-6 swatch davranışıyla parity). */
export const SOLID_PRESETS: ReadonlyArray<string> = [
  "#111009", // Studio dark (matches --ks-st)
  "#F7F5EF", // Light cream (paper)
  "#F0E9D8", // Warm cream
  "#D4CCC0", // Neutral light gray
  "#C8C0B4", // Neutral medium gray
  "#3A3530", // Dark charcoal
];

/** Phase 89 — Gradient scene preset (Frame mode Gradient section).
 *
 * 4 two-tone gradients: subtle cream→khaki, dramatic dark, warm
 * cream→tan, neutral gray→bronze. Operator için "atmospheric
 * gradient" set (Shots'taki Gradient 3-4 swatch parity). */
export const GRADIENT_PRESETS: ReadonlyArray<{ from: string; to: string }> = [
  { from: "#E8E0D4", to: "#C8BFB4" }, // soft cream
  { from: "#2A2420", to: "#1A1410" }, // dramatic dark
  { from: "#F0EAE0", to: "#D8D0C4" }, // warm cream
  { from: "#DDD5C8", to: "#B8B0A4" }, // neutral
];

/** Phase 89 — Hex → rgba conversion (Phase 88 hexToRgba duplicate;
 *  bu modülde de gerek olduğu için inline). */
function hexToRgba(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return `rgba(0,0,0,${alpha})`;
  const h = match[1]!;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Phase 89 — Scene resolver. Phase 90/93 — Visual parity tune-up.
 *
 * Operator'ın sceneOverride'ına göre Stage CSS custom properties
 * için warm/deep tone değerlerini hesaplar. Auto mode'da activePalette'e
 * düşer (Phase 88 baseline parity).
 *
 * Tone semantics:
 *   - warm = scene'in subtle warmth hint katmanı (radial sol üst)
 *   - deep = scene'in dominant vignette anchor katmanı (radial
 *     sağ alt)
 *
 * Phase 93 alpha curve (Shots.so parity bugfix — unwanted glow):
 * Phase 91'de plate eklendikten sonra plate ana subject oldu;
 * scene plate'in ALTINDA değil **plate'in DIŞINDAKİ dark padding
 * alanında** kalıyor. Phase 90'daki vivid auto alpha (0.22/0.82)
 * plate kenarına renkli halo yaratıyor — Shots.so'da plate
 * dışındaki padding pure dark, renkli glow YOK. Phase 93'te
 * padding scene alpha'sı drastik düştü; plate ana subject olarak
 * yalnız kendi bg'sini taşır.
 *
 * Alpha curve mode'a göre:
 *   - Phase 95: auto 0.03/0.08, solid 0.03/0.06, gradient 0.04/0.10
 *     (plate dışı padding pure dark; sadece çok subtle vignette
 *     hint; Shots.so canonical parity bug #30 son rezidüe temizliği)
 */
export function resolveSceneStyle(
  override: SceneOverride,
  activePalette: readonly [string, string] | undefined,
): { warm: string; deep: string } | undefined {
  if (override.mode === "auto") {
    if (!activePalette) return undefined; // Phase 88 CSS fallback
    return {
      warm: hexToRgba(activePalette[0], 0.03),
      deep: hexToRgba(activePalette[1], 0.08),
    };
  }
  if (override.mode === "solid") {
    if (!override.color) return undefined;
    return {
      warm: hexToRgba(override.color, 0.03),
      deep: hexToRgba(override.color, 0.06),
    };
  }
  // gradient
  if (!override.color || !override.colorTo) return undefined;
  return {
    warm: hexToRgba(override.color, 0.04),
    deep: hexToRgba(override.colorTo, 0.10),
  };
}

/** Phase 89 — Right rail preset thumb scene-aware bg resolver.
 *
 * PresetThumbMockup + PresetThumbFrame artık scene'i de
 * yansıtabilir. Bu helper preset thumb'un SVG bg fill'ini
 * (180×88 viewport) hesaplar.
 *
 * - Auto: activePalette[1] dark tint (Phase 86 baseline parity)
 * - Solid: tek renk (operator tıkladığı solid color)
 * - Gradient: two-tone gradient (operator tıkladığı gradient
 *   preset'inin from/to'sundan SVG linearGradient için
 *   data; preset thumb component'i bu data'yı kullanır)
 */
export function resolvePresetThumbScene(
  override: SceneOverride,
  activePalette: readonly [string, string] | undefined,
): { kind: "auto"; palette: readonly [string, string] | undefined }
  | { kind: "solid"; color: string }
  | { kind: "gradient"; from: string; to: string } {
  if (override.mode === "auto") {
    return { kind: "auto", palette: activePalette };
  }
  if (override.mode === "solid" && override.color) {
    return { kind: "solid", color: override.color };
  }
  if (override.mode === "gradient" && override.color && override.colorTo) {
    return { kind: "gradient", from: override.color, to: override.colorTo };
  }
  return { kind: "auto", palette: activePalette };
}
