// Phase 8 Task 4 — resolveBinding priority chain + provider interface compliance.
//
// Spec §2.1 deterministik provider seçim:
//   - LOCAL_SHARP > DYNAMIC_MOCKUPS (V1 localhost-first disiplini)
//   - Inactive (DRAFT/ARCHIVED) binding'ler chain dışında
//   - Hiç ACTIVE binding yoksa null (TEMPLATE_INVALID sinyali)
//
// Phase 6 review/registry.ts paterni emsali: tek ortak interface +
// concrete adapter dosyaları + registry seçim fonksiyonu.

import { describe, it, expect } from "vitest";
import {
  resolveBinding,
  getProvider,
  localSharpProvider,
  dynamicMockupsProvider,
  PROVIDER_PRIORITY,
} from "@/providers/mockup";
import type { MockupTemplate, MockupTemplateBinding } from "@prisma/client";

// Helper — minimal MockupTemplate fixture (Prisma row shape).
function makeTemplate(
  bindings: Partial<MockupTemplateBinding>[]
): MockupTemplate & { bindings: MockupTemplateBinding[] } {
  return {
    id: "tpl-1",
    categoryId: "canvas",
    name: "Test Template",
    status: "ACTIVE",
    thumbKey: "thumb.png",
    aspectRatios: ["2:3"],
    tags: ["modern"],
    estimatedRenderMs: 2000,
    userId: null, // Phase 64 — global catalog (fixture default)
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    bindings: bindings.map((b, i) => ({
      id: `binding-${i}`,
      templateId: "tpl-1",
      providerId: "LOCAL_SHARP",
      version: 1,
      status: "ACTIVE",
      config: {},
      estimatedRenderMs: 2000,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
      ...b,
    })),
  };
}

describe("resolveBinding", () => {
  it("returns LOCAL_SHARP binding when active", () => {
    const tpl = makeTemplate([{ providerId: "LOCAL_SHARP", status: "ACTIVE" }]);
    const result = resolveBinding(tpl);
    expect(result?.providerId).toBe("LOCAL_SHARP");
  });

  it("falls back to DYNAMIC_MOCKUPS when LOCAL_SHARP not active", () => {
    const tpl = makeTemplate([
      { id: "b-1", providerId: "LOCAL_SHARP", status: "ARCHIVED" },
      { id: "b-2", providerId: "DYNAMIC_MOCKUPS", status: "ACTIVE" },
    ]);
    const result = resolveBinding(tpl);
    expect(result?.providerId).toBe("DYNAMIC_MOCKUPS");
  });

  it("returns null when no active bindings", () => {
    const tpl = makeTemplate([
      { providerId: "LOCAL_SHARP", status: "DRAFT" },
      { providerId: "DYNAMIC_MOCKUPS", status: "ARCHIVED" },
    ]);
    expect(resolveBinding(tpl)).toBeNull();
  });

  it("ignores DRAFT and ARCHIVED bindings", () => {
    const tpl = makeTemplate([
      { id: "b-1", providerId: "LOCAL_SHARP", status: "DRAFT" },
      { id: "b-2", providerId: "LOCAL_SHARP", status: "ARCHIVED" },
    ]);
    expect(resolveBinding(tpl)).toBeNull();
  });

  it("priority chain: LOCAL_SHARP wins over DYNAMIC_MOCKUPS when both active", () => {
    const tpl = makeTemplate([
      { id: "b-1", providerId: "DYNAMIC_MOCKUPS", status: "ACTIVE" },
      { id: "b-2", providerId: "LOCAL_SHARP", status: "ACTIVE" },
    ]);
    const result = resolveBinding(tpl);
    expect(result?.providerId).toBe("LOCAL_SHARP");
  });
});

describe("MockupProvider interface compliance", () => {
  it("localSharpProvider has correct shape", () => {
    expect(localSharpProvider.id).toBe("LOCAL_SHARP");
    expect(typeof localSharpProvider.render).toBe("function");
    expect(typeof localSharpProvider.validateConfig).toBe("function");
  });

  it("dynamicMockupsProvider has correct shape", () => {
    expect(dynamicMockupsProvider.id).toBe("DYNAMIC_MOCKUPS");
    expect(typeof dynamicMockupsProvider.render).toBe("function");
    expect(typeof dynamicMockupsProvider.validateConfig).toBe("function");
  });

  it("localSharpProvider.render is a real function (Task 9 — rect path active; perspective Task 10)", () => {
    // Task 9 sonrası render() artık scaffold değil; gerçek compositor'ı
    // çağırır. Asıl render davranışı integration testlerinde doğrulanır
    // (tests/integration/mockup/compositor-rect.test.ts).
    expect(typeof localSharpProvider.render).toBe("function");
  });

  it("dynamicMockupsProvider.render throws PROVIDER_NOT_CONFIGURED (V2 stub)", async () => {
    await expect(dynamicMockupsProvider.render({} as never)).rejects.toThrow(
      /PROVIDER_NOT_CONFIGURED/
    );
  });

  it("localSharpProvider.validateConfig accepts valid LocalSharpConfig", () => {
    const result = localSharpProvider.validateConfig({
      providerId: "local-sharp",
      baseAssetKey: "x.png",
      baseDimensions: { w: 100, h: 100 },
      safeArea: { type: "rect", x: 0, y: 0, w: 1, h: 1 },
      recipe: { blendMode: "normal" },
      coverPriority: 50,
    });
    expect(result.ok).toBe(true);
  });

  it("localSharpProvider.validateConfig rejects invalid config", () => {
    const result = localSharpProvider.validateConfig({
      providerId: "local-sharp",
    });
    expect(result.ok).toBe(false);
  });
});

describe("PROVIDER_PRIORITY constant", () => {
  it("LOCAL_SHARP is first (localhost-first disiplini)", () => {
    expect(PROVIDER_PRIORITY[0]).toBe("LOCAL_SHARP");
  });
});

describe("getProvider", () => {
  it("returns localSharpProvider for LOCAL_SHARP", () => {
    expect(getProvider("LOCAL_SHARP")).toBe(localSharpProvider);
  });
  it("returns dynamicMockupsProvider for DYNAMIC_MOCKUPS", () => {
    expect(getProvider("DYNAMIC_MOCKUPS")).toBe(dynamicMockupsProvider);
  });
});
