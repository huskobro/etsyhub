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

export type SceneMode = "auto" | "solid" | "gradient" | "glass";

/** Phase 98 — Glass scene variants. */
export type GlassVariant = "light" | "dark" | "frosted";

/** Lens Blur — TEK-DAVRANIŞLI (Phase 139: `target` kaldırıldı).
 *
 *  Phase 98-108 baseline `lensBlur: boolean` (tek 8px; plate'in
 *  TÜM subtree'si blur). Phase 109 `target: "plate"|"all"` ayrımı
 *  eklenmişti ("plate" = yalnız plate bg bulanık, items NET).
 *
 *  Phase 138-139 (browser+DOM kanıtlandı): `target="plate"` AYRI
 *  bir content-blur wrapper gerektiriyordu; o wrapper'ın blur'u
 *  plate-bg gradyeninin amber ucunu plate kenarına yayıp
 *  (plate overflow:hidden sert kesim) KENARDA TURUNCU BANT
 *  üretiyordu. `target="all"` (plate'in KENDİSİNE filter:blur)
 *  bu sorunu yaşamıyordu — kenar dahil tek-pass blur, koyu
 *  stage zemini ile organik harman. "Sadece plate blur + items
 *  NET" davranışı, mevcut render zincirinde (items plate'in
 *  render bağlamı içinde; izolasyon zoom/framing/pan zincirini
 *  riske atar) temiz şekilde yapılamıyor.
 *
 *  Karar (kullanıcı): problemli `target` ayrımı TAMAMEN KALDIRILDI.
 *  Lens Blur tek-davranışlı = eski iyi çalışan "all" yolu
 *  (plate'in kendisine `filter:blur`). intensity korunur
 *  (soft/medium/strong → 4/8/14px). Gerçek `plate-only` ileride
 *  ayrı iş olarak temiz mimari (item-izolasyonu zoom/framing'i
 *  bozmadan) ile yeniden tasarlanır — teknik engel
 *  `known-issues-and-deferred.md`'de. */
export type LensBlurIntensity = "soft" | "medium" | "strong";
export interface LensBlurConfig {
  enabled: boolean;
  intensity: LensBlurIntensity;
}

/** intensity → CSS blur px. */
export const LENS_BLUR_PX: Record<LensBlurIntensity, number> = {
  soft: 4,
  medium: 8,
  strong: 14,
};

/** Lens Blur default (enabled, medium). Phase 139 — target yok. */
export const LENS_BLUR_DEFAULT: LensBlurConfig = {
  enabled: true,
  intensity: "medium",
};

/* Phase 136 — BG Effects (Frame scene effect).
 *
 *  Tek-seçimli atmosfer effect'i: vignette VEYA grain (ikisi
 *  aynı anda değil). mode/glassVariant/lensBlur'dan BAĞIMSIZ
 *  eksen — kombinlenebilir (mutual-exclusion yok). undefined =
 *  none. Frame-only (Mockup mode'a sızmaz). Canonical kategori 1
 *  (export'a yansır + sceneSnapshot'lanır — §11.0). Shots.so
 *  referansı "Background effects" = Noise+Blur slider; Kivasy
 *  kararı: blur tekrar etme (lensBlur var), vignette ekle
 *  (Etsy hero değeri), tek-seçim (sade). */
export type BgEffectKind = "vignette" | "grain";
export type BgEffectIntensity = "soft" | "medium" | "strong";

/** Phase 137 — Effect Settings Flyout: ayarlı effect panel
 *  kimliği. Shell + Sidebar + EffectFlyout ortak tek kaynak
 *  (drift önleme — SceneOverride/LensBlurConfig paylaşılan-tip
 *  pattern'i). */
export type EffectPanelKey = "lens" | "bgfx" | "watermark";
export interface BgEffectConfig {
  kind: BgEffectKind;
  intensity: BgEffectIntensity;
}

/* Phase 140 — Watermark (text). Frame-only effect; mode/glass/
 * lensBlur/bgEffect'ten bağımsız eksen (SceneOverride.watermark?).
 * Preview = export aynı resolveWatermarkLayout (§11.0). Image/logo,
 * size, color, font, rotation Phase 2 (scope dışı). */
