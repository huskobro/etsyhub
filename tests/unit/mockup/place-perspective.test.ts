// Phase 63 — placePerspective implementation tests.
//
// Coverage:
// 1. computeHomography:
//    - identity quad (src == dst → diagonal-like H, points map to themselves)
//    - skewed quad (degenerate detection)
// 2. placePerspective end-to-end:
//    - identity-like mapping (corners equal source rect → output looks like
//      resized source within bbox; opaque pixels round-trip)
//    - keystone/trapezoid mapping (top edge narrower than bottom; verifies
//      perspective foreshortening — top-row pixels are darker/transparent
//      than bottom-row in known fixture)
//    - top-left + bottom-right of placement absolute (composite-ready)

import { describe, it, expect } from "vitest";
import sharp from "sharp";
import {
  computeHomography,
  placePerspective,
} from "@/providers/mockup/local-sharp/safe-area";

const BASE = { w: 1000, h: 1000 };

describe("computeHomography", () => {
  it("returns identity-like H when src == dst (square)", () => {
    const square: Array<[number, number]> = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    const H = computeHomography(square, square);
    // Identity homography: h0=1, h4=1, others~=0 (within numerical eps)
    expect(H[0]).toBeCloseTo(1, 6);
    expect(H[1]).toBeCloseTo(0, 6);
    expect(H[2]).toBeCloseTo(0, 6);
    expect(H[3]).toBeCloseTo(0, 6);
    expect(H[4]).toBeCloseTo(1, 6);
    expect(H[5]).toBeCloseTo(0, 6);
    expect(H[6]).toBeCloseTo(0, 6);
    expect(H[7]).toBeCloseTo(0, 6);
  });

  it("maps src corners to dst corners exactly", () => {
    const src: Array<[number, number]> = [
      [0, 0],
      [200, 0],
      [200, 200],
      [0, 200],
    ];
    const dst: Array<[number, number]> = [
      [50, 50],
      [350, 75],
      [320, 325],
      [70, 290],
    ];
    const H = computeHomography(src, dst);
    // For each (xs, ys) in src, applying H must yield the corresponding dst
    for (let i = 0; i < 4; i++) {
      const [xs, ys] = src[i];
      const [xdExpected, ydExpected] = dst[i];
      const w = H[6] * xs + H[7] * ys + 1;
      const xd = (H[0] * xs + H[1] * ys + H[2]) / w;
      const yd = (H[3] * xs + H[4] * ys + H[5]) / w;
      expect(xd).toBeCloseTo(xdExpected, 4);
      expect(yd).toBeCloseTo(ydExpected, 4);
    }
  });

  it("throws on degenerate (collinear) quad", () => {
    const collinear: Array<[number, number]> = [
      [0, 0],
      [100, 0],
      [200, 0],
      [300, 0], // all on same line — singular
    ];
    expect(() => computeHomography(collinear, collinear)).toThrow();
  });
});

describe("placePerspective", () => {
  it("returns placement with bbox-aligned top/left", async () => {
    // 100×100 solid red design
    const designBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    // Trapezoid quad on 1000×1000 base
    //   TL = (200, 100), TR = (800, 150)  ← top edge narrow, slight tilt
    //   BR = (850, 800), BL = (150, 850)  ← bottom edge wider
    const placement = await placePerspective(
      designBuffer,
      {
        type: "perspective",
        corners: [
          [0.2, 0.1],
          [0.8, 0.15],
          [0.85, 0.8],
          [0.15, 0.85],
        ],
      },
      BASE,
    );

    // bbox: x=[150..850], y=[100..850] → top=100, left=150
    expect(placement.top).toBe(100);
    expect(placement.left).toBe(150);

    // Output buffer is a valid PNG
    const meta = await sharp(placement.buffer).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);
    expect(meta.channels).toBe(4); // RGBA
  });

  it("identity-like quad produces opaque output filling its bbox", async () => {
    // Design is a 200×200 solid green
    const designBuffer = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: { r: 0, g: 200, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    // Quad mapped to a clean rect on the base (axis-aligned)
    //   TL=(100,100) TR=(500,100) BR=(500,500) BL=(100,500)
    const placement = await placePerspective(
      designBuffer,
      {
        type: "perspective",
        corners: [
          [0.1, 0.1],
          [0.5, 0.1],
          [0.5, 0.5],
          [0.1, 0.5],
        ],
      },
      BASE,
    );

    expect(placement.top).toBe(100);
    expect(placement.left).toBe(100);

    const meta = await sharp(placement.buffer).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(400);

    // Sample center pixel: should be opaque green
    const centerPixel = await sharp(placement.buffer)
      .extract({ left: 200, top: 200, width: 1, height: 1 })
      .raw()
      .toBuffer();
    // RGBA — green channel is dominant
    expect(centerPixel[1]).toBeGreaterThan(150); // green
    expect(centerPixel[3]).toBeGreaterThan(200); // alpha (opaque)
  });

  it("keystone (top narrower) creates a quad-shaped output bbox", async () => {
    const designBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    // Keystone: top narrow (300..700), bottom wide (100..900); skin to base
    const placement = await placePerspective(
      designBuffer,
      {
        type: "perspective",
        corners: [
          [0.3, 0.2],
          [0.7, 0.2],
          [0.9, 0.8],
          [0.1, 0.8],
        ],
      },
      BASE,
    );

    // bbox spans the wider bottom edge (x: 100..900) and y: 200..800
    expect(placement.left).toBe(100);
    expect(placement.top).toBe(200);

    const meta = await sharp(placement.buffer).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);

    // Top-row corner pixel (xo=0, yo=0) is OUTSIDE the keystone quad
    // (quad's top edge starts at x=200 within bbox = absolute x=300).
    // It should be transparent.
    const topLeftCorner = await sharp(placement.buffer)
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect(topLeftCorner[3]).toBe(0); // alpha = 0 (outside quad)

    // Sample inside the keystone quad (slightly off the BL corner to
    // avoid floating-point edge sampling artifacts):
    //   bbox (xo=2, yo=595) corresponds to base ~(102, 795), well within
    //   the quad's wide bottom region. Should be opaque blue.
    const insideQuad = await sharp(placement.buffer)
      .extract({ left: 2, top: 595, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect(insideQuad[2]).toBeGreaterThan(200); // blue dominant
    expect(insideQuad[3]).toBeGreaterThan(200); // opaque
  });
});
