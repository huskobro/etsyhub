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
