// Phase 8 Task 8 — buildPackSelection algoritma birim testleri.
//
// Spec §2.5: 3-katmanlı algoritma testleri:
//   1. aspect compatibility filter
//   2. cover (hero × highest coverPriority + lex tie-break)
//   3. template diversity (her unique binding ≥1 kez)
//   4. variant rotation (round-robin kalan slot)
//   5. determinizm (aynı input → aynı output)
//   6. compatibility-limited (validPairs < packSize)
//   7. packSize=1 edge
//   8. empty inputs

import { describe, it, expect } from "vitest";
import { buildPackSelection } from "@/features/mockups/server/pack-selection.service";
import type {
  MockupTemplate,
  MockupTemplateBinding,
} from "@prisma/client";
import type { LocalSharpConfig } from "@/providers/mockup";

// Helper: minimal template + binding pair fixture (Prisma model şekline uyum).
function makePair(opts: {
  bindingId: string;
  templateAspects: string[];
  coverPriority: number;
}): { template: MockupTemplate; binding: MockupTemplateBinding } {
  const template: MockupTemplate = {
    id: `tpl-${opts.bindingId}`,
    categoryId: "canvas",
    name: `Template ${opts.bindingId}`,
    status: "ACTIVE",
    thumbKey: "thumb.png",
    aspectRatios: opts.templateAspects,
    tags: ["modern"],
    estimatedRenderMs: 2000,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  };
  const config: LocalSharpConfig = {
    providerId: "local-sharp",
    baseAssetKey: `tpl-${opts.bindingId}.png`,
    baseDimensions: { w: 2400, h: 1600 },
    safeArea: { type: "rect", x: 0.3, y: 0.2, w: 0.4, h: 0.5 },
    recipe: { blendMode: "normal" },
    coverPriority: opts.coverPriority,
  };
  const binding: MockupTemplateBinding = {
    id: opts.bindingId,
    templateId: template.id,
    providerId: "LOCAL_SHARP",
    version: 1,
    status: "ACTIVE",
    config: config as unknown as object,
    estimatedRenderMs: 2000,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  };
  return { template, binding };
}

