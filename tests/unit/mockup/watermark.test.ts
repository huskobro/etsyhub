import { describe, it, expect } from "vitest";
import {
  WM_OPACITY,
  WM_DEFAULT,
  WM_TEXT_MAX,
  normalizeWatermark,
  resolveWatermarkLayout,
  type WatermarkConfig,
  type WatermarkLayout,
} from "@/features/mockups/studio/frame-scene";

describe("normalizeWatermark", () => {
  it("undefined → WM_DEFAULT clone (disabled, empty text)", () => {
    const r = normalizeWatermark(undefined);
    expect(r).toEqual(WM_DEFAULT);
    expect(r).not.toBe(WM_DEFAULT); // fresh object, not shared ref
  });

  it("null → WM_DEFAULT clone", () => {
    expect(normalizeWatermark(null)).toEqual(WM_DEFAULT);
  });

  it("trims and clamps text to WM_TEXT_MAX", () => {
    const long = "x".repeat(WM_TEXT_MAX + 20);
    const r = normalizeWatermark({
      enabled: true,
      text: `  ${long}  `,
      opacity: "medium",
      placement: "br",
    });
    expect(r.text.length).toBe(WM_TEXT_MAX);
  });

  it("replaces newlines/carriage returns with single space (single-line guarantee)", () => {
    const r = normalizeWatermark({
      enabled: true,
      text: "line1\nline2\r\nline3",
      opacity: "soft",
      placement: "center",
    });
    expect(r.text).toBe("line1 line2 line3");
  });

  it("unknown opacity/placement fall back to WM_DEFAULT values", () => {
    const r = normalizeWatermark({
      enabled: true,
      text: "Shop",
      // @ts-expect-error intentional bad input
      opacity: "ultra",
      // @ts-expect-error intentional bad input
      placement: "spiral",
    });
    expect(r.opacity).toBe(WM_DEFAULT.opacity);
    expect(r.placement).toBe(WM_DEFAULT.placement);
  });

  it("valid config passes through (enabled, text, opacity, placement preserved)", () => {
    const cfg: WatermarkConfig = {
      enabled: true,
      text: "© Kivasy",
      opacity: "strong",
      placement: "tile",
    };
    expect(normalizeWatermark(cfg)).toEqual(cfg);
  });

  it("WM_OPACITY maps soft<medium<strong", () => {
    expect(WM_OPACITY.soft).toBeLessThan(WM_OPACITY.medium);
    expect(WM_OPACITY.medium).toBeLessThan(WM_OPACITY.strong);
  });
});

describe("resolveWatermarkLayout — active gating", () => {
  const FRAME = { w: 1080, h: 1080 };

  it("null config → inactive (no glyphs)", () => {
    const r: WatermarkLayout = resolveWatermarkLayout(null, FRAME);
    expect(r.active).toBe(false);
    expect(r.glyphs).toEqual([]);
    expect(r.opacity).toBe(0);
  });

  it("enabled=false → inactive", () => {
    const r = resolveWatermarkLayout(
      { enabled: false, text: "Shop", opacity: "medium", placement: "br" },
      FRAME,
    );
    expect(r.active).toBe(false);
  });

  it("empty/whitespace text → inactive even if enabled", () => {
    const r = resolveWatermarkLayout(
      { enabled: true, text: "   ", opacity: "medium", placement: "center" },
      FRAME,
    );
    expect(r.active).toBe(false);
    expect(r.glyphs).toEqual([]);
  });
});

