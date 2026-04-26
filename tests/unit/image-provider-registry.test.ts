import { describe, it, expect } from "vitest";
import { getImageProvider, listImageProviders } from "@/providers/image/registry";

describe("image provider registry", () => {
  it("returns kie-gpt-image-1.5 with image-to-image capability", () => {
    const p = getImageProvider("kie-gpt-image-1.5");
    expect(p.id).toBe("kie-gpt-image-1.5");
    expect(p.capabilities).toContain("image-to-image");
  });

  it("returns kie-z-image as shell with text-to-image capability", () => {
    const p = getImageProvider("kie-z-image");
    expect(p.id).toBe("kie-z-image");
    expect(p.capabilities).toContain("text-to-image");
  });

  it("listImageProviders returns both registered providers", () => {
    const all = listImageProviders();
    expect(all.map((p) => p.id).sort()).toEqual([
      "kie-gpt-image-1.5",
      "kie-z-image",
    ]);
  });

  it("throws on unknown provider id", () => {
    expect(() => getImageProvider("unknown")).toThrow(/unknown image provider/i);
  });

  it("listImageProviders surfaces capability info per provider", () => {
    const all = listImageProviders();
    const map = new Map(all.map((p) => [p.id, p.capabilities] as const));
    expect(map.get("kie-gpt-image-1.5")).toEqual(["image-to-image"]);
    expect(map.get("kie-z-image")).toEqual(["text-to-image"]);
  });
});
