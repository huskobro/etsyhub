// R11 — Recipe.config discriminator testleri (recipe-chain vs style-preset).
//
// Pure unit: isRunnableChain UI logic'i index-view'da derive ediliyor.
// Recipe service iç helper'larını test ediyoruz (DB yok).

import { describe, it, expect } from "vitest";

// Internal discriminator helper (R8'den beri RecipeChainConfig pattern).
function isRecipeChainConfig(c: unknown): boolean {
  if (!c || typeof c !== "object") return false;
  return (c as Record<string, unknown>).kind === "recipe-chain";
}

function isStylePresetConfig(c: unknown): boolean {
  if (!c || typeof c !== "object") return false;
  return (c as Record<string, unknown>).kind === "style-preset";
}

describe("Recipe.config discriminator", () => {
  it("detects recipe-chain config", () => {
    const config = {
      kind: "recipe-chain",
      links: { promptTemplateId: "tpl_abc" },
      settings: { variationCount: 8 },
    };
    expect(isRecipeChainConfig(config)).toBe(true);
    expect(isStylePresetConfig(config)).toBe(false);
  });

  it("detects style-preset config", () => {
    const config = {
      kind: "style-preset",
      aspect: "square",
      similarity: "medium",
      palette: "neutral",
      weight: "subtle",
    };
    expect(isStylePresetConfig(config)).toBe(true);
    expect(isRecipeChainConfig(config)).toBe(false);
  });

  it("rejects null / undefined / primitives", () => {
    expect(isRecipeChainConfig(null)).toBe(false);
    expect(isRecipeChainConfig(undefined)).toBe(false);
    expect(isRecipeChainConfig("recipe-chain")).toBe(false);
    expect(isRecipeChainConfig(42)).toBe(false);
  });

  it("rejects legacy Recipe rows (no kind)", () => {
    const legacyConfig = { someKey: "value" };
    expect(isRecipeChainConfig(legacyConfig)).toBe(false);
    expect(isStylePresetConfig(legacyConfig)).toBe(false);
  });
});

describe("Recipe key namespace", () => {
  function isStyleKey(key: string): boolean {
    return key.startsWith("style:");
  }
  function isChainKey(key: string): boolean {
    return key.startsWith("recipe:");
  }

  it("style:<slug> namespace", () => {
    expect(isStyleKey("style:square-neutral")).toBe(true);
    expect(isStyleKey("recipe:wall-art")).toBe(false);
  });

  it("recipe:<slug> namespace", () => {
    expect(isChainKey("recipe:r9-smoke")).toBe(true);
    expect(isChainKey("style:portrait")).toBe(false);
  });

  it("legacy keys (no prefix) belong to neither", () => {
    expect(isStyleKey("legacy-recipe")).toBe(false);
    expect(isChainKey("legacy-recipe")).toBe(false);
  });
});
