import { describe, it, expect } from "vitest";
import {
  BG_VIGNETTE_ALPHA,
  BG_GRAIN_OPACITY,
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

import { resolvePlateEffects } from "@/features/mockups/studio/frame-scene";

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
      lensBlur: { enabled: true, target: "plate", intensity: "soft" },
      bgEffect: { kind: "vignette", intensity: "soft" },
    });
    expect(r.glassOverlay).toBeDefined();
    expect(r.filterBlurPx).toBeGreaterThan(0);
    expect(r.vignetteAlpha).toBe(BG_VIGNETTE_ALPHA.soft);
  });
});
