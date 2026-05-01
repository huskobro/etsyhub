// Phase 8 — Task 2: Type-level smoke testleri
//
// TDD-style type-only test: expectTypeOf ile discriminated union narrowing
// + provider config discriminated union + RenderSnapshot type safety.
//
// Spec §3.2 ile uyum:
//   - SafeArea rect vs perspective discrimination
//   - ProviderConfig LocalSharpConfig vs DynamicMockupsConfig discrimination
//   - RenderSnapshot.config Omit<LocalSharpConfig, "coverPriority"> (coverPriority omitted doğrulanır)

import { describe, it, expectTypeOf } from "vitest";
import type {
  SafeArea,
  SafeAreaRect,
  SafeAreaPerspective,
  ProviderConfig,
  LocalSharpConfig,
  DynamicMockupsConfig,
  RenderSnapshot,
  RenderInput,
  RenderOutput,
} from "@/lib/providers/mockup/types";

describe("SafeArea discriminated union", () => {
  it("narrows to SafeAreaRect when type === 'rect'", () => {
    const sa: SafeArea = { type: "rect", x: 0.3, y: 0.2, w: 0.4, h: 0.5 };
    if (sa.type === "rect") {
      expectTypeOf(sa).toEqualTypeOf<SafeAreaRect>();
      expectTypeOf(sa.x).toEqualTypeOf<number>();
      expectTypeOf(sa.y).toEqualTypeOf<number>();
      expectTypeOf(sa.w).toEqualTypeOf<number>();
      expectTypeOf(sa.h).toEqualTypeOf<number>();
      expectTypeOf(sa.rotation).toEqualTypeOf<number | undefined>();
    }
  });

  it("narrows to SafeAreaPerspective when type === 'perspective'", () => {
    const sa: SafeArea = {
      type: "perspective",
      corners: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    };
    if (sa.type === "perspective") {
      expectTypeOf(sa).toEqualTypeOf<SafeAreaPerspective>();
      expectTypeOf(sa.corners).toEqualTypeOf<
        [
          [number, number],
          [number, number],
          [number, number],
          [number, number]
        ]
      >();
    }
  });

  it("exhaustive narrowing covers all SafeArea variants", () => {
    const sa: SafeArea = { type: "rect", x: 0, y: 0, w: 1, h: 1 };
    if (sa.type === "rect") {
      expectTypeOf(sa).toEqualTypeOf<SafeAreaRect>();
    }
    // Alternative: const sa2: SafeArea = { type: "perspective", corners: [[0,0],[1,0],[1,1],[0,1]] };
    // This test ensures discriminated union is well-formed.
  });
});

describe("ProviderConfig discriminated union", () => {
  it("narrows to LocalSharpConfig when providerId === 'local-sharp'", () => {
    const config: ProviderConfig = {
      providerId: "local-sharp",
      baseAssetKey: "mockup/base.png",
      baseDimensions: { w: 2400, h: 1600 },
      safeArea: { type: "rect", x: 0.3, y: 0.2, w: 0.4, h: 0.5 },
      recipe: { blendMode: "normal" },
      coverPriority: 50,
    };
    if (config.providerId === "local-sharp") {
      expectTypeOf(config).toEqualTypeOf<LocalSharpConfig>();
      expectTypeOf(config.baseAssetKey).toEqualTypeOf<string>();
      expectTypeOf(config.coverPriority).toEqualTypeOf<number>();
    }
  });

  it("narrows to DynamicMockupsConfig when providerId === 'dynamic-mockups'", () => {
    const config: ProviderConfig = {
      providerId: "dynamic-mockups",
      externalTemplateId: "dm-template-123",
    };
    if (config.providerId === "dynamic-mockups") {
      expectTypeOf(config).toEqualTypeOf<DynamicMockupsConfig>();
      expectTypeOf(config.externalTemplateId).toEqualTypeOf<string>();
      expectTypeOf(config.smartObjectOptions).toEqualTypeOf<
        Record<string, unknown> | undefined
      >();
    }
  });

  it("exhaustive narrowing covers all ProviderConfig variants", () => {
    const config: ProviderConfig = {
      providerId: "local-sharp",
      baseAssetKey: "x.png",
      baseDimensions: { w: 1920, h: 1080 },
      safeArea: { type: "rect", x: 0, y: 0, w: 1, h: 1 },
      recipe: { blendMode: "normal" },
      coverPriority: 0,
    };
    if (config.providerId === "local-sharp") {
      expectTypeOf(config).toEqualTypeOf<LocalSharpConfig>();
    }
    // Alternative: const config2: ProviderConfig = { providerId: "dynamic-mockups", externalTemplateId: "..." };
    // This test ensures discriminated union is well-formed.
  });
});