export type WmOpacity = "soft" | "medium" | "strong";
export type WmPlacement = "br" | "center" | "tile";
export type WmAnchor = "start" | "middle" | "end";

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  opacity: WmOpacity;
  placement: WmPlacement;
}

export const WM_OPACITY: Record<WmOpacity, number> = {
  soft: 0.18,
  medium: 0.3,
  strong: 0.45,
};

/** Layout-safe text clamp (spec §5.2 guardrail 2). */
export const WM_TEXT_MAX = 48;

export const WM_DEFAULT: WatermarkConfig = {
  enabled: false,
  text: "",
  opacity: "medium",
  placement: "br",
};

/** Normalize raw watermark input. Unknown enum → default;
 *  text trimmed, newlines→space (single-line), clamped to
 *  WM_TEXT_MAX. Always returns a fresh object. */
export function normalizeWatermark(
  raw: WatermarkConfig | null | undefined,
): WatermarkConfig {
  if (!raw) {
    return { ...WM_DEFAULT };
  }
  const opacity: WmOpacity =
    raw.opacity === "soft" ||
    raw.opacity === "medium" ||
    raw.opacity === "strong"
      ? raw.opacity
      : WM_DEFAULT.opacity;
  const placement: WmPlacement =
    raw.placement === "br" ||
    raw.placement === "center" ||
    raw.placement === "tile"
      ? raw.placement
      : WM_DEFAULT.placement;
  const text = String(raw.text ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, WM_TEXT_MAX);
  return {
    enabled: Boolean(raw.enabled),
    text,
    opacity,
    placement,
  };
}

/* Vignette: radial-gradient dış-kenar alpha (merkez ŞEFFAF).
 * strong<=0.42 — ürün fotoğrafını öldürmez (guardrail).
 * Browser doğrulamasında kalibre edilir; bunlar tavan. */
export const BG_VIGNETTE_ALPHA: Record<BgEffectIntensity, number> = {
  soft: 0.14,
  medium: 0.26,
  strong: 0.42,
};

/* Grain: monokrom film-grain overlay opacity (dijital RGB
 * noise DEĞİL). strong<=0.11 — mockup kirletmez (guardrail).
 * Browser doğrulamasında kalibre edilir; bunlar tavan. */
export const BG_GRAIN_OPACITY: Record<BgEffectIntensity, number> = {
  soft: 0.04,
  medium: 0.07,
  strong: 0.11,
};

/** Normalize lensBlur field (backward-compat; Phase 139 — target
 *  yok, tek-davranışlı).
 *  - undefined / false → disabled
 *  - true (legacy Phase 98-108) → enabled, intensity medium
 *  - LensBlurConfig → as-is (eski persisted config'lerdeki
 *    `target` alanı varsa structural-typing ile yok sayılır —
 *    artık okunmuyor; davranış tek yol). */
export function normalizeLensBlur(
  raw: boolean | LensBlurConfig | undefined,
): LensBlurConfig {
  if (raw === undefined || raw === false) {
    return { enabled: false, intensity: "medium" };
  }
  if (raw === true) {
    return { enabled: true, intensity: "medium" };
  }
  return { enabled: raw.enabled, intensity: raw.intensity };
}