describe("buildPackSelection — Spec §2.5", () => {
  it("filters validPairs by aspect compatibility", () => {
    // 2 item (2:3, 3:4), 2 binding (template aspects [2:3], [3:4])
    // → 2 valid pair (each item × matching template)
    const items = [
      { id: "i-1", aspectRatio: "2:3", position: 0 },
      { id: "i-2", aspectRatio: "3:4", position: 1 },
    ];
    const pairs = [
      makePair({ bindingId: "b-1", templateAspects: ["2:3"], coverPriority: 50 }),
      makePair({ bindingId: "b-2", templateAspects: ["3:4"], coverPriority: 50 }),
    ];
    const pack = buildPackSelection(items, pairs, 10);
    expect(pack.slots.length).toBeGreaterThan(0);

    // Aspect mismatch: hiç compatible pair yok → empty pack.
    const itemsMismatch = [{ id: "i-1", aspectRatio: "1:1", position: 0 }];
    const packEmpty = buildPackSelection(itemsMismatch, pairs, 10);
    expect(packEmpty.slots).toHaveLength(0);
    expect(packEmpty.cover).toBeNull();
  });

  it("picks cover: hero variant (position 0) × highest coverPriority binding", () => {
    const items = [
      { id: "hero", aspectRatio: "2:3", position: 0 },
      { id: "other", aspectRatio: "2:3", position: 1 },
    ];
    const pairs = [
      makePair({ bindingId: "b-low", templateAspects: ["2:3"], coverPriority: 30 }),
      makePair({ bindingId: "b-high", templateAspects: ["2:3"], coverPriority: 90 }),
    ];
    const pack = buildPackSelection(items, pairs, 10);
    expect(pack.cover).not.toBeNull();
    expect(pack.cover!.variantId).toBe("hero");
    expect(pack.cover!.binding.id).toBe("b-high");
    expect(pack.cover!.selectionReason).toBe("COVER");
    // Slots[0] cover invariant.
    expect(pack.slots[0]).toEqual(pack.cover);
  });

  it("cover priority lex tie-break (eşit priority → bindingId ASC)", () => {
    const items = [{ id: "hero", aspectRatio: "2:3", position: 0 }];
    const pairs = [
      makePair({ bindingId: "b-zzz", templateAspects: ["2:3"], coverPriority: 50 }),
      makePair({ bindingId: "b-aaa", templateAspects: ["2:3"], coverPriority: 50 }),
    ];
    const pack = buildPackSelection(items, pairs, 10);
    expect(pack.cover!.binding.id).toBe("b-aaa"); // lex ASC
  });

  it("template diversity: each unique binding represented at least once", () => {
    const items = [
      { id: "i-1", aspectRatio: "2:3", position: 0 },
      { id: "i-2", aspectRatio: "2:3", position: 1 },
    ];
    const pairs = [
      makePair({ bindingId: "b-a", templateAspects: ["2:3"], coverPriority: 90 }),
      makePair({ bindingId: "b-b", templateAspects: ["2:3"], coverPriority: 50 }),
      makePair({ bindingId: "b-c", templateAspects: ["2:3"], coverPriority: 30 }),
    ];
    const pack = buildPackSelection(items, pairs, 10);
    const bindingIdsInPack = new Set(pack.slots.map((s) => s.binding.id));
    expect(bindingIdsInPack.has("b-a")).toBe(true);
    expect(bindingIdsInPack.has("b-b")).toBe(true);
    expect(bindingIdsInPack.has("b-c")).toBe(true);
    // Cover (b-a) + en az 2 diversity slot (b-b, b-c).
    expect(
      pack.slots.filter((s) => s.selectionReason === "TEMPLATE_DIVERSITY")
        .length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("variant rotation: kalan slot'lar round-robin", () => {
    // 3 item × 2 binding = 6 valid pair, packSize 10 → actualPackSize 6
    // Cover (1) + diversity (1; ikinci binding) + rotation (kalan 4)
    const items = [
      { id: "i-1", aspectRatio: "2:3", position: 0 },
      { id: "i-2", aspectRatio: "2:3", position: 1 },
      { id: "i-3", aspectRatio: "2:3", position: 2 },
    ];
    const pairs = [
      makePair({ bindingId: "b-1", templateAspects: ["2:3"], coverPriority: 90 }),
      makePair({ bindingId: "b-2", templateAspects: ["2:3"], coverPriority: 50 }),
    ];
    const pack = buildPackSelection(items, pairs, 10);
    expect(pack.slots).toHaveLength(6);
    expect(
      pack.slots.filter((s) => s.selectionReason === "COVER"),
    ).toHaveLength(1);
    expect(
      pack.slots.filter((s) => s.selectionReason === "TEMPLATE_DIVERSITY"),
    ).toHaveLength(1);
    expect(
      pack.slots.filter((s) => s.selectionReason === "VARIANT_ROTATION"),
    ).toHaveLength(4);

    // Tüm pair'ler unique olmalı (variantId, bindingId).
    const keys = new Set(pack.slots.map((s) => `${s.variantId}:${s.binding.id}`));
    expect(keys.size).toBe(6);
  });

  it("deterministic: same input → same output", () => {
    const items = [
      { id: "i-1", aspectRatio: "2:3", position: 0 },
      { id: "i-2", aspectRatio: "2:3", position: 1 },
    ];
    const pairs = [
      makePair({ bindingId: "b-1", templateAspects: ["2:3"], coverPriority: 90 }),
      makePair({ bindingId: "b-2", templateAspects: ["2:3"], coverPriority: 50 }),
    ];
    const pack1 = buildPackSelection(items, pairs, 10);
    const pack2 = buildPackSelection(items, pairs, 10);
    expect(pack1).toEqual(pack2);

    // Input order'ı değişse de aynı pack çıksın (stable sort disiplini).
    const itemsReversed = [...items].reverse();
    const pairsReversed = [...pairs].reverse();
    const pack3 = buildPackSelection(itemsReversed, pairsReversed, 10);
    expect(pack3).toEqual(pack1);
  });

  it("compatibility-limited: validPairs.length < packSize → actualPackSize < 10", () => {
    const items = [{ id: "i-1", aspectRatio: "2:3", position: 0 }];
    const pairs = [
      makePair({ bindingId: "b-1", templateAspects: ["2:3"], coverPriority: 90 }),
      makePair({ bindingId: "b-2", templateAspects: ["2:3"], coverPriority: 50 }),
    ];
    const pack = buildPackSelection(items, pairs, 10);
    // 1 item × 2 binding = 2 valid pair → actualPackSize 2
    expect(pack.slots).toHaveLength(2);
  });

  it("packSize=1 (only cover) edge case", () => {
    const items = [{ id: "i-1", aspectRatio: "2:3", position: 0 }];
    const pairs = [
      makePair({ bindingId: "b-1", templateAspects: ["2:3"], coverPriority: 90 }),
    ];
    const pack = buildPackSelection(items, pairs, 1);
    expect(pack.slots).toHaveLength(1);
    expect(pack.slots[0]!.selectionReason).toBe("COVER");
  });

  it("empty items → empty pack", () => {
    const pack = buildPackSelection(
      [],
      [makePair({ bindingId: "b-1", templateAspects: ["2:3"], coverPriority: 50 })],
      10,
    );
    expect(pack.slots).toHaveLength(0);
    expect(pack.cover).toBeNull();
  });

  it("empty pairs → empty pack", () => {
    const pack = buildPackSelection(
      [{ id: "i-1", aspectRatio: "2:3", position: 0 }],
      [],
      10,
    );
    expect(pack.slots).toHaveLength(0);
    expect(pack.cover).toBeNull();
  });

  it("cover invariant: pack.slots[0] === pack.cover (her zaman packPosition=0)", () => {
    const items = [
      { id: "i-1", aspectRatio: "2:3", position: 0 },
      { id: "i-2", aspectRatio: "2:3", position: 1 },
      { id: "i-3", aspectRatio: "2:3", position: 2 },
    ];
    const pairs = [
      makePair({ bindingId: "b-1", templateAspects: ["2:3"], coverPriority: 90 }),
      makePair({ bindingId: "b-2", templateAspects: ["2:3"], coverPriority: 50 }),
      makePair({ bindingId: "b-3", templateAspects: ["2:3"], coverPriority: 70 }),
    ];
    const pack = buildPackSelection(items, pairs, 10);
    expect(pack.slots[0]).toEqual(pack.cover);
    expect(pack.cover!.binding.id).toBe("b-1"); // highest coverPriority (90)
  });
});
