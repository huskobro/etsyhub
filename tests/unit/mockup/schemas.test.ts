// Phase 8 Task 3 — Runtime validation schemas for MockupStudio
//
// Test coverage:
// 1. LocalSharpConfigSchema — rect + perspective safeArea, blendMode, shadow, coverPriority
// 2. SafeAreaSchema discriminated union — type narrowing, corner count validation
// 3. ProviderConfigSchema discriminated union — providerId narrowing, unknown rejection
// 4. CreateJobBodySchema — body validation, templateIds cap, categoryId V1 literal
// 5. CoverSwapBodySchema — renderId validation

import { describe, it, expect } from "vitest";
import {
  LocalSharpConfigSchema,
  SafeAreaSchema,
  ProviderConfigSchema,
  CreateJobBodySchema,
  CoverSwapBodySchema,
} from "@/features/mockups/schemas";

describe("LocalSharpConfigSchema", () => {
  it("rejects missing baseAssetKey", () => {
    expect(() =>
      LocalSharpConfigSchema.parse({
        providerId: "local-sharp",
        baseDimensions: { w: 2400, h: 1600 },
        safeArea: { type: "rect", x: 0, y: 0, w: 1, h: 1 },
        recipe: { blendMode: "normal" },
        coverPriority: 50,
      })
    ).toThrow();
  });

  it("accepts valid rect safeArea config", () => {
    const config = {
      providerId: "local-sharp",
      baseAssetKey: "tpl-canvas-001/v1/base.png",
      baseDimensions: { w: 2400, h: 1600 },
      safeArea: { type: "rect", x: 0.3, y: 0.2, w: 0.4, h: 0.5 },
      recipe: { blendMode: "normal" },
      coverPriority: 50,
    };
    expect(LocalSharpConfigSchema.parse(config)).toEqual(config);
  });

  it("accepts valid perspective safeArea config", () => {
    const config = {
      providerId: "local-sharp",
      baseAssetKey: "tpl-canvas-003/v1/base.png",
      baseDimensions: { w: 2400, h: 1600 },
      safeArea: {
        type: "perspective",
        corners: [
          [0.2, 0.3],
          [0.6, 0.25],
          [0.62, 0.75],
          [0.18, 0.78],
        ],
      },
      recipe: {
        blendMode: "multiply",
        shadow: {
          offsetX: 8,
          offsetY: 12,
          blur: 16,
          opacity: 0.3,
        },
      },
      coverPriority: 50,
    };
    expect(LocalSharpConfigSchema.parse(config)).toEqual(config);
  });

  it("rejects safeArea coordinate > 1", () => {
    expect(() =>
      LocalSharpConfigSchema.parse({
        providerId: "local-sharp",
        baseAssetKey: "x.png",
        baseDimensions: { w: 100, h: 100 },
        safeArea: { type: "rect", x: 1.5, y: 0, w: 0.5, h: 0.5 },
        recipe: { blendMode: "normal" },
        coverPriority: 50,
      })
    ).toThrow();
  });

  it("rejects unknown blendMode", () => {
    expect(() =>
      LocalSharpConfigSchema.parse({
        providerId: "local-sharp",
        baseAssetKey: "x.png",
        baseDimensions: { w: 100, h: 100 },
        safeArea: { type: "rect", x: 0, y: 0, w: 1, h: 1 },
        recipe: { blendMode: "overlay" as any },
        coverPriority: 50,
      })
    ).toThrow();
  });

  it("rejects shadow.opacity > 1", () => {
    expect(() =>
      LocalSharpConfigSchema.parse({
        providerId: "local-sharp",
        baseAssetKey: "x.png",
        baseDimensions: { w: 100, h: 100 },
        safeArea: { type: "rect", x: 0, y: 0, w: 1, h: 1 },
        recipe: {
          blendMode: "normal",
          shadow: { offsetX: 0, offsetY: 0, blur: 0, opacity: 1.5 },
        },
        coverPriority: 50,
      })
    ).toThrow();
  });

  it("rejects coverPriority > 100", () => {
    expect(() =>
      LocalSharpConfigSchema.parse({
        providerId: "local-sharp",
        baseAssetKey: "x.png",
        baseDimensions: { w: 100, h: 100 },
        safeArea: { type: "rect", x: 0, y: 0, w: 1, h: 1 },
        recipe: { blendMode: "normal" },
        coverPriority: 150,
      })
    ).toThrow();
  });

  it("rejects coverPriority < 0", () => {
    expect(() =>
      LocalSharpConfigSchema.parse({
        providerId: "local-sharp",
        baseAssetKey: "x.png",
        baseDimensions: { w: 100, h: 100 },
        safeArea: { type: "rect", x: 0, y: 0, w: 1, h: 1 },
        recipe: { blendMode: "normal" },
        coverPriority: -1,
      })
    ).toThrow();
  });
});

