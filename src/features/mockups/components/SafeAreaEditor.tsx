"use client";

/**
 * Phase 67 — Visual SafeArea editor (rect mode, first slice).
 *
 * Operatör base asset üzerinde safe-area rect'ini görsel olarak
 * tanımlar. Phase 66'dan farkı: text input yerine drag/resize
 * affordance + canlı preview overlay.
 *
 * Pattern (canonical Templated.io / mockup studio pattern parity):
 *   - Background: uploaded base asset image (signed URL)
 *   - Overlay: SVG rect with k-orange border + 4 corner handles + 4 edge handles
 *   - Drag rect body → translate (clamped to image bounds)
 *   - Drag corner handle → resize (clamped, min 5% of dimension)
 *   - Drag edge handle → 1-axis resize
 *   - Output: SafeAreaRect normalized 0..1 (matches schema SafeAreaRectSchema)
 *
 * Coordinate system:
 *   - SVG viewBox = base asset pixel dimensions (e.g., 1024×1024)
 *   - Pointer events use SVG's native coordinate transform
 *   - Output normalized to 0..1 on emit (schema invariant)
 *
 * Phase 67 scope:
 *   - rect mode only (perspective quad editor = Phase 68 candidate;
 *     Phase 63 placePerspective backend hazır, UI ayrı tur)
 *   - 8 handles (4 corners + 4 edges)
 *   - Touch device pointer events (pointerdown/move/up)
 *   - Min/max bounds (keep rect inside image, min 5% size)
 *
 * a11y:
 *   - SVG rect has role="application" + aria-label describing safe-area
 *   - Numeric override input below editor (operator can type exact %)
 *
 * Out of scope (deferred):
 *   - Snap-to-grid / pixel-grid alignment
 *   - Aspect-ratio lock (rect always free-form; aspect-ratio chip in form)
 *   - Rotation (SafeAreaRectSchema supports rotation field but UI deferred)
 *   - Multi-rect templates (single safe-area only — schema is single rect)
 */

import { useEffect, useRef, useState, useCallback } from "react";

export type SafeAreaRect = {
  /** Normalized 0..1, top-left origin */
  x: number;
  y: number;
  w: number;
  h: number;
};

type DragMode =
  | { kind: "none" }
  | { kind: "translate"; startX: number; startY: number; startRect: SafeAreaRect }
  | {
      kind: "resize";
      handle:
        | "nw"
        | "n"
        | "ne"
        | "e"
        | "se"
        | "s"
        | "sw"
        | "w";
      startX: number;
      startY: number;
      startRect: SafeAreaRect;
    };