export interface SceneOverride {
  mode: SceneMode;
  /** Solid mode: tek renk (#RRGGBB).
   *
   *  Auto mode: undefined (Phase 88 baseline activePalette'den
   *  türetir).
   *  Gradient mode: from color (gradient first stop).
   *  Glass mode: undefined (variant taşır, tek renk değil). */
  color?: string;
  /** Gradient mode: second stop color (#RRGGBB).
   *
   *  Auto + Solid + Glass mode: undefined. */
  colorTo?: string;
  /** Phase 98 — Glass mode variant (light / dark / frosted).
   *
   *  Sözleşme #11: "Frame mode sidebar controls (Magic Preset,
   *  Solid, Gradient, **Glass swatch'ları**) plate bg'sini
   *  değiştirir". Phase 89'da yalnız solid + gradient wire
   *  edilmişti — Glass swatch'lar görünür ama no-op idi
   *  (silent drift, sözleşme #12 ihlali).
   *
   *  Phase 98 fix: glass mode + 3 variant. Plate üstüne
   *  `backdrop-filter: blur()` + tone overlay uygular
   *  (Mockup mode'a da continuity ile taşınır). */
  glassVariant?: GlassVariant;
  /** Phase 98 — Lens Blur (Frame Effects).
   *
   *  Frame mode "Effects & Watermark" satırındaki "Lens Blur"
   *  butonu Phase 89'a kadar local state'ti, plate'e
   *  bağlanmamıştı. Phase 98'de plate bg'ye CSS filter blur
   *  uygulanır. Lens Blur Glass'tan farklı: Glass plate'i
   *  cam-effect ile kaplar; Lens Blur plate bg'sini bulanıklaştırır
   *  (sahnede yumuşak/atmospheric hissi). */
  lensBlur?: boolean | LensBlurConfig;
  /** Phase 136 — BG Effects (Frame scene effect). Tek-seçimli
   *  vignette|grain × soft/medium/strong. undefined = none.
   *  mode/glassVariant/lensBlur'dan bağımsız eksen (kombinlenebilir).
   *  Frame-only; export'a yansır + sceneSnapshot'lanır (§11.0).
   *  Compositing order SABİT: bg → grain → glass → lensBlur →
   *  vignette (bkz. resolvePlateEffects + frame-compositor). */
  bgEffect?: BgEffectConfig;
  /** Phase 140 — Watermark (text). Frame-only; mode/glass/
   *  lensBlur/bgEffect'ten bağımsız. undefined/null = no watermark.
   *  resolveWatermarkLayout ile preview+export aynı geometri (§11.0).
   *  EN ÜST katman (vignette'den sonra composite). */
  watermark?: WatermarkConfig | null;
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
  if (override.mode === "gradient") {
    if (!override.color || !override.colorTo) return undefined;
    return {
      warm: hexToRgba(override.color, 0.04),
      deep: hexToRgba(override.colorTo, 0.10),
    };
  }
  /* Phase 98 — Glass mode scene tone.
   *
   * Glass plate'in **üzerinde** backdrop-filter overlay uygular
   * (CSS katmanı); ama stage'in dışındaki padding alanı için
   * subtle scene tone hâlâ activePalette'e yaslı kalır
   * (mode-AGNOSTIC ambient hissi korunur).
   *
   * Glass variant tone:
   *   - light: cream/warm subtle vignette (parlak ortam hissi)
   *   - dark: derin charcoal vignette (sahne loş)
   *   - frosted: nötr gri (cam-üstü hissi) */
  if (override.mode === "glass") {
    const variant = override.glassVariant ?? "light";
    if (variant === "dark") {
      return {
        warm: "rgba(40,36,30,0.04)",
        deep: "rgba(20,16,12,0.12)",
      };
    }
    if (variant === "frosted") {
      return {
        warm: "rgba(220,215,210,0.03)",
        deep: "rgba(160,154,148,0.08)",
      };
    }
    // light
    return {
      warm: "rgba(247,245,239,0.04)",
      deep: "rgba(220,212,196,0.10)",
    };
  }
  return undefined;
}

/* Phase 116 fu2 — Canonical plate background resolver (SHARED).
 *
 * Phase 91-115 boyunca bu helper `MockupStudioStage.tsx` içindeydi
 * (Stage-only). Phase 116 fu2 "tek sahne çok ekran" modeli: right
 * rail thumb = orta panelin küçük ekranı; thumb da plate render
 * etmeli ve plate bg'si Stage ile AYNI kaynaktan gelmeli. svg-art
 * (rail thumb) `MockupStudioStage`'ten import edemezdi (circular:
 * Stage zaten svg-art'tan StageDeviceSVG import ediyor). Bu yüzden
 * canonical resolver paylaşılan `frame-scene.ts`'e taşındı —
 * `resolveSceneStyle` / `resolvePlateEffects` ile aynı module.
 *
 * Stage `MockupStudioStage` + rail thumb `PresetThumbMockup`
 * ÜÇÜ DE buradan okur → plate bg tek canonical kaynak (Preview =
 * Export = Rail-thumb §11.0; "ayrı thumb sistemi" değil aynı
 * renderer'ın küçük varyasyonu). undefined → caller CSS fallback
 * (plate `linear-gradient(135deg,#f5b27d,#d97842)`). */
