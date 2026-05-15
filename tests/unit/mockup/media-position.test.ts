import { describe, it, expect } from "vitest";
import {
  MEDIA_POSITION_PAN_K,
  MEDIA_POSITION_NEUTRAL,
  resolveMediaOffsetPx,
  clampMediaPosition,
  normalizePadPointToPosition,
  mediaPositionsEqual,
} from "@/features/mockups/studio/media-position";

describe("media-position resolver", () => {
  it("K is 0.5 and neutral is {0,0}", () => {
    expect(MEDIA_POSITION_PAN_K).toBe(0.5);
    expect(MEDIA_POSITION_NEUTRAL).toEqual({ x: 0, y: 0 });
  });

  it("resolveMediaOffsetPx neutral = {0,0} (sacred no-op)", () => {
    expect(resolveMediaOffsetPx({ x: 0, y: 0 }, 1000, 600)).toEqual({
      ox: 0,
      oy: 0,
    });
  });

  it("resolveMediaOffsetPx = pos * render * K", () => {
    // x=1 → 1000 * 0.5 = 500 ; y=-1 → 600 * 0.5 * -1 = -300
    expect(resolveMediaOffsetPx({ x: 1, y: -1 }, 1000, 600)).toEqual({
      ox: 500,
      oy: -300,
    });
    // half: x=0.5 → 1000*0.5*0.5 = 250
    expect(resolveMediaOffsetPx({ x: 0.5, y: 0 }, 1000, 600)).toEqual({
      ox: 250,
      oy: 0,
    });
  });

  it("resolveMediaOffsetPx is resolution-independent (same pos, different render → proportional)", () => {
    const a = resolveMediaOffsetPx({ x: 0.4, y: 0.2 }, 1000, 600);
    const b = resolveMediaOffsetPx({ x: 0.4, y: 0.2 }, 200, 120);
    expect(a.ox / b.ox).toBeCloseTo(5, 5);
    expect(a.oy / b.oy).toBeCloseTo(5, 5);
  });

  it("clampMediaPosition clamps to [-1,1]", () => {
    expect(clampMediaPosition({ x: 2, y: -3 })).toEqual({ x: 1, y: -1 });
    expect(clampMediaPosition({ x: -0.4, y: 0.7 })).toEqual({
      x: -0.4,
      y: 0.7,
    });
  });

  it("normalizePadPointToPosition maps pad center → {0,0}", () => {
    const rect = { left: 0, top: 0, width: 200, height: 156 };
    const r = normalizePadPointToPosition(
      100,
      78,
      rect,
      false,
      { x: 0, y: 0 },
    );
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.y).toBeCloseTo(0, 6);
  });

  it("normalizePadPointToPosition maps pad edges → ±1 (clamped)", () => {
    const rect = { left: 0, top: 0, width: 200, height: 156 };
    // far right/bottom → +1,+1
    expect(
      normalizePadPointToPosition(200, 156, rect, false, { x: 0, y: 0 }),
    ).toEqual({ x: 1, y: 1 });
    // far left/top → -1,-1
    expect(
      normalizePadPointToPosition(0, 0, rect, false, { x: 0, y: 0 }),
    ).toEqual({ x: -1, y: -1 });
    // beyond bounds still clamps
    expect(
      normalizePadPointToPosition(400, -50, rect, false, { x: 0, y: 0 }),
    ).toEqual({ x: 1, y: -1 });
  });

  it("normalizePadPointToPosition Shift = precision (delta from prev / 4)", () => {
    const rect = { left: 0, top: 0, width: 200, height: 156 };
    // without shift: point at right edge x=1
    const full = normalizePadPointToPosition(200, 78, rect, false, {
      x: 0,
      y: 0,
    });
    expect(full.x).toBeCloseTo(1, 6);
    // with shift from prev {0,0}: target x=1, applied = 0 + (1-0)/4 = 0.25
    const fine = normalizePadPointToPosition(200, 78, rect, true, {
      x: 0,
      y: 0,
    });
    expect(fine.x).toBeCloseTo(0.25, 6);
    expect(fine.y).toBeCloseTo(0, 6);
  });

  it("mediaPositionsEqual epsilon 1e-3 (no false stale)", () => {
    expect(
      mediaPositionsEqual({ x: 0.1, y: 0.2 }, { x: 0.1000004, y: 0.2 }),
    ).toBe(true);
    expect(
      mediaPositionsEqual({ x: 0.1, y: 0.2 }, { x: 0.15, y: 0.2 }),
    ).toBe(false);
  });
});
