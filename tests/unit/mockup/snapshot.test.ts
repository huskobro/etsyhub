// Phase 8 Task 5 — snapshot service unit testleri.
//
// Spec §1.4 hero/aspectRatio fallback chain + §3.3 RenderSnapshot byte-stable
// JSON + §3.4 setSnapshotId deterministik hash.
//
// Asset URL not: schema'da `Asset.url` yok; `storageKey` kullanılıyor.
// Bu nedenle `resolveAssetKey` (spec'te "url" yazılı olsa da pragmatik
// uyum) — snapshot fingerprint için stable storageKey yeterli.

import { describe, it, expect } from "vitest";
import {
  stableStringify,
  computeSetSnapshotId,
  snapshotForRender,
  resolveAspectRatio,
  resolveAssetKey,
} from "@/features/mockups/server/snapshot.service";

describe("stableStringify", () => {
  it("returns same output for same object regardless of key order", () => {
    const a = { x: 1, y: 2, z: 3 };
    const b = { z: 3, y: 2, x: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("handles nested objects deterministically", () => {
    const a = { outer: { b: 2, a: 1 }, c: 3 };
    const b = { c: 3, outer: { a: 1, b: 2 } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("handles arrays in order (not sorted)", () => {
    expect(stableStringify([1, 2, 3])).toBe("[1,2,3]");
    expect(stableStringify([3, 2, 1])).toBe("[3,2,1]");
  });

  it("handles null + primitives", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify("hello")).toBe('"hello"');
  });

  it("nested array of objects keeps object key sort", () => {
    const a = stableStringify([{ b: 2, a: 1 }, { d: 4, c: 3 }]);
    const b = stableStringify([{ a: 1, b: 2 }, { c: 3, d: 4 }]);
    expect(a).toBe(b);
  });
});

describe("computeSetSnapshotId", () => {
  // Helper — minimal SelectionSet fixture (relations dahil).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseItem = (overrides: Record<string, unknown> = {}): any => ({
    id: "item-1",
    position: 0,
    status: "selected" as const,
    generatedDesign: { aspectRatio: "2:3", productType: null },
    sourceAsset: { storageKey: "asset.png" },
    editedAsset: null,
    ...overrides,
  });

  it("produces deterministic hash for same set+items", () => {
    const set = {
      id: "set-1",
      status: "ready" as const,
      finalizedAt: new Date("2026-05-01T12:00:00Z"),
      items: [
        baseItem({ id: "i-1", position: 0 }),
        baseItem({ id: "i-2", position: 1 }),
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const hash1 = computeSetSnapshotId(set);
    const hash2 = computeSetSnapshotId(set);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
  });

  it("different items produce different hash", () => {
    const set1 = {
      id: "set-1",
      status: "ready",
      finalizedAt: null,
      items: [baseItem({ id: "i-1" })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const set2 = {
      id: "set-1",
      status: "ready",
      finalizedAt: null,
      items: [baseItem({ id: "i-2" })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(computeSetSnapshotId(set1)).not.toBe(computeSetSnapshotId(set2));
  });

  it("rejected items excluded from hash", () => {
    const setA = {
      id: "set-1",
      status: "ready",
      finalizedAt: null,
      items: [baseItem({ id: "i-1", position: 0 })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const setB = {
      id: "set-1",
      status: "ready",
      finalizedAt: null,
      items: [
        baseItem({ id: "i-1", position: 0 }),
        baseItem({ id: "i-rejected", position: 1, status: "rejected" }),
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(computeSetSnapshotId(setA)).toBe(computeSetSnapshotId(setB));
  });

  it("position ordering normalized — input array order matters not", () => {
    const set1 = {
      id: "set-1",
      status: "ready",
      finalizedAt: null,
      items: [
        baseItem({ id: "i-1", position: 0 }),
        baseItem({ id: "i-2", position: 1 }),
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const set2 = {
      id: "set-1",
      status: "ready",
      finalizedAt: null,
      items: [
        baseItem({ id: "i-2", position: 1 }),
        baseItem({ id: "i-1", position: 0 }),
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(computeSetSnapshotId(set1)).toBe(computeSetSnapshotId(set2));
  });

  it("finalizedAt null vs not-null produces different hash", () => {
    const set1 = {
      id: "set-1",
      status: "ready",
      finalizedAt: null,
      items: [baseItem({ id: "i-1" })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const set2 = {
      id: "set-1",
      status: "ready",
      finalizedAt: new Date("2026-05-01T12:00:00Z"),
      items: [baseItem({ id: "i-1" })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(computeSetSnapshotId(set1)).not.toBe(computeSetSnapshotId(set2));
  });
});

describe("resolveAspectRatio fallback chain", () => {
  it("returns generatedDesign.aspectRatio when present", () => {
    expect(
      resolveAspectRatio({
        generatedDesign: {
          aspectRatio: "2:3",
          productType: { aspectRatio: "1:1" },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    ).toBe("2:3");
  });

  it("falls back to productType.aspectRatio when generatedDesign null", () => {
    expect(
      resolveAspectRatio({
        generatedDesign: {
          aspectRatio: null,
          productType: { aspectRatio: "3:4" },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    ).toBe("3:4");
  });

  it("returns null when both null", () => {
    expect(
      resolveAspectRatio({
        generatedDesign: { aspectRatio: null, productType: null },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    ).toBeNull();
  });

  it("returns null when productType also null aspectRatio", () => {
    expect(
      resolveAspectRatio({
        generatedDesign: {
          aspectRatio: null,
          productType: { aspectRatio: null },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    ).toBeNull();
  });
});

describe("resolveAssetKey", () => {
  it("returns editedAsset.storageKey when present", () => {
    expect(
      resolveAssetKey({
        sourceAsset: { storageKey: "source.png" },
        editedAsset: { storageKey: "edited.png" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    ).toBe("edited.png");
  });

  it("falls back to sourceAsset.storageKey when no editedAsset", () => {
    expect(
      resolveAssetKey({
        sourceAsset: { storageKey: "source.png" },
        editedAsset: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    ).toBe("source.png");
  });
});

describe("snapshotForRender", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const localSharpBinding: any = {
    id: "binding-1",
    templateId: "tpl-1",
    providerId: "LOCAL_SHARP" as const,
    version: 2,
    status: "ACTIVE" as const,
    config: {
      providerId: "local-sharp",
      baseAssetKey: "tpl-1/v2/base.png",
      baseDimensions: { w: 2400, h: 1600 },
      safeArea: { type: "rect", x: 0.3, y: 0.2, w: 0.4, h: 0.5 },
      recipe: { blendMode: "normal" },
      coverPriority: 75,
    },
    estimatedRenderMs: 2000,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const template: any = {
    id: "tpl-1",
    name: "Test Template",
    aspectRatios: ["2:3", "3:4"],
  };

  it("excludes coverPriority from snapshot config", () => {
    const snap = snapshotForRender(localSharpBinding, template);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((snap.config as any).coverPriority).toBeUndefined();
  });

  it("preserves all other config fields", () => {
    const snap = snapshotForRender(localSharpBinding, template);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((snap.config as any).baseAssetKey).toBe("tpl-1/v2/base.png");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((snap.config as any).safeArea).toEqual({
      type: "rect",
      x: 0.3,
      y: 0.2,
      w: 0.4,
      h: 0.5,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((snap.config as any).recipe).toEqual({ blendMode: "normal" });
  });

  it("denormalizes templateName + aspectRatios", () => {
    const snap = snapshotForRender(localSharpBinding, template);
    expect(snap.templateName).toBe("Test Template");
    expect(snap.aspectRatios).toEqual(["2:3", "3:4"]);
  });

  it("includes bindingVersion + providerId (UPPER_CASE Prisma enum)", () => {
    const snap = snapshotForRender(localSharpBinding, template);
    expect(snap.bindingVersion).toBe(2);
    expect(snap.providerId).toBe("LOCAL_SHARP");
    expect(snap.bindingId).toBe("binding-1");
    expect(snap.templateId).toBe("tpl-1");
  });

  it("dynamic-mockups config kept as-is (no coverPriority on that variant)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dmBinding: any = {
      id: "binding-dm",
      templateId: "tpl-dm",
      providerId: "DYNAMIC_MOCKUPS" as const,
      version: 1,
      status: "ACTIVE",
      config: {
        providerId: "dynamic-mockups",
        externalTemplateId: "ext-1",
      },
      estimatedRenderMs: 5000,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dmTpl: any = {
      id: "tpl-dm",
      name: "DM Template",
      aspectRatios: ["1:1"],
    };
    const snap = snapshotForRender(dmBinding, dmTpl);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((snap.config as any).providerId).toBe("dynamic-mockups");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((snap.config as any).externalTemplateId).toBe("ext-1");
    expect(snap.providerId).toBe("DYNAMIC_MOCKUPS");
  });
});