export function resolvePlateBackground(
  override: SceneOverride,
  activePalette: readonly [string, string] | undefined,
): string | undefined {
  if (override.mode === "solid" && override.color) {
    return override.color;
  }
  if (override.mode === "gradient" && override.color && override.colorTo) {
    return `linear-gradient(135deg, ${override.color} 0%, ${override.colorTo} 100%)`;
  }
  // auto mode
  if (activePalette) {
    return `linear-gradient(135deg, ${activePalette[0]} 0%, ${activePalette[1]} 100%)`;
  }
  // No palette → caller CSS default fallback takes over.
  return undefined;
}

/** Phase 98 — Plate CSS filter chain resolver.
 *
 * Sözleşme #3 (Plate behavior) + #11 (Frame controls plate bg'sini
 * değiştirir): Glass/Lens Blur effect'leri **plate üzerinde** yaşar
 * (mod-AGNOSTIC continuity). Bu helper plate'in CSS `filter` +
 * `backdrop-filter` + `box-shadow` overlay'ini hesaplar.
 *
 * Plate'in mevcut bg'si (gradient/solid/auto palette) Phase 91 baseline
 * `resolvePlateBackground` ile aynen korunur; Phase 98 ek olarak:
 *   - Lens Blur: plate bg üzerinde CSS `filter: blur(Npx)` (içerideki
 *     gradient/asset yumuşar — atmospheric hissi)
 *   - Glass: plate'in IÇ alt katmanına frosted overlay (rgba beyaz
 *     veya siyah + subtle white border). Glass operator için
 *     "cam üstü gibi" presentation hissi.
 */
export interface PlateEffectStyle {
  /** Plate-içi blur px (Lens Blur Frame effect; 0 = no blur).
   *  Phase 139 — tek-davranışlı: >0 ise plate'in kendisine
   *  `filter:blur` (target ayrımı kaldırıldı). */
  filterBlurPx: number;
  /** Glass overlay sözleşmesi (variant + alpha). undefined = no glass. */
  glassOverlay: { background: string; borderTone: string } | undefined;
  /** Phase 136 — BG Effects. Vignette radial dış-kenar alpha
   *  (0 = no vignette). Grain monokrom overlay opacity (0 = no
   *  grain). Tek-seçim: en fazla biri > 0. */
  vignetteAlpha: number;
  grainOpacity: number;
}

export function resolvePlateEffects(
  override: SceneOverride,
): PlateEffectStyle {
  /* Lens Blur — tek-davranışlı (Phase 139; target kaldırıldı).
   * normalize: legacy boolean true → enabled medium. */
  const lb = normalizeLensBlur(override.lensBlur);
  const filterBlurPx = lb.enabled ? LENS_BLUR_PX[lb.intensity] : 0;
  let glassOverlay: PlateEffectStyle["glassOverlay"];
  if (override.mode === "glass") {
    const variant = override.glassVariant ?? "light";
    if (variant === "light") {
      glassOverlay = {
        background: "rgba(255,255,255,0.22)",
        borderTone: "rgba(255,255,255,0.30)",
      };
    } else if (variant === "dark") {
      glassOverlay = {
        background: "rgba(15,12,8,0.30)",
        borderTone: "rgba(255,255,255,0.10)",
      };
    } else {
      // frosted
      glassOverlay = {
        background: "rgba(255,255,255,0.12)",
        borderTone: "rgba(255,255,255,0.22)",
      };
    }
  }
  /* Phase 136 — BG Effects (tek-seçimli; mode/glass/lensBlur'dan
   *  bağımsız). undefined → ikisi de 0 (no-op). */
  let vignetteAlpha = 0;
  let grainOpacity = 0;
  if (override.bgEffect) {
    if (override.bgEffect.kind === "vignette") {
      vignetteAlpha = BG_VIGNETTE_ALPHA[override.bgEffect.intensity];
    } else {
      grainOpacity = BG_GRAIN_OPACITY[override.bgEffect.intensity];
    }
  }
  return {
    filterBlurPx,
    glassOverlay,
    vignetteAlpha,
    grainOpacity,
  };
}

