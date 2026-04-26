import { describe, it, expect } from "vitest";
import {
  computeQualityScore,
  type QualityInput,
} from "@/features/variation-generation/services/quality-score.service";

const TARGET = { width: 4000, height: 4000 };

describe("computeQualityScore (Q1 objective only)", () => {
  it("returns 100 when DPI=300 and resolution≥target", () => {
    const r = computeQualityScore({
      dpi: 300,
      width: 4000,
      height: 4000,
      target: TARGET,
      targetDpi: 300,
    });
    expect(r.score).toBe(100);
    expect(r.reasons).toEqual([]);
  });

  it("DPI 200 → -25, listed in reasons", () => {
    const r = computeQualityScore({
      dpi: 200,
      width: 4000,
      height: 4000,
      target: TARGET,
      targetDpi: 300,
    });
    expect(r.score).toBe(75);
    expect(r.reasons).toContainEqual(
      expect.objectContaining({ type: "dpi-low", actual: 200, target: 300, delta: -25 }),
    );
  });

  it("DPI <200 → 0 from DPI input", () => {
    const r = computeQualityScore({
      dpi: 100,
      width: 4000,
      height: 4000,
      target: TARGET,
      targetDpi: 300,
    });
    expect(r.score).toBe(50);
  });

  it("DPI null → 0 from DPI + 'okunamadı' reason", () => {
    const r = computeQualityScore({
      dpi: null,
      width: 4000,
      height: 4000,
      target: TARGET,
      targetDpi: 300,
    });
    expect(r.score).toBe(50);
    expect(r.reasons).toContainEqual(expect.objectContaining({ type: "dpi-unreadable" }));
  });

  it("resolution 80%-99% → -25", () => {
    const r = computeQualityScore({
      dpi: 300,
      width: 3500,
      height: 3500,
      target: TARGET,
      targetDpi: 300,
    });
    expect(r.score).toBe(75);
    expect(r.reasons).toContainEqual(expect.objectContaining({ type: "resolution-low" }));
  });

  it("resolution <80% → 0 from resolution input", () => {
    const r = computeQualityScore({
      dpi: 300,
      width: 1000,
      height: 1000,
      target: TARGET,
      targetDpi: 300,
    });
    expect(r.score).toBe(50);
  });

  it("both inputs minimum → 0", () => {
    const r = computeQualityScore({
      dpi: null,
      width: 100,
      height: 100,
      target: TARGET,
      targetDpi: 300,
    });
    expect(r.score).toBe(0);
  });

  it("clamps to 0..100 range", () => {
    const r = computeQualityScore({
      dpi: 600,
      width: 8000,
      height: 8000,
      target: TARGET,
      targetDpi: 300,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("Q1 sözleşmesi: QualityInput type'ı isNegative/negativeReason alanı kabul etmiyor (compile-time guard)", () => {
    const _bad: QualityInput = {
      dpi: 300,
      width: 4000,
      height: 4000,
      target: TARGET,
      targetDpi: 300,
      // @ts-expect-error — Q1: review flags score'a girmez, type seviyesinde reddedilir
      isNegative: true,
    };
    // runtime davranış: extra field görmezden gelinir (TS yapısal)
    expect(_bad.dpi).toBe(300);
  });
});