describe("SafeAreaSchema discriminated union", () => {
  it("rejects unknown type", () => {
    expect(() =>
      SafeAreaSchema.parse({
        type: "polygon",
        corners: [],
      })
    ).toThrow();
  });

  it("rejects perspective with wrong corner count", () => {
    expect(() =>
      SafeAreaSchema.parse({
        type: "perspective",
        corners: [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
      })
    ).toThrow();
  });

  it("parses valid rect", () => {
    const result = SafeAreaSchema.parse({
      type: "rect",
      x: 0.1,
      y: 0.2,
      w: 0.8,
      h: 0.6,
    });
    expect(result.type).toBe("rect");
  });

  it("parses valid perspective", () => {
    const result = SafeAreaSchema.parse({
      type: "perspective",
      corners: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    });
    expect(result.type).toBe("perspective");
  });
});

describe("ProviderConfigSchema discriminated union", () => {
  it("narrows by providerId — local-sharp", () => {
    const result = ProviderConfigSchema.parse({
      providerId: "local-sharp",
      baseAssetKey: "x.png",
      baseDimensions: { w: 100, h: 100 },
      safeArea: { type: "rect", x: 0, y: 0, w: 1, h: 1 },
      recipe: { blendMode: "normal" },
      coverPriority: 50,
    });
    expect(result.providerId).toBe("local-sharp");
  });

  it("narrows by providerId — dynamic-mockups", () => {
    const result = ProviderConfigSchema.parse({
      providerId: "dynamic-mockups",
      externalTemplateId: "dm-template-xyz",
    });
    expect(result.providerId).toBe("dynamic-mockups");
  });

  it("rejects unknown providerId", () => {
    expect(() =>
      ProviderConfigSchema.parse({
        providerId: "imgix",
      })
    ).toThrow();
  });
});

describe("CreateJobBodySchema", () => {
  it("accepts valid body", () => {
    const body = {
      setId: "set-123",
      categoryId: "canvas",
      templateIds: ["tpl-a", "tpl-b"],
    };
    expect(CreateJobBodySchema.parse(body)).toEqual(body);
  });

  it("rejects empty templateIds", () => {
    expect(() =>
      CreateJobBodySchema.parse({
        setId: "set-123",
        categoryId: "canvas",
        templateIds: [],
      })
    ).toThrow();
  });

  it("rejects > 8 templateIds (cap)", () => {
    expect(() =>
      CreateJobBodySchema.parse({
        setId: "set-123",
        categoryId: "canvas",
        templateIds: Array.from({ length: 9 }, (_, i) => `tpl-${i}`),
      })
    ).toThrow();
  });

  it("rejects unknown categoryId (V2 enum sınırı: 8 değer dışı)", () => {
    expect(() =>
      CreateJobBodySchema.parse({
        setId: "set-123",
        categoryId: "mug",
        templateIds: ["tpl-a"],
      })
    ).toThrow();
  });

  it("V2 multi-category: 8 ProductType key kabul edilir (canvas + wall_art + printable + clipart + sticker + tshirt + hoodie + dtf)", () => {
    const validCategories = [
      "canvas", "wall_art", "printable", "clipart",
      "sticker", "tshirt", "hoodie", "dtf",
    ];
    for (const categoryId of validCategories) {
      expect(() =>
        CreateJobBodySchema.parse({
          setId: "set-123",
          categoryId,
          templateIds: ["tpl-a"],
        })
      ).not.toThrow();
    }
  });

  it("rejects missing setId", () => {
    expect(() =>
      CreateJobBodySchema.parse({
        categoryId: "canvas",
        templateIds: ["tpl-a"],
      })
    ).toThrow();
  });
});

describe("CoverSwapBodySchema", () => {
  it("accepts valid renderId", () => {
    expect(
      CoverSwapBodySchema.parse({
        renderId: "render-123",
      })
    ).toEqual({ renderId: "render-123" });
  });

  it("rejects empty renderId", () => {
    expect(() =>
      CoverSwapBodySchema.parse({
        renderId: "",
      })
    ).toThrow();
  });

  it("rejects missing renderId", () => {
    expect(() => CoverSwapBodySchema.parse({})).toThrow();
  });
});
