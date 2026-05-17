import { describe, it, expect } from "vitest";
import {
  WM_OPACITY,
  WM_DEFAULT,
  WM_TEXT_MAX,
  normalizeWatermark,
  type WatermarkConfig,
} from "@/features/mockups/studio/frame-scene";

describe("normalizeWatermark", () => {
  it("undefined → WM_DEFAULT clone (disabled, empty text)", () => {
    const r = normalizeWatermark(undefined);
    expect(r).toEqual(WM_DEFAULT);
    expect(r).not.toBe(WM_DEFAULT); // fresh object, not shared ref
  });

  it("null → WM_DEFAULT clone", () => {
    expect(normalizeWatermark(null)).toEqual(WM_DEFAULT);
  });

  it("trims and clamps text to WM_TEXT_MAX", () => {
    const long = "x".repeat(WM_TEXT_MAX + 20);
    const r = normalizeWatermark({
      enabled: true,
      text: `  ${long}  `,
      opacity: "medium",
      placement: "br",
    });
    expect(r.text.length).toBe(WM_TEXT_MAX);
  });

  it("replaces newlines/carriage returns with single space (single-line guarantee)", () => {
    const r = normalizeWatermark({
      enabled: true,
      text: "line1\nline2\r\nline3",
      opacity: "soft",
      placement: "center",
    });
    expect(r.text).toBe("line1 line2 line3");
  });

  it("unknown opacity/placement fall back to WM_DEFAULT values", () => {
    const r = normalizeWatermark({
      enabled: true,
      text: "Shop",
      // @ts-expect-error intentional bad input
      opacity: "ultra",
      // @ts-expect-error intentional bad input
      placement: "spiral",
    });
    expect(r.opacity).toBe(WM_DEFAULT.opacity);
    expect(r.placement).toBe(WM_DEFAULT.placement);
  });

  it("valid config passes through (enabled, text, opacity, placement preserved)", () => {
    const cfg: WatermarkConfig = {
      enabled: true,
      text: "© Kivasy",
      opacity: "strong",
      placement: "tile",
    };
    expect(normalizeWatermark(cfg)).toEqual(cfg);
  });

  it("WM_OPACITY maps soft<medium<strong", () => {
    expect(WM_OPACITY.soft).toBeLessThan(WM_OPACITY.medium);
    expect(WM_OPACITY.medium).toBeLessThan(WM_OPACITY.strong);
  });
});