const MIN_DIMENSION = 0.05; // 5% min rect width/height

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type SafeAreaEditorProps = {
  /** Signed URL to base asset image */
  imageUrl: string;
  /** Image natural dimensions (used for SVG viewBox) */
  imageWidth: number;
  imageHeight: number;
  /** Current safe-area (controlled — parent owns state) */
  value: SafeAreaRect;
  onChange: (next: SafeAreaRect) => void;
  /** Optional disabled state (during upload, etc.) */
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

  /* Convert pointer event → SVG normalized 0..1 coords.
   * SVG getScreenCTM() handles all transforms (zoom, scroll, etc.). */
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

      if (dragMode.kind === "translate") {
        const dx = coords.x - dragMode.startX;
        const dy = coords.y - dragMode.startY;
        const next: SafeAreaRect = {
          x: clamp(dragMode.startRect.x + dx, 0, 1 - dragMode.startRect.w),
          y: clamp(dragMode.startRect.y + dy, 0, 1 - dragMode.startRect.h),
          w: dragMode.startRect.w,
          h: dragMode.startRect.h,
        };
        onChange(next);
        return;
      }

      if (dragMode.kind === "resize") {
        const start = dragMode.startRect;
        const dx = coords.x - dragMode.startX;
        const dy = coords.y - dragMode.startY;

        let { x, y, w, h } = start;
        const handle = dragMode.handle;

        // West-side handles: move x, shrink/grow w
        if (handle === "nw" || handle === "w" || handle === "sw") {
          const newX = clamp(start.x + dx, 0, start.x + start.w - MIN_DIMENSION);
          w = start.x + start.w - newX;
          x = newX;
        }
        // East-side handles: just adjust w
        if (handle === "ne" || handle === "e" || handle === "se") {
          w = clamp(start.w + dx, MIN_DIMENSION, 1 - start.x);
        }
        // North-side handles: move y, shrink/grow h
        if (handle === "nw" || handle === "n" || handle === "ne") {
          const newY = clamp(start.y + dy, 0, start.y + start.h - MIN_DIMENSION);
          h = start.y + start.h - newY;
          y = newY;
        }
        // South-side handles: just adjust h
        if (handle === "sw" || handle === "s" || handle === "se") {
          h = clamp(start.h + dy, MIN_DIMENSION, 1 - start.y);
        }

        onChange({ x, y, w, h });
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
  }, [dragMode, onChange, toNormalizedCoords]);

  // Pixel coords for rendering
  const pxX = value.x * imageWidth;
  const pxY = value.y * imageHeight;
  const pxW = value.w * imageWidth;
  const pxH = value.h * imageHeight;

  // Handle size in SVG pixel units (proportional to image)
  const handleSize = Math.max(imageWidth, imageHeight) * 0.025;

  return (
    <div className="flex flex-col gap-3" data-testid="safe-area-editor">
      <div className="relative w-full overflow-hidden rounded-md border border-line bg-k-bg-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${imageWidth} ${imageHeight}`}
          className="block h-auto w-full select-none"
          style={{
            cursor: disabled
              ? "not-allowed"
              : dragMode.kind === "translate"
                ? "grabbing"
                : "default",
          }}
          aria-label="Safe-area editor — drag to position, drag corners to resize"
          role="application"
        >
          {/* Background: uploaded base asset */}
          <image
            href={imageUrl}
            x={0}
            y={0}
            width={imageWidth}
            height={imageHeight}
            preserveAspectRatio="none"
            data-testid="safe-area-editor-image"
          />

          {/* Dimming overlay outside safe-area (4 rectangles) */}
          {/* Top */}
          <rect
            x={0}
            y={0}
            width={imageWidth}
            height={pxY}
            fill="rgba(22,19,15,0.45)"
            pointerEvents="none"
          />
          {/* Bottom */}
          <rect
            x={0}
            y={pxY + pxH}
            width={imageWidth}
            height={imageHeight - pxY - pxH}
            fill="rgba(22,19,15,0.45)"
            pointerEvents="none"
          />
          {/* Left */}
          <rect
            x={0}
            y={pxY}
            width={pxX}
            height={pxH}
            fill="rgba(22,19,15,0.45)"
            pointerEvents="none"
          />
          {/* Right */}
          <rect
            x={pxX + pxW}
            y={pxY}
            width={imageWidth - pxX - pxW}
            height={pxH}
            fill="rgba(22,19,15,0.45)"
            pointerEvents="none"
          />

          {/* Safe-area rect (drag body to translate) */}
          <rect
            x={pxX}
            y={pxY}
            width={pxW}
            height={pxH}
            fill="rgba(232,93,37,0.08)"
            stroke="#e85d25"
            strokeWidth={Math.max(imageWidth, imageHeight) * 0.003}
            style={{ cursor: disabled ? "not-allowed" : "grab" }}
            onPointerDown={(e) => {
              const coords = toNormalizedCoords(e.clientX, e.clientY);
              if (!coords) return;
              handlePointerDown(e, {
                kind: "translate",
                startX: coords.x,
                startY: coords.y,
                startRect: value,
              });
            }}
            data-testid="safe-area-editor-rect"
          />

          {/* 8 resize handles */}
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
          ).map(({ handle, x, y, cursor }) => (
            <rect
              key={handle}
              x={x - handleSize / 2}
              y={y - handleSize / 2}
              width={handleSize}
              height={handleSize}
              fill="#ffffff"
              stroke="#e85d25"
              strokeWidth={Math.max(imageWidth, imageHeight) * 0.002}
              style={{ cursor: disabled ? "not-allowed" : cursor }}
              onPointerDown={(e) => {
                const coords = toNormalizedCoords(e.clientX, e.clientY);
                if (!coords) return;
                handlePointerDown(e, {
                  kind: "resize",
                  handle,
                  startX: coords.x,
                  startY: coords.y,
                  startRect: value,
                });
              }}
              data-testid={`safe-area-editor-handle-${handle}`}
            />
          ))}
        </svg>
      </div>

      {/* Numeric overrides + readout (operator can type exact values) */}
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
              value={Math.round(value[field] * 1000) / 10}
              disabled={disabled}
              onChange={(e) => {
                const raw = Number.parseFloat(e.target.value);
                if (Number.isNaN(raw)) return;
                const next = { ...value };
                const norm = clamp(raw / 100, 0, 1);
                if (field === "x") {
                  next.x = clamp(norm, 0, 1 - value.w);
                } else if (field === "y") {
                  next.y = clamp(norm, 0, 1 - value.h);
                } else if (field === "w") {
                  next.w = clamp(norm, MIN_DIMENSION, 1 - value.x);
                } else {
                  next.h = clamp(norm, MIN_DIMENSION, 1 - value.y);
                }
                onChange(next);
              }}
              className="h-8 rounded-md border border-line bg-paper px-2 font-mono text-[12px] text-ink focus:border-k-orange focus:outline-none disabled:opacity-50"
              data-testid={`safe-area-editor-input-${field}`}
            />
          </label>
        ))}
      </div>
      <p className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        Drag rect to position · drag corners or edges to resize · or type exact %
      </p>
    </div>
  );
}
