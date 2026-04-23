import { describe, expect, it } from "vitest";
import { normalizeForSimilarity, normalizeForProductType } from "@/features/trend-stories/services/normalize";

describe("normalizeForSimilarity", () => {
  it("lowercase + punctuation temizliği + stop-word atar", () => {
    expect(normalizeForSimilarity("Boho Wall Art for Your Home!!!"))
      .toEqual(["boho","wall","art","home"]);
  });
  it("tek boşluğa indirger, token order korur", () => {
    expect(normalizeForSimilarity("  Wall   Art   Boho  "))
      .toEqual(["wall","art","boho"]);
  });
  it("format token'larını (svg/png/jpg) atar", () => {
    expect(normalizeForSimilarity("Boho PNG Pack SVG"))
      .toEqual(["boho"]);
  });
});

describe("normalizeForProductType", () => {
  it("stop-word'leri ATMAZ — productType derive için ham sinyal korunur", () => {
    expect(normalizeForProductType("Wall Art for Your Home"))
      .toEqual(["wall","art","for","your","home"]);
  });
});
