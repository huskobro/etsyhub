import { describe, it, expect } from "vitest";
import {
  BG_VIGNETTE_ALPHA,
  BG_GRAIN_OPACITY,
  resolvePlateEffects,
  resolveLensBlurLayout,
  type BgEffectConfig,
  type SceneOverride,
} from "@/features/mockups/studio/frame-scene";

describe("bgEffect type + intensity maps", () => {
  it("vignette alpha map: soft<medium<strong, strong<=0.42 (subject korunur)", () => {
    expect(BG_VIGNETTE_ALPHA.soft).toBeLessThan(BG_VIGNETTE_ALPHA.medium);
    expect(BG_VIGNETTE_ALPHA.medium).toBeLessThan(BG_VIGNETTE_ALPHA.strong);
    expect(BG_VIGNETTE_ALPHA.strong).toBeLessThanOrEqual(0.42);
  });
  it("grain opacity map: soft<medium<strong, strong<=0.11 (mockup kirletmez)", () => {
    expect(BG_GRAIN_OPACITY.soft).toBeLessThan(BG_GRAIN_OPACITY.medium);
    expect(BG_GRAIN_OPACITY.medium).toBeLessThan(BG_GRAIN_OPACITY.strong);
    expect(BG_GRAIN_OPACITY.strong).toBeLessThanOrEqual(0.11);
  });
  it("SceneOverride.bgEffect opsiyonel (undefined geçerli)", () => {
    const s: SceneOverride = { mode: "auto" };
    expect(s.bgEffect).toBeUndefined();
    const s2: SceneOverride = {
      mode: "auto",
      bgEffect: { kind: "vignette", intensity: "medium" },
    };
    const cfg: BgEffectConfig = s2.bgEffect!;
    expect(cfg.kind).toBe("vignette");
  });
});

describe("resolvePlateEffects — bgEffect", () => {
  it("bgEffect undefined → vignetteAlpha 0, grainOpacity 0", () => {
    const r = resolvePlateEffects({ mode: "auto" });
    expect(r.vignetteAlpha).toBe(0);
    expect(r.grainOpacity).toBe(0);
  });
  it("vignette medium → vignetteAlpha set, grainOpacity 0", () => {
    const r = resolvePlateEffects({
      mode: "auto",
      bgEffect: { kind: "vignette", intensity: "medium" },
    });
    expect(r.vignetteAlpha).toBe(BG_VIGNETTE_ALPHA.medium);
    expect(r.grainOpacity).toBe(0);
  });
  it("grain strong → grainOpacity set, vignetteAlpha 0 (tek-seçim)", () => {
    const r = resolvePlateEffects({
      mode: "auto",
      bgEffect: { kind: "grain", intensity: "strong" },
    });
    expect(r.grainOpacity).toBe(BG_GRAIN_OPACITY.strong);
    expect(r.vignetteAlpha).toBe(0);
  });
  it("bgEffect glass + lensBlur ile bağımsız kombinlenir", () => {
    const r = resolvePlateEffects({
      mode: "glass",
      glassVariant: "dark",
      lensBlur: { enabled: true, intensity: "soft" },
      bgEffect: { kind: "vignette", intensity: "soft" },
    });
    expect(r.glassOverlay).toBeDefined();
    expect(r.filterBlurPx).toBeGreaterThan(0);
    expect(r.vignetteAlpha).toBe(BG_VIGNETTE_ALPHA.soft);
  });
  it("grain opacity resolver çıktısı = map değeri (export alpha = grainOpacity×255 invariant kaynağı)", () => {
    const r = resolvePlateEffects({
      mode: "auto",
      bgEffect: { kind: "grain", intensity: "strong" },
    });
    // Export grain composite bu değeri dest-in mask fill-opacity
    // olarak kullanır → plate-içi alpha = grainOpacity*255.
    // ensureAlpha NO-OP bug'ı (Phase 136 4/8 fix): grainPlate zaten
    // channels:4 → alpha kanalı VAR → Sharp ensureAlpha hiçbir şey
    // yapmaz, grain ~%100 opak basardı (§11.0 ihlali). Fix: alpha
    // dest-in mask rect fill-opacity'sine taşındı. Bu değer 0-1
    // arası kalmalı, 1'e (opak) zorlanmamalı.
    expect(r.grainOpacity).toBe(BG_GRAIN_OPACITY.strong);
    expect(r.grainOpacity).toBeGreaterThan(0);
    expect(r.grainOpacity).toBeLessThan(1);
  });
});


