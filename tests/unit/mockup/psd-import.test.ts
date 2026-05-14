/**
 * Phase 75 — PSD import helper unit tests (PoC).
 *
 * Pure-math tests; no PSD file parsing yet (ag-psd integration Phase 76+).
 * Covers layerBoundsToSlot helper — operator-facing transform from PSD
 * layer bounds (absolute px) to template SafeAreaRect (normalized 0..1).
 */

import { describe, it, expect } from "vitest";
import {
  layerBoundsToSlot,
  parsePsdSmartObjects,
} from "@/providers/mockup/local-sharp/psd-import";

describe("Phase 75 — layerBoundsToSlot", () => {
  it("converts top-left aligned layer bounds → normalized SafeAreaRect", () => {
    const slot = layerBoundsToSlot({
      name: "Cover",
      bounds: { left: 100, top: 50, right: 500, bottom: 450 },
      canvas: { w: 1000, h: 1000 },
      slotId: "slot-1",
    });
    expect(slot.id).toBe("slot-1");
    expect(slot.name).toBe("Cover");
    expect(slot.safeArea.type).toBe("rect");
    if (slot.safeArea.type === "rect") {
      expect(slot.safeArea.x).toBeCloseTo(0.1, 4);
      expect(slot.safeArea.y).toBeCloseTo(0.05, 4);
      expect(slot.safeArea.w).toBeCloseTo(0.4, 4);
      expect(slot.safeArea.h).toBeCloseTo(0.4, 4);
    }
  });

  it("clamps out-of-canvas bounds to canvas boundary", () => {
    const slot = layerBoundsToSlot({
      name: "Overflow",
      bounds: { left: -50, top: -100, right: 1200, bottom: 1100 },
      canvas: { w: 1000, h: 1000 },
      slotId: "slot-of",
    });
    if (slot.safeArea.type === "rect") {
      // x/y clamped to >= 0
      expect(slot.safeArea.x).toBe(0);
      expect(slot.safeArea.y).toBe(0);
      // w/h clamped (-50→0, 1200→1; effective range 0..1.25 → clamped to 1)
      expect(slot.safeArea.w).toBeLessThanOrEqual(1);
      expect(slot.safeArea.h).toBeLessThanOrEqual(1);
    }
  });

  it("enforces minimum 5% dimension for tiny layers", () => {
    const slot = layerBoundsToSlot({
      name: "Tiny",
      bounds: { left: 100, top: 100, right: 110, bottom: 110 },
      canvas: { w: 1000, h: 1000 },
      slotId: "slot-tiny",
    });
    if (slot.safeArea.type === "rect") {
      // Raw w=0.01 (1%), clamped to 0.05 (5% min)
      expect(slot.safeArea.w).toBe(0.05);
      expect(slot.safeArea.h).toBe(0.05);
    }
  });

  it("handles non-square canvas (e.g., wall art 2:3 portrait)", () => {
    const slot = layerBoundsToSlot({
      name: "Frame Interior",
      bounds: { left: 200, top: 300, right: 800, bottom: 1200 },
      canvas: { w: 1000, h: 1500 }, // 2:3 portrait
      slotId: "slot-frame",
    });
    if (slot.safeArea.type === "rect") {
      expect(slot.safeArea.x).toBeCloseTo(0.2, 4);
      expect(slot.safeArea.y).toBeCloseTo(0.2, 4);
      expect(slot.safeArea.w).toBeCloseTo(0.6, 4);
      expect(slot.safeArea.h).toBeCloseTo(0.6, 4);
    }
  });
});

describe("Phase 75 — parsePsdSmartObjects (PoC stub)", () => {
  it("throws NOT_IMPLEMENTED until ag-psd integration lands (Phase 76+)", () => {
    expect(() =>
      parsePsdSmartObjects({
        psdBuffer: Buffer.from([0x38, 0x42, 0x50, 0x53]), // "8BPS" magic
      }),
    ).toThrow(/PSD_IMPORT_NOT_IMPLEMENTED/);
  });
});
