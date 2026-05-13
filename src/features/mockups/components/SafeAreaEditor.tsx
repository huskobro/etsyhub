"use client";
/* eslint-disable no-restricted-syntax */
// SVG context'inde fill/stroke renk attribute'ları + cursor inline style gerçek
// requirement; Tailwind token / CSS variable SVG attribute olarak sınırlı destekli.
// Kivasy DS palette'ten hex değerler (#e85d25 = k-orange, rgba(22,19,15,0.45) = ink/45)
// canonical token'larla aynı renk; yalnız SVG render zorunluluğu için inline.

/**
 * Phase 67 — Visual SafeArea editor (rect mode, first slice).
 * Phase 68 — Perspective quad mode added (4-corner authoring).
 *
 * Operatör base asset üzerinde safe-area'yı görsel olarak tanımlar.
 * İki mod:
 *   - rect: Phase 67 baseline (8 handle, axis-aligned rect)
 *   - perspective: Phase 68 yeni (4 corner handle, yamuk quad)
 *
 * Her iki mod aynı uploaded asset üzerinde çalışır; operator k-segment
 * mode toggle ile geçer. Mode değiştiğinde mevcut karar otomatik
 * dönüştürülür (rect→perspective: 4 köşe; perspective→rect: bounding box)
 * — operator boş canvas'ta başlamaz, kararı kaybetmez.
 *
 * Çıktı schema (SafeAreaSchema discriminated union):
 *   - rect: { type: "rect", x, y, w, h }  (Phase 67)
 *   - perspective: { type: "perspective", corners: [[x,y]×4] }  (Phase 68)
 *
 * Corner sırası (schema + Phase 63 placePerspective ile birebir):
 *   [TL, TR, BR, BL] — clockwise from top-left
 *
 * Backend uyumu (Phase 63 placePerspective):
 *   - 4-corner DLT homography
 *   - Inverse warp + bilinear interpolation
 *   - Alpha-aware (quad dışı transparent)
 *
 * Coordinate system:
 *   - SVG viewBox = base asset pixel dimensions (e.g., 1024×1024)
 *   - Pointer events use SVG's native coordinate transform
 *   - Output normalized to 0..1 on emit (schema invariant)
 *
 * Phase 68 scope (perspective):
 *   - 4 corner handles (TL/TR/BR/BL — schema order)
 *   - Drag corner → moves only that corner (free quad)
 *   - Polygon overlay (instead of rect overlay)
 *   - Mode auto-conversion (rect↔perspective preserves visual area)
 *   - Numeric override 8 inputs (x/y per corner)
 *
 * Out of scope (Phase 69+ candidate):
 *   - Polygon validity guard (operator can produce concave/self-intersecting
 *     quad; backend DLT solver throws "singular matrix" gracefully —
 *     UI should surface this as actionable validation)
 *   - Snap-to-grid / pixel-grid alignment
 *   - Aspect-ratio lock
 *   - Multi-rect/multi-quad templates
 */

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";

