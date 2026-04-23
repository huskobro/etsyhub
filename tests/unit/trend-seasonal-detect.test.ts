import { describe, expect, it } from "vitest";
import { detectSeasonalTag } from "@/features/trend-stories/services/seasonal-detect";

describe("detectSeasonalTag", () => {
  it("christmas label + aralık içi tarih → 'christmas'", () => {
    expect(detectSeasonalTag("Christmas Wall Art", new Date("2026-12-10")))
      .toBe("christmas");
  });
  it("christmas label ama temmuz → null", () => {
    expect(detectSeasonalTag("Christmas Wall Art", new Date("2026-07-10")))
      .toBeNull();
  });
  it("keyword yoksa → null", () => {
    expect(detectSeasonalTag("Boho Print", new Date("2026-12-10")))
      .toBeNull();
  });
  it("yıl sonu sarma (10-15 → 12-31) doğru çalışır", () => {
    expect(detectSeasonalTag("xmas gift", new Date("2026-10-20"))).toBe("christmas");
  });
});