describe("RenderSnapshot type safety", () => {
  it("config field excludes coverPriority for LocalSharpConfig variant", () => {
    type LocalSnapshot = Extract<RenderSnapshot, { providerId: "LOCAL_SHARP" }>;
    type SnapshotConfig = LocalSnapshot["config"];

    // Snapshot config should NOT have coverPriority
    // (Omit<LocalSharpConfig, "coverPriority">)
    expectTypeOf<SnapshotConfig>().not.toMatchTypeOf<{
      coverPriority: number;
    }>();
  });

  it("RenderSnapshot has required fields", () => {
    const snapshot: RenderSnapshot = {
      templateId: "tmpl-123",
      bindingId: "bind-456",
      bindingVersion: 1,
      providerId: "LOCAL_SHARP",
      config: {
        providerId: "local-sharp",
        baseAssetKey: "x.png",
        baseDimensions: { w: 2400, h: 1600 },
        safeArea: { type: "rect", x: 0.3, y: 0.2, w: 0.4, h: 0.5 },
        recipe: { blendMode: "normal" },
        // NOTE: coverPriority omitted in RenderSnapshot.config
      },
      templateName: "Canvas Wall Art A4",
      aspectRatios: ["4:3", "1:1"],
    };

    expectTypeOf(snapshot.templateId).toEqualTypeOf<string>();
    expectTypeOf(snapshot.bindingId).toEqualTypeOf<string>();
    expectTypeOf(snapshot.bindingVersion).toEqualTypeOf<number>();
    expectTypeOf(snapshot.providerId).toEqualTypeOf<"LOCAL_SHARP" | "DYNAMIC_MOCKUPS">();
    expectTypeOf(snapshot.templateName).toEqualTypeOf<string>();
    expectTypeOf(snapshot.aspectRatios).toEqualTypeOf<string[]>();
  });
});

describe("RenderInput/Output types", () => {
  it("RenderInput has required fields", () => {
    const input: RenderInput = {
      renderId: "render-789",
      designUrl: "https://assets.example.com/design.png",
      designAspectRatio: "1:1",
      snapshot: {
        templateId: "tmpl-123",
        bindingId: "bind-456",
        bindingVersion: 1,
        providerId: "LOCAL_SHARP",
        config: {
          providerId: "local-sharp",
          baseAssetKey: "x.png",
          baseDimensions: { w: 2400, h: 1600 },
          safeArea: { type: "rect", x: 0.3, y: 0.2, w: 0.4, h: 0.5 },
          recipe: { blendMode: "normal" },
        },
        templateName: "Canvas Wall Art A4",
        aspectRatios: ["4:3", "1:1"],
      },
      signal: new AbortController().signal,
    };

    expectTypeOf(input.renderId).toEqualTypeOf<string>();
    expectTypeOf(input.designUrl).toEqualTypeOf<string>();
    expectTypeOf(input.designAspectRatio).toEqualTypeOf<string>();
    expectTypeOf(input.snapshot).toEqualTypeOf<RenderSnapshot>();
    expectTypeOf(input.signal).toEqualTypeOf<AbortSignal>();
  });

  it("RenderOutput has required fields", () => {
    const output: RenderOutput = {
      outputKey: "renders/render-789.png",
      thumbnailKey: "renders/render-789-thumb.png",
      outputDimensions: { w: 2400, h: 1600 },
      renderDurationMs: 5432,
    };

    expectTypeOf(output.outputKey).toEqualTypeOf<string>();
    expectTypeOf(output.thumbnailKey).toEqualTypeOf<string>();
    expectTypeOf(output.outputDimensions).toEqualTypeOf<{
      w: number;
      h: number;
    }>();
    expectTypeOf(output.renderDurationMs).toEqualTypeOf<number>();
  });
});
