import { describe, expect, it } from "vitest";
import { deriveProductTypeKey } from "@/features/trend-stories/services/product-type-derive";

describe("deriveProductTypeKey", () => {
  it("tek güçlü keyword eşleşmesi döner", () => {
    expect(deriveProductTypeKey(["Boho Canvas Print"]))
      .toEqual({ key: "canvas", source: "keyword_match", confidence: expect.any(Number) });
  });
  it("multi-word keyword (digital download) eşleşir", () => {
    const r = deriveProductTypeKey(["Minimalist Printable Wall Art — Instant Download"]);
    expect(r?.key).toBe("printable");
  });
  it("hiç eşleşme yoksa null", () => {
    expect(deriveProductTypeKey(["Random Thing"]))
      .toBeNull();
  });
  it("çoğunluk oyu — 3 listing 2'si canvas 1'i sticker → canvas", () => {
    const r = deriveProductTypeKey([
      "Boho Canvas Art",
      "Minimalist Canvas Print",
      "Cute Sticker",
    ]);
    expect(r?.key).toBe("canvas");
    expect(r?.source).toBe("member_majority");
  });
  it("iki üye aynı kategoriye gidiyorsa source = keyword_match (ayrışma yok)", () => {
    const r = deriveProductTypeKey(["Boho Canvas", "Minimalist Canvas"]);
    expect(r?.key).toBe("canvas");
    expect(r?.source).toBe("keyword_match");
  });
  it("boş string güvenli: null döner", () => {
    expect(deriveProductTypeKey([""])).toBeNull();
  });
});