/** Lens Blur layout — TEK-DAVRANIŞLI (Phase 139; preview=export
 *  §11.0).
 *
 * Phase 138 `target="plate"` AYRI bir content-blur wrapper
 * gerektiriyordu; o wrapper'ın blur'u plate-bg gradyeninin amber
 * ucunu plate kenarına yayıp (plate overflow:hidden sert kesim)
 * KENARDA TURUNCU BANT üretiyordu. `target="all"` (plate'in
 * KENDİSİNE filter:blur) bu sorunu yaşamıyordu — kenar dahil
 * tek-pass blur, koyu stage zemini ile organik harman (working,
 * kullanıcı doğruladı). "Sadece plate blur + items NET" davranışı
 * mevcut render zincirinde (items plate render bağlamı içinde;
 * izolasyon zoom/framing/pan zincirini riske atar) temiz değil.
 *
 * Karar (kullanıcı): `target` ayrımı TAMAMEN KALDIRILDI. Tek yol
 * = `plateFilter` (plate'in kendisine `filter:blur`; tüm subtree
 * tek-pass — eski iyi çalışan "all" davranışı). `contentFilterBlur`
 * SİLİNDİ. enabled → `{ plateFilter: "blur(Npx)" }`, disabled →
 * `{ plateFilter: null }` (DOM byte-identical no-op).
 *
 * Export parity: `frame-compositor.ts` Phase 113'ten beri zaten
 * target'ı OKUMUYOR (her durumda plate-area blur, cascade üstte
 * NET) → bu kaldırma export'u DEĞİŞTİRMEZ. Saf-fonksiyon: yalnız
 * `PlateEffectStyle.filterBlurPx`'e bakar (DOM/zoom/bg-bağımsız).
 *
 * Gerçek `plate-only` (plate blur + items NET) ileride AYRI bir
 * iş — temiz mimari (item'ları plate render bağlamından
 * zoom/framing/pan zincirini bozmadan izole eden bir layer
 * modeli) ile yeniden tasarlanır. Teknik engel:
 * `known-issues-and-deferred.md`. */
export interface LensBlurLayout {
  /** Lens Blur açıkken plate element'inin KENDİSİNE uygulanan
   *  CSS `filter` (tüm subtree tek-pass blur). null = kapalı. */
  plateFilter: string | null;
}

export interface WatermarkGlyph {
  /** Daima normalize edilmiş config.text. */
  text: string;
  /** 0..100 — frame genişliğinin yüzdesi. */
  xPct: number;
  /** 0..100 — frame yüksekliğinin yüzdesi. */
  yPct: number;
  rotateDeg: number;
}

export interface WatermarkLayout {
  /** false → preview/export hiçbir şey çizmez. */
  active: boolean;
  glyphs: WatermarkGlyph[];
  /** WM_OPACITY[config.opacity] veya 0 (inactive). */
  opacity: number;
  /** font-size = min(frameW,frameH) * fontPctOfMin. */
  fontPctOfMin: number;
  /** Tüm glyph'ler için ortak text-anchor. */
  anchor: WmAnchor;
}

export function resolveLensBlurLayout(
  effects: PlateEffectStyle,
): LensBlurLayout {
  if (effects.filterBlurPx <= 0) {
    return { plateFilter: null };
  }
  return { plateFilter: `blur(${effects.filterBlurPx}px)` };
}

/** Pure-TS, DOM/zoom/bg-bağımsız. Preview (React overlay z:10) ve
 *  export (Sharp SVG buffer composite, vignette sonrası) BU
 *  fonksiyondan beslenir — §11.0 Preview = Export Truth tek yer.
 *  Geometri yüzde tabanlı → frame boyutundan bağımsız. */