/* Phase 139 — Lens Blur TEK-DAVRANIŞLI (target kaldırıldı).
 *
 * Phase 138'de `target="plate"` AYRI bir content-blur wrapper
 * üretiyordu; o wrapper'ın blur'u plate-bg gradyeninin amber
 * ucunu plate kenarına yayıp (plate overflow:hidden sert kesim)
 * KENARDA TURUNCU BANT yaratıyordu. `target="all"` (plate'in
 * KENDİSİNE filter) bu sorunu yaşamıyordu (kenar dahil tek-pass
 * blur → koyu stage zemini ile organik harman). "Sadece plate
 * blur, item'lar NET" davranışı mevcut render zincirinde
 * (item'lar plate render bağlamı içinde; izolasyon zoom/framing
 * zincirini riske atar) temiz değil.
 *
 * Karar (kullanıcı): problemli `target` ayrımını TAMAMEN KALDIR.
 * Lens Blur tek-davranışlı = mevcut iyi çalışan "all" yolu
 * (plate'in kendisine `filter:blur`). `LensBlurConfig` artık
 * `{ enabled, intensity }` (target YOK). `resolveLensBlurLayout`
 * enabled ise daima `{ plateFilter: "blur(Npx)" }`, disabled ise
 * `{ plateFilter: null }`. `contentFilterBlur` SİLİNDİ. Gerçek
 * `plate-only` ileride ayrı iş — temiz mimari (item-izolasyonu
 * zoom/framing'i bozmadan) ile yeniden tasarlanır. */
describe("resolveLensBlurLayout — tek-davranışlı (target yok, daima plate-filter)", () => {
  it("disabled → plateFilter null (no-op)", () => {
    const r = resolveLensBlurLayout(resolvePlateEffects({ mode: "auto" }));
    expect(r.plateFilter).toBeNull();
  });

  it("enabled → plateFilter set (plate'in kendisine, tek-pass — mevcut working 'all' yolu)", () => {
    const eff = resolvePlateEffects({
      mode: "auto",
      lensBlur: { enabled: true, intensity: "medium" },
    });
    const r = resolveLensBlurLayout(eff);
    expect(r.plateFilter).toBe(`blur(${eff.filterBlurPx}px)`);
  });

  it("plateBgRaw'dan BAĞIMSIZ çalışır (auto+palette-yok'ta da blur)", () => {
    const eff = resolvePlateEffects({
      mode: "auto",
      lensBlur: { enabled: true, intensity: "soft" },
    });
    const r = resolveLensBlurLayout(eff);
    expect(r.plateFilter).toBe(`blur(${eff.filterBlurPx}px)`);
  });

  it("intensity → filterBlurPx yansır (soft/medium/strong farklı px)", () => {
    const soft = resolveLensBlurLayout(
      resolvePlateEffects({
        mode: "auto",
        lensBlur: { enabled: true, intensity: "soft" },
      }),
    );
    const strong = resolveLensBlurLayout(
      resolvePlateEffects({
        mode: "auto",
        lensBlur: { enabled: true, intensity: "strong" },
      }),
    );
    expect(soft.plateFilter).not.toBe(strong.plateFilter);
  });

  it("legacy boolean true → enabled (backward-compat; target normalize KALDIRILDI)", () => {
    const eff = resolvePlateEffects({ mode: "auto", lensBlur: true });
    const r = resolveLensBlurLayout(eff);
    expect(r.plateFilter).toBe(`blur(${eff.filterBlurPx}px)`);
  });
});
