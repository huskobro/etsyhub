/**
 * Phase 69 — Safe-area validity helpers (UI-side guard).
 *
 * Backend `placePerspective` (Phase 63) operatör hatalı quad gönderirse
 * "singular matrix" throw eder. UI tarafı bu fail'i runtime'da değil,
 * authoring sırasında (save öncesi) operatöre actionable şekilde
 * göstermeli — "neden kaydedemiyorum?" cevabını net verelim.
 *
 * Bu modül pure-math validity check'leri taşır:
 *   - Rect: minimum dimension + bounds
 *   - Perspective:
 *     · Self-intersecting (bowtie / "X" shape)
 *     · Degenerate (3+ collinear points → singular matrix)
 *     · Near-collinear (small min interior angle)
 *     · Too small (< 2% of canvas area)
 *     · Out-of-bounds (corner < 0 veya > 1)
 *
 * Yeni big abstraction değil — pure functions, 0 dep. Mevcut SafeAreaValue
 * type'ı consume eder. UI hem real-time validation badge hem submit gate
 * için aynı sonucu okur.
 */

import type { SafeAreaValue, SafeAreaPerspective } from "./SafeAreaEditor";

export type ValidityIssue = {
  /** Severity: "error" blocks save; "warning" allows save with caution. */
  severity: "error" | "warning";
  code:
    | "rect-too-small"
    | "rect-out-of-bounds"
    | "quad-too-small"
    | "quad-out-of-bounds"
    | "quad-self-intersecting"
    | "quad-degenerate"
    | "quad-near-collinear";
  message: string;
};

export type ValidityResult = {
  ok: boolean; // true → no errors (warnings still allowed)
  issues: ValidityIssue[];
};

const MIN_RECT_DIM = 0.05; // 5% min width/height
const MIN_QUAD_AREA = 0.02; // 2% of canvas area
const MIN_INTERIOR_ANGLE_DEG = 10; // very narrow corner = near-collinear

/** Cross product of vectors (B-A) × (C-A). Sign tells turn direction. */
function cross(
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Two segments AB and CD intersect (proper crossing, not endpoint touch). */
function segmentsIntersect(
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
  d: readonly [number, number],
): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  // Proper intersection: signs differ on both sides
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }
  return false;
}

/** Polygon area via shoelace formula (signed; absolute = area). */
function polygonArea(corners: SafeAreaPerspective["corners"]): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const a = corners[i] as readonly [number, number];
    const b = corners[(i + 1) % 4] as readonly [number, number];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) / 2;
}

/** Smallest interior angle (degrees) across the 4 corners. */
function minInteriorAngleDeg(
  corners: SafeAreaPerspective["corners"],
): number {
  let minAngle = 180;
  for (let i = 0; i < 4; i++) {
    const prev = corners[(i + 3) % 4] as readonly [number, number];
    const curr = corners[i] as readonly [number, number];
    const next = corners[(i + 1) % 4] as readonly [number, number];
    const v1x = prev[0] - curr[0];
    const v1y = prev[1] - curr[1];
    const v2x = next[0] - curr[0];
    const v2y = next[1] - curr[1];
    const dot = v1x * v2x + v1y * v2y;
    const mag1 = Math.hypot(v1x, v1y);
    const mag2 = Math.hypot(v2x, v2y);
    if (mag1 === 0 || mag2 === 0) return 0;
    const cosA = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    const angleDeg = (Math.acos(cosA) * 180) / Math.PI;
    if (angleDeg < minAngle) minAngle = angleDeg;
  }
  return minAngle;
}

export function validateSafeArea(value: SafeAreaValue): ValidityResult {
  const issues: ValidityIssue[] = [];

  if (value.mode === "rect") {
    const r = value.rect;
    if (r.w < MIN_RECT_DIM || r.h < MIN_RECT_DIM) {
      issues.push({
        severity: "error",
        code: "rect-too-small",
        message: `Rect too small (min ${MIN_RECT_DIM * 100}% × ${
          MIN_RECT_DIM * 100
        }%). Drag corners outward or type larger w/h.`,
      });
    }
    if (
      r.x < 0 || r.y < 0 ||
      r.x + r.w > 1 || r.y + r.h > 1
    ) {
      issues.push({
        severity: "error",
        code: "rect-out-of-bounds",
        message: "Rect goes outside the asset. Drag back inside the image.",
      });
    }
  } else {
    const corners = value.perspective.corners;

    // Out-of-bounds check
    const oob = corners.some(
      ([x, y]) => x < 0 || x > 1 || y < 0 || y > 1,
    );
    if (oob) {
      issues.push({
        severity: "error",
        code: "quad-out-of-bounds",
        message:
          "Corner is outside the asset (coords must be 0–100%). Drag corner back inside.",
      });
    }

    // Area check
    const area = polygonArea(corners);
    if (area < MIN_QUAD_AREA) {
      issues.push({
        severity: "error",
        code: "quad-too-small",
        message: `Quad area too small (< ${
          MIN_QUAD_AREA * 100
        }% of asset). Spread corners apart.`,
      });
    }

    // Self-intersecting check (TL→TR vs BR→BL, TR→BR vs BL→TL)
    const tl = corners[0];
    const tr = corners[1];
    const br = corners[2];
    const bl = corners[3];
    const selfX =
      segmentsIntersect(tl, tr, br, bl) ||
      segmentsIntersect(tr, br, bl, tl);
    if (selfX) {
      issues.push({
        severity: "error",
        code: "quad-self-intersecting",
        message:
          "Quad edges cross each other (bowtie shape). Reorder corners — TL/TR/BR/BL must form a non-crossing quad.",
      });
    }

    // Near-collinear / degenerate (only when not self-intersecting; else
    // angle math is meaningless)
    if (!selfX && area >= MIN_QUAD_AREA) {
      const minAngle = minInteriorAngleDeg(corners);
      if (minAngle < 1) {
        issues.push({
          severity: "error",
          code: "quad-degenerate",
          message:
            "Three or more corners are nearly on the same line. Move corners to form a real 4-sided shape.",
        });
      } else if (minAngle < MIN_INTERIOR_ANGLE_DEG) {
        issues.push({
          severity: "warning",
          code: "quad-near-collinear",
          message: `Very narrow corner (${minAngle.toFixed(
            0,
          )}°). Render may be unstable — consider opening the quad.`,
        });
      }
    }
  }

  const ok = issues.every((i) => i.severity !== "error");
  return { ok, issues };
}