export function resolveWatermarkLayout(
  config: WatermarkConfig | null | undefined,
  frame: { w: number; h: number },
): WatermarkLayout {
  const cfg = normalizeWatermark(config);
  if (!cfg.enabled || cfg.text.length === 0) {
    return {
      active: false,
      glyphs: [],
      opacity: 0,
      fontPctOfMin: 0,
      anchor: "middle",
    };
  }
  const opacity = WM_OPACITY[cfg.opacity];

  if (cfg.placement === "br") {
    return {
      active: true,
      glyphs: [{ text: cfg.text, xPct: 95, yPct: 93, rotateDeg: 0 }],
      opacity,
      fontPctOfMin: 0.035,
      anchor: "end",
    };
  }

  if (cfg.placement === "center") {
    // Spec §5.2 — uzun metin font kademesi (taşma engelle, parity korunur)
    const len = cfg.text.length;
    const fontPctOfMin = len <= 16 ? 0.06 : len <= 32 ? 0.045 : 0.034;
    return {
      active: true,
      glyphs: [{ text: cfg.text, xPct: 50, yPct: 50, rotateDeg: 0 }],
      opacity,
      fontPctOfMin,
      anchor: "middle",
    };
  }

  // placement === "tile" — deterministik rotated grid (spec §4.2)
  const minDim = Math.min(frame.w, frame.h);
  // Yüzde-uzayda step: px-step / frame-dim * 100. Step px = minDim * çarpan.
  const stepXPct = ((minDim * 0.42) / frame.w) * 100;
  const stepYPct = ((minDim * 0.16) / frame.h) * 100;
  const glyphs: WatermarkGlyph[] = [];
  // Negatif offset'ten başla ki köşeler boş kalmasın; +step buffer.
  for (let yPct = -stepYPct * 0.5; yPct <= 100 + stepYPct; yPct += stepYPct) {
    for (let xPct = -stepXPct * 0.5; xPct <= 100 + stepXPct; xPct += stepXPct) {
      glyphs.push({
        text: cfg.text,
        xPct: Math.round(xPct * 100) / 100,
        yPct: Math.round(yPct * 100) / 100,
        rotateDeg: -30,
      });
    }
  }
  return {
    active: true,
    glyphs,
    opacity,
    fontPctOfMin: 0.026,
    anchor: "middle",
  };
}

/** Phase 109 — Shared device capability model.
 *
 *  Kullanıcı kısıtı: "her mockup için ayrı if-else büyütme, her
 *  effect için ayrı parametre patlaması istemiyorum". Bunun yerine
 *  tek capability map: deviceShape → hangi effect/varyasyon
 *  desteklenir. Future SVG-specific feature'lar (phone color,
 *  button color, browser frame style, chrome/material tone) bu
 *  map'e FIELD eklenerek gelir — kod patlamaz, effect sistemi
 *  baştan buna göre tasarlanır.
 *
 *  Phase 109'da yalnız `supportsLensBlurTargeting` aktif (hepsi
 *  true — Lens Blur target/intensity her shape'te çalışır).
 *  `supportsColorVariant` / `supportsChromeTone` future readiness
 *  için tip+map'te var ama hepsi false (feature açılmadı —
 *  sözleşme #13 / §7 future direction; effect sistemi tasarımı
 *  bunları hesaba katar). */
export type StudioDeviceShapeKey =
  | "frame"
  | "sticker"
  | "bezel"
  | "bookmark"
  | "garment"
  | "garment-hooded";

export interface StudioDeviceCapability {
  /** Lens Blur target/intensity seçimi destekleniyor mu (Phase
   *  109 — hepsi true; plate vs all + soft/medium/strong). */
  supportsLensBlurTargeting: boolean;
  /** Future (sözleşme §13 / §7): SVG-specific renk varyantı
   *  (phone color, garment color). Phase 109'da hepsi false —
   *  feature açılmadı, effect sistemi tasarımı hesaba katar. */
  supportsColorVariant: boolean;
  /** Future: chrome/material tone (phone bezel metal/black,
   *  frame ahşap/siyah). Phase 109'da hepsi false. */
  supportsChromeTone: boolean;
}

const DEFAULT_DEVICE_CAPABILITY: StudioDeviceCapability = {
  supportsLensBlurTargeting: true,
  supportsColorVariant: false,
  supportsChromeTone: false,
};