export type SafeAreaRect = {
  /** Normalized 0..1, top-left origin */
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Phase 68 — Perspective corners in [TL, TR, BR, BL] order, normalized 0..1.
 *  Matches Phase 63 placePerspective backend + SafeAreaPerspectiveSchema. */
export type SafeAreaPerspective = {
  corners: [
    [number, number], // TL
    [number, number], // TR
    [number, number], // BR
    [number, number], // BL
  ];
};

export type SafeAreaMode = "rect" | "perspective";

/** Discriminated union for SafeAreaEditor value (schema parity). */
export type SafeAreaValue =
  | { mode: "rect"; rect: SafeAreaRect }
  | { mode: "perspective"; perspective: SafeAreaPerspective };

type RectHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type PerspectiveCornerIdx = 0 | 1 | 2 | 3;

type DragMode =
  | { kind: "none" }
  | {
      kind: "translate-rect";
      startX: number;
      startY: number;
      startRect: SafeAreaRect;
    }
  | {
      kind: "resize-rect";
      handle: RectHandle;
      startX: number;
      startY: number;
      startRect: SafeAreaRect;
    }
  | {
      kind: "drag-corner";
      cornerIdx: PerspectiveCornerIdx;
      startX: number;
      startY: number;
      startCorners: SafeAreaPerspective["corners"];
    };

const MIN_DIMENSION = 0.05;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Convert rect → perspective by mapping 4 corners (TL/TR/BR/BL). */
export function rectToPerspective(rect: SafeAreaRect): SafeAreaPerspective {
  const x1 = rect.x;
  const x2 = rect.x + rect.w;
  const y1 = rect.y;
  const y2 = rect.y + rect.h;
  return {
    corners: [
      [x1, y1], // TL
      [x2, y1], // TR
      [x2, y2], // BR
      [x1, y2], // BL
    ],
  };
}

/** Convert perspective → rect by axis-aligned bounding box. */
export function perspectiveToRect(p: SafeAreaPerspective): SafeAreaRect {
  const xs = p.corners.map((c) => c[0]);
  const ys = p.corners.map((c) => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    w: Math.max(MIN_DIMENSION, maxX - minX),
    h: Math.max(MIN_DIMENSION, maxY - minY),
  };
}

const CORNER_LABELS = ["TL", "TR", "BR", "BL"] as const;

export type SafeAreaEditorProps = {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  value: SafeAreaValue;
  onChange: (next: SafeAreaValue) => void;
  disabled?: boolean;
};

export function SafeAreaEditor({
  imageUrl,
  imageWidth,
  imageHeight,
  value,
  onChange,
  disabled = false,
}: SafeAreaEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>({ kind: "none" });

  const toNormalizedCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const local = pt.matrixTransform(ctm.inverse());
      return {
        x: clamp(local.x / imageWidth, 0, 1),
        y: clamp(local.y / imageHeight, 0, 1),
      };
    },
    [imageWidth, imageHeight],
  );

  const handlePointerDown = useCallback(
    (
      e: React.PointerEvent<SVGElement>,
      mode: Exclude<DragMode, { kind: "none" }>,
    ) => {
      if (disabled) return;
      e.stopPropagation();
      e.preventDefault();
      const target = e.currentTarget as SVGElement;
      target.setPointerCapture(e.pointerId);
      setDragMode(mode);
    },
    [disabled],
  );

  useEffect(() => {
    if (dragMode.kind === "none") return;

    const onMove = (e: PointerEvent) => {
      const coords = toNormalizedCoords(e.clientX, e.clientY);
      if (!coords) return;

      if (dragMode.kind === "translate-rect" && value.mode === "rect") {
        const dx = coords.x - dragMode.startX;
        const dy = coords.y - dragMode.startY;
        onChange({
          mode: "rect",
          rect: {
            x: clamp(dragMode.startRect.x + dx, 0, 1 - dragMode.startRect.w),
            y: clamp(dragMode.startRect.y + dy, 0, 1 - dragMode.startRect.h),
            w: dragMode.startRect.w,
            h: dragMode.startRect.h,
          },
        });
        return;
      }

      if (dragMode.kind === "resize-rect" && value.mode === "rect") {
        const start = dragMode.startRect;
        const dx = coords.x - dragMode.startX;
        const dy = coords.y - dragMode.startY;
        let { x, y, w, h } = start;
        const handle = dragMode.handle;

        if (handle === "nw" || handle === "w" || handle === "sw") {
          const newX = clamp(start.x + dx, 0, start.x + start.w - MIN_DIMENSION);
          w = start.x + start.w - newX;
          x = newX;
        }
        if (handle === "ne" || handle === "e" || handle === "se") {
          w = clamp(start.w + dx, MIN_DIMENSION, 1 - start.x);
        }
        if (handle === "nw" || handle === "n" || handle === "ne") {
          const newY = clamp(start.y + dy, 0, start.y + start.h - MIN_DIMENSION);
          h = start.y + start.h - newY;
          y = newY;
        }
        if (handle === "sw" || handle === "s" || handle === "se") {
          h = clamp(start.h + dy, MIN_DIMENSION, 1 - start.y);
        }
        onChange({ mode: "rect", rect: { x, y, w, h } });
        return;
      }

      if (
        dragMode.kind === "drag-corner" &&
        value.mode === "perspective"
      ) {
        // Phase 68 — Move single corner; other 3 stay put.
        const dx = coords.x - dragMode.startX;
        const dy = coords.y - dragMode.startY;
        const idx = dragMode.cornerIdx;
        const startC = dragMode.startCorners[idx];
        const newCorner: [number, number] = [
          clamp(startC[0] + dx, 0, 1),
          clamp(startC[1] + dy, 0, 1),
        ];
        const nextCorners: SafeAreaPerspective["corners"] = [
          ...dragMode.startCorners,
        ] as SafeAreaPerspective["corners"];
        nextCorners[idx] = newCorner;
        onChange({
          mode: "perspective",
          perspective: { corners: nextCorners },
        });
      }
    };

    const onUp = () => setDragMode({ kind: "none" });

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragMode, onChange, toNormalizedCoords, value.mode]);

  const handleSize = Math.max(imageWidth, imageHeight) * 0.025;
  const strokeW = Math.max(imageWidth, imageHeight) * 0.003;
  const handleStrokeW = Math.max(imageWidth, imageHeight) * 0.002;

  // ─────────────────────────────────────────────────────────────
  // Mode-aware overlay + handles
  // ─────────────────────────────────────────────────────────────
  let overlayElements: ReactNode = null;

  if (value.mode === "rect") {
    const { x, y, w, h } = value.rect;
    const pxX = x * imageWidth;
    const pxY = y * imageHeight;
    const pxW = w * imageWidth;
    const pxH = h * imageHeight;

    overlayElements = (
      <>
        {/* Dimming overlay: 4 rects outside safe-area */}
        <rect x={0} y={0} width={imageWidth} height={pxY} fill="rgba(22,19,15,0.45)" pointerEvents="none" />
        <rect x={0} y={pxY + pxH} width={imageWidth} height={imageHeight - pxY - pxH} fill="rgba(22,19,15,0.45)" pointerEvents="none" />
        <rect x={0} y={pxY} width={pxX} height={pxH} fill="rgba(22,19,15,0.45)" pointerEvents="none" />
        <rect x={pxX + pxW} y={pxY} width={imageWidth - pxX - pxW} height={pxH} fill="rgba(22,19,15,0.45)" pointerEvents="none" />

        {/* Rect body — drag to translate */}
        <rect
          x={pxX}
          y={pxY}
          width={pxW}
          height={pxH}
          fill="rgba(232,93,37,0.08)"
          stroke="#e85d25"
          strokeWidth={strokeW}
          style={{ cursor: disabled ? "not-allowed" : "grab" }}
          onPointerDown={(e) => {
            const coords = toNormalizedCoords(e.clientX, e.clientY);
            if (!coords) return;
            handlePointerDown(e, {
              kind: "translate-rect",
              startX: coords.x,
              startY: coords.y,
              startRect: value.rect,
            });
          }}
          data-testid="safe-area-editor-rect"
        />

        {/* 8 handles */}
        {(
          [
            { handle: "nw", x: pxX, y: pxY, cursor: "nwse-resize" },
            { handle: "n", x: pxX + pxW / 2, y: pxY, cursor: "ns-resize" },
            { handle: "ne", x: pxX + pxW, y: pxY, cursor: "nesw-resize" },
            { handle: "e", x: pxX + pxW, y: pxY + pxH / 2, cursor: "ew-resize" },
            { handle: "se", x: pxX + pxW, y: pxY + pxH, cursor: "nwse-resize" },
            { handle: "s", x: pxX + pxW / 2, y: pxY + pxH, cursor: "ns-resize" },
            { handle: "sw", x: pxX, y: pxY + pxH, cursor: "nesw-resize" },
            { handle: "w", x: pxX, y: pxY + pxH / 2, cursor: "ew-resize" },
          ] as const
        ).map(({ handle, x: hx, y: hy, cursor }) => (
          <rect
            key={handle}
            x={hx - handleSize / 2}
            y={hy - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="#ffffff"
            stroke="#e85d25"
            strokeWidth={handleStrokeW}
            style={{ cursor: disabled ? "not-allowed" : cursor }}
            onPointerDown={(e) => {
              const coords = toNormalizedCoords(e.clientX, e.clientY);
              if (!coords) return;
              handlePointerDown(e, {
                kind: "resize-rect",
                handle,
                startX: coords.x,
                startY: coords.y,
                startRect: value.rect,
              });
            }}
            data-testid={`safe-area-editor-handle-${handle}`}
          />
        ))}
      </>
    );
  } else {
    // Perspective mode (Phase 68)
    const corners = value.perspective.corners;
    const pxCorners: Array<[number, number]> = corners.map(([nx, ny]) => [
      nx * imageWidth,
      ny * imageHeight,
    ]);
    const polygonPoints = pxCorners.map(([px, py]) => `${px},${py}`).join(" ");

    overlayElements = (
      <>
        {/* Polygon dimming overlay (entire image dimmed; clipped polygon revealed).
            Use SVG mask to dim outside polygon. */}
        <defs>
          <mask id="perspective-dimming-mask">
            <rect x={0} y={0} width={imageWidth} height={imageHeight} fill="white" />
            <polygon points={polygonPoints} fill="black" />
          </mask>
        </defs>
        <rect
          x={0}
          y={0}
          width={imageWidth}
          height={imageHeight}
          fill="rgba(22,19,15,0.45)"
          mask="url(#perspective-dimming-mask)"
          pointerEvents="none"
        />

        {/* Quad polygon — drag area + visible boundary */}
        <polygon
          points={polygonPoints}
          fill="rgba(232,93,37,0.08)"
          stroke="#e85d25"
          strokeWidth={strokeW}
          pointerEvents="none"
          data-testid="safe-area-editor-quad"
        />

        {/* 4 corner handles (TL/TR/BR/BL — schema order) */}
        {pxCorners.map(([cx, cy], idx) => {
          const label = CORNER_LABELS[idx];
          return (
            <g key={label}>
              <circle
                cx={cx}
                cy={cy}
                r={handleSize * 0.7}
                fill="#ffffff"
                stroke="#e85d25"
                strokeWidth={handleStrokeW * 1.5}
                style={{ cursor: disabled ? "not-allowed" : "grab" }}
                onPointerDown={(e) => {
                  const coords = toNormalizedCoords(e.clientX, e.clientY);
                  if (!coords) return;
                  handlePointerDown(e, {
                    kind: "drag-corner",
                    cornerIdx: idx as PerspectiveCornerIdx,
                    startX: coords.x,
                    startY: coords.y,
                    startCorners: corners,
                  });
                }}
                data-testid={`safe-area-editor-corner-${label}`}
              />
              {/* Corner label badge */}
              <text
                x={cx}
                y={cy - handleSize * 1.2}
                fill="#e85d25"
                fontSize={Math.max(imageWidth, imageHeight) * 0.022}
                textAnchor="middle"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
                fontWeight="700"
                pointerEvents="none"
              >
                {label}
              </text>
            </g>
          );
        })}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="safe-area-editor" data-mode={value.mode}>
      <div className="relative w-full overflow-hidden rounded-md border border-line bg-k-bg-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${imageWidth} ${imageHeight}`}
          className="block h-auto w-full select-none"
          style={{
            cursor: disabled
              ? "not-allowed"
              : dragMode.kind === "translate-rect"
                ? "grabbing"
                : "default",
          }}
          aria-label={
            value.mode === "rect"
              ? "Rect safe-area editor — drag to position, drag corners to resize"
              : "Perspective safe-area editor — drag the 4 corners to define a quad"
          }
          role="application"
        >
          <image
            href={imageUrl}
            x={0}
            y={0}
            width={imageWidth}
            height={imageHeight}
            preserveAspectRatio="none"
            data-testid="safe-area-editor-image"
          />
          {overlayElements}
        </svg>
      </div>

      {/* Numeric overrides — mode-aware */}
      {value.mode === "rect" ? (
        <div className="grid grid-cols-4 gap-2">
          {(["x", "y", "w", "h"] as const).map((field) => (
            <label key={field} className="flex flex-col gap-1">
              <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                {field} %
              </span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={Math.round(value.rect[field] * 1000) / 10}
                disabled={disabled}
                onChange={(e) => {
                  const raw = Number.parseFloat(e.target.value);
                  if (Number.isNaN(raw)) return;
                  const next = { ...value.rect };
                  const norm = clamp(raw / 100, 0, 1);
                  if (field === "x") next.x = clamp(norm, 0, 1 - value.rect.w);
                  else if (field === "y") next.y = clamp(norm, 0, 1 - value.rect.h);
                  else if (field === "w") next.w = clamp(norm, MIN_DIMENSION, 1 - value.rect.x);
                  else next.h = clamp(norm, MIN_DIMENSION, 1 - value.rect.y);
                  onChange({ mode: "rect", rect: next });
                }}
                className="h-8 rounded-md border border-line bg-paper px-2 font-mono text-[12px] text-ink focus:border-k-orange focus:outline-none disabled:opacity-50"
                data-testid={`safe-area-editor-input-${field}`}
              />
            </label>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {value.perspective.corners.map((corner, idx) => {
            const label = CORNER_LABELS[idx];
            return (
              <div
                key={label}
                className="flex flex-col gap-1 rounded-md border border-line-soft bg-k-bg-2/40 p-2"
              >
                <span className="font-mono text-[10.5px] uppercase tracking-meta text-k-orange-ink">
                  {label}
                </span>
                {(["x", "y"] as const).map((axis) => {
                  const axisIdx: 0 | 1 = axis === "x" ? 0 : 1;
                  return (
                  <label key={axis} className="flex items-center gap-2">
                    <span className="w-3 font-mono text-[10px] uppercase tracking-meta text-ink-3">
                      {axis}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={Math.round(corner[axisIdx] * 1000) / 10}
                      disabled={disabled}
                      onChange={(e) => {
                        const raw = Number.parseFloat(e.target.value);
                        if (Number.isNaN(raw)) return;
                        const norm = clamp(raw / 100, 0, 1);
                        const newCorner: [number, number] = [corner[0], corner[1]];
                        newCorner[axisIdx] = norm;
                        const nextCorners: SafeAreaPerspective["corners"] = [
                          ...value.perspective.corners,
                        ] as SafeAreaPerspective["corners"];
                        nextCorners[idx] = newCorner;
                        onChange({
                          mode: "perspective",
                          perspective: { corners: nextCorners },
                        });
                      }}
                      className="h-7 w-full rounded-md border border-line bg-paper px-1.5 font-mono text-[11px] text-ink focus:border-k-orange focus:outline-none disabled:opacity-50"
                      data-testid={`safe-area-editor-corner-input-${label}-${axis}`}
                    />
                  </label>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <p className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        {value.mode === "rect"
          ? "Drag rect to position · drag corners or edges to resize · or type exact %"
          : "Drag the 4 corners to define a perspective quad — clockwise from top-left (TL/TR/BR/BL)"}
      </p>
    </div>
  );
}
