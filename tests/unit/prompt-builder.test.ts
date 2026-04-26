import { describe, it, expect } from "vitest";
import { buildImagePrompt } from "@/features/variation-generation/prompt-builder";

describe("buildImagePrompt", () => {
  it("includes system prompt + Avoid: <NEGATIVE_LIBRARY>", () => {
    const out = buildImagePrompt({
      systemPrompt: "wall art, pastel",
      capability: "image-to-image",
    });
    expect(out).toContain("wall art, pastel");
    expect(out).toContain("Avoid:");
    expect(out).toContain("Disney");
    expect(out).toContain("Marvel");
    expect(out).toContain("Nike");
    expect(out).toContain("celebrity names");
    expect(out).toContain("watermark");
    expect(out).toContain("signature");
    expect(out).toContain("logo");
  });

  it("appends brief as 'Style note from user' (R18 — APPEND, not replace)", () => {
    const out = buildImagePrompt({
      systemPrompt: "wall art base",
      brief: "soft watercolor",
      capability: "image-to-image",
    });
    // System korunur (replace edilmez)
    expect(out).toContain("wall art base");
    // Brief append edilir, "Style note from user:" prefiks ile
    expect(out).toContain("Style note from user: soft watercolor");
    // Avoid satırı hala mevcut
    expect(out).toContain("Avoid:");
  });

  it("omits brief section when brief whitespace-only", () => {
    const out = buildImagePrompt({
      systemPrompt: "base",
      brief: "   ",
      capability: "image-to-image",
    });
    expect(out).not.toContain("Style note from user");
  });

  it("Avoid: line always present even without brief", () => {
    const out = buildImagePrompt({
      systemPrompt: "base prompt",
      capability: "image-to-image",
    });
    // Avoid satırı her zaman var; NEGATIVE_LIBRARY virgülle join edilmiş
    expect(out).toMatch(/Avoid: .*Disney.*watermark.*logo/s);
  });

  it("throws when systemPrompt is empty string (S2 — fail-fast)", () => {
    // Plan'daki .filter(Boolean) davranışı bilinçli olarak override edildi:
    // empty systemPrompt sessizce drop edilmez; config error olarak fail-fast.
    expect(() =>
      buildImagePrompt({ systemPrompt: "", capability: "image-to-image" }),
    ).toThrow(/systemPrompt empty/i);
  });

  it("throws when systemPrompt is whitespace only (S2 — fail-fast)", () => {
    expect(() =>
      buildImagePrompt({
        systemPrompt: "   \t\n  ",
        capability: "image-to-image",
      }),
    ).toThrow(/systemPrompt empty/i);
  });

  it("capability param does not affect output (S1 — Task 10/12 future use)", () => {
    // Regression guard: capability imzanın parçası ama şu an output'u
    // ETKİLEMİYOR. Task 10/12'de (üretim akışı + capability mismatch) bu
    // davranış kasıtlı olarak değişecek. O zamana kadar i2i ve t2i identical
    // string üretmeli — bu test sessiz drift'i yakalar.
    const i2i = buildImagePrompt({
      systemPrompt: "wall art",
      capability: "image-to-image",
    });
    const t2i = buildImagePrompt({
      systemPrompt: "wall art",
      capability: "text-to-image",
    });
    expect(i2i).toBe(t2i);
  });
});