/** Phase 109 — deviceShape → capability. Şu an tüm shape'ler
 *  aynı (Lens Blur targeting evrensel; color/chrome future).
 *  Future SVG-specific feature: ilgili shape'in entry'sine
 *  field set edilir (örn. bezel.supportsChromeTone=true) —
 *  if-else patlaması yok, tek map. */
const STUDIO_DEVICE_CAPABILITIES: Record<
  StudioDeviceShapeKey,
  StudioDeviceCapability
> = {
  frame: { ...DEFAULT_DEVICE_CAPABILITY },
  sticker: { ...DEFAULT_DEVICE_CAPABILITY },
  bezel: { ...DEFAULT_DEVICE_CAPABILITY },
  bookmark: { ...DEFAULT_DEVICE_CAPABILITY },
  garment: { ...DEFAULT_DEVICE_CAPABILITY },
  "garment-hooded": { ...DEFAULT_DEVICE_CAPABILITY },
};

export function studioDeviceCapability(
  shape: string | null | undefined,
): StudioDeviceCapability {
  if (shape && shape in STUDIO_DEVICE_CAPABILITIES) {
    return STUDIO_DEVICE_CAPABILITIES[shape as StudioDeviceShapeKey];
  }
  return DEFAULT_DEVICE_CAPABILITY;
}

/* Phase 112 — Client-safe deviceKind → shape resolver.
 *
 * `resolveDeviceShape` (frame-compositor.ts) server-side; client
 * modülü (Sidebar/Stage) onu import edemez (Phase 105 build
 * boundary kararı — compositor sharp/server-only). Phase 112:
 * capability model'i fiilen tüketmek için client tarafının da
 * deviceKind → shape eşlemesi gerek. Bu helper `resolveDeviceShape`
 * ile BİREBİR aynı mapping (bilinçli build-boundary tekrarı;
 * Phase 105 emsali — server compositor + client studio ayrı
 * bundle). Tek client-side kaynak: capability erişimi + (ileride)
 * shape-aware client logic buradan okur, ad-hoc switch
 * büyütülmez. */
export function deviceKindToShape(
  deviceKind: string | null | undefined,
): StudioDeviceShapeKey {
  switch (deviceKind) {
    case "wall_art":
    case "canvas":
    case "printable":
      return "frame";
    case "phone":
      return "bezel";
    case "bookmark":
      return "bookmark";
    case "hoodie":
      return "garment-hooded";
    case "tshirt":
    case "dtf":
      return "garment";
    case "sticker":
    case "clipart":
    default:
      return "sticker";
  }
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
):
  | { kind: "auto"; palette: readonly [string, string] | undefined }
  | { kind: "solid"; color: string }
  | { kind: "gradient"; from: string; to: string }
  | {
      kind: "glass";
      variant: GlassVariant;
      palette: readonly [string, string] | undefined;
      lensBlur: boolean;
    } {
  if (override.mode === "auto") {
    return { kind: "auto", palette: activePalette };
  }
  if (override.mode === "solid" && override.color) {
    return { kind: "solid", color: override.color };
  }
  if (override.mode === "gradient" && override.color && override.colorTo) {
    return { kind: "gradient", from: override.color, to: override.colorTo };
  }
  /* Phase 98 — Glass thumb visualization.
   *
   * Sözleşme #6 (Right rail behavior): rail thumb asset-aware
   * + scene-aware + count-aware. Glass mode'da thumb bg
   * underlying palette gradient (Phase 86 baseline) + üstüne
   * variant-tone overlay yansıtır. Lens Blur ayrıca palette
   * gradient'i SVG `<filter>` ile blur'lar — operator rail'e
   * bakınca stage'le aynı atmospheric hissi okur. */
  if (override.mode === "glass") {
    return {
      kind: "glass",
      variant: override.glassVariant ?? "light",
      palette: activePalette,
      // Phase 109 — rail thumb scene-aware: blur var/yok flag
      // (target/intensity rail thumb için anlamsız; sadece
      // "atmospheric mı" sinyali). normalizeLensBlur ile
      // backward-compat (boolean true / structured config).
      lensBlur: normalizeLensBlur(override.lensBlur).enabled,
    };
  }
  return { kind: "auto", palette: activePalette };
}