describe("resolveWatermarkLayout — placement geometry", () => {
  const FRAME = { w: 1080, h: 1080 };

  it("br → single glyph, anchor 'end', bottom-right percentages, no rotation", () => {
    const r = resolveWatermarkLayout(
      { enabled: true, text: "© Kivasy", opacity: "soft", placement: "br" },
      FRAME,
    );
    expect(r.active).toBe(true);
    expect(r.anchor).toBe("end");
    expect(r.glyphs).toHaveLength(1);
    expect(r.glyphs[0]!.xPct).toBe(95);
    expect(r.glyphs[0]!.yPct).toBe(93);
    expect(r.glyphs[0]!.rotateDeg).toBe(0);
    expect(r.glyphs[0]!.text).toBe("© Kivasy");
    expect(r.opacity).toBe(WM_OPACITY.soft);
  });

  it("center → single glyph, anchor 'middle', centered, no rotation", () => {
    const r = resolveWatermarkLayout(
      { enabled: true, text: "PROOF", opacity: "strong", placement: "center" },
      FRAME,
    );
    expect(r.anchor).toBe("middle");
    expect(r.glyphs).toHaveLength(1);
    expect(r.glyphs[0]!.xPct).toBe(50);
    expect(r.glyphs[0]!.yPct).toBe(50);
    expect(r.glyphs[0]!.rotateDeg).toBe(0);
    expect(r.opacity).toBe(WM_OPACITY.strong);
  });

  it("center → font scales DOWN for long text (spec §5.2 ladder)", () => {
    const short = resolveWatermarkLayout(
      { enabled: true, text: "x".repeat(10), opacity: "medium", placement: "center" },
      FRAME,
    );
    const mid = resolveWatermarkLayout(
      { enabled: true, text: "x".repeat(28), opacity: "medium", placement: "center" },
      FRAME,
    );
    const long = resolveWatermarkLayout(
      { enabled: true, text: "x".repeat(40), opacity: "medium", placement: "center" },
      FRAME,
    );
    expect(short.fontPctOfMin).toBeGreaterThan(mid.fontPctOfMin);
    expect(mid.fontPctOfMin).toBeGreaterThan(long.fontPctOfMin);
  });

  it("tile → multiple glyphs, anchor 'middle', all rotated -30, all same text", () => {
    const r = resolveWatermarkLayout(
      { enabled: true, text: "© Kivasy", opacity: "medium", placement: "tile" },
      FRAME,
    );
    expect(r.anchor).toBe("middle");
    expect(r.glyphs.length).toBeGreaterThan(4);
    expect(r.glyphs.every((g) => g.rotateDeg === -30)).toBe(true);
    expect(r.glyphs.every((g) => g.text === "© Kivasy")).toBe(true);
  });

  it("tile → grid covers frame edges (some glyphs near/below 0 and above 100 pct after offset)", () => {
    const r = resolveWatermarkLayout(
      { enabled: true, text: "WM", opacity: "soft", placement: "tile" },
      FRAME,
    );
    const minX = Math.min(...r.glyphs.map((g) => g.xPct));
    const maxX = Math.max(...r.glyphs.map((g) => g.xPct));
    expect(minX).toBeLessThanOrEqual(5); // starts at/before left edge
    expect(maxX).toBeGreaterThanOrEqual(95); // reaches right edge
  });

  it("tile glyph count is deterministic for a given frame (stable across calls)", () => {
    const a = resolveWatermarkLayout(
      { enabled: true, text: "WM", opacity: "soft", placement: "tile" },
      FRAME,
    );
    const b = resolveWatermarkLayout(
      { enabled: true, text: "WM", opacity: "soft", placement: "tile" },
      FRAME,
    );
    expect(a.glyphs.length).toBe(b.glyphs.length);
  });

  it("tile on portrait frame stays consistent density (min-dimension based steps)", () => {
    const square = resolveWatermarkLayout(
      { enabled: true, text: "WM", opacity: "soft", placement: "tile" },
      { w: 1080, h: 1080 },
    );
    const portrait = resolveWatermarkLayout(
      { enabled: true, text: "WM", opacity: "soft", placement: "tile" },
      { w: 1080, h: 1920 },
    );
    // portrait taller → more rows → more glyphs than square
    expect(portrait.glyphs.length).toBeGreaterThan(square.glyphs.length);
  });
});

describe("resolveWatermarkLayout — cross-dimension parity (§11.0)", () => {
  // Preview passes a small-integer aspect frame (e.g. {w:4,h:5}); export
  // passes absolute pixels of the SAME ratio (e.g. {w:1080,h:1350}). The
  // percent-based geometry MUST yield byte-identical WatermarkLayout for
  // the same ratio regardless of absolute dimensions — this is the single
  // source of the "Preview = Export Truth" guarantee.
  const RATIO_PAIRS: Array<
    [{ w: number; h: number }, { w: number; h: number }]
  > = [
    [{ w: 1, h: 1 }, { w: 1080, h: 1080 }],
    [{ w: 4, h: 5 }, { w: 1080, h: 1350 }],
    [{ w: 9, h: 16 }, { w: 1080, h: 1920 }],
  ];

  it("tile geometry is identical for same ratio, different absolute dims", () => {
    for (const [a, b] of RATIO_PAIRS) {
      const cfg: WatermarkConfig = {
        enabled: true,
        text: "© Kivasy",
        opacity: "medium",
        placement: "tile",
      };
      // Whole-object deep equality: glyph count AND every per-glyph
      // xPct/yPct/rotateDeg/text, plus anchor/fontPctOfMin/opacity.
      // If the resolver used absolute px instead of percent, the tiny
      // {w:4,h:5} frame would produce a near-empty grid while
      // {w:1080,h:1350} produced a full one → this toEqual would FAIL.
      expect(resolveWatermarkLayout(cfg, a)).toEqual(
        resolveWatermarkLayout(cfg, b),
      );
    }
  });

  it("br and center geometry is ratio-invariant across absolute dims", () => {
    for (const [a, b] of RATIO_PAIRS) {
      for (const placement of ["br", "center"] as const) {
        const cfg: WatermarkConfig = {
          enabled: true,
          text: "Shop Name",
          opacity: "soft",
          placement,
        };
        expect(resolveWatermarkLayout(cfg, a)).toEqual(
          resolveWatermarkLayout(cfg, b),
        );
      }
    }
  });
});
