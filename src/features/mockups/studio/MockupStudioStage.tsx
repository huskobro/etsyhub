"use client";
/* eslint-disable no-restricted-syntax */

/* Phase 77 — Studio center stage.
 *
 * Final HTML StudioStage paritesi (mode + appState dispatch):
 *   - Mockup mode: device cascade (3 phones, slot ring + dim/lit badge)
 *   - Frame mode: bounded frame canvas (gradient surface + device inside)
 *   - All modes: zoom pill, ambient glow (mockup only), empty caption,
 *     render overlay (spinner), render-done banner (success), edit pill
 *     (preview state)
 *
 * File-level eslint-disable: stage compositions yoğun absolute positioning
 * + drop-shadow filter chains + per-slot transform rotations. Stable
 * recipes studio.css'de namespace-d.
 */

import { StudioIcon } from "./icons";
import {
  PhoneSVG,
  StageDeviceSVG,
  STUDIO_SAMPLE_DESIGNS,
  type StudioStageDeviceKind,
} from "./svg-art";
import type { StudioAppState, StudioMode, StudioSlotMeta } from "./types";

interface MockupCompositionProps {
  slots: ReadonlyArray<StudioSlotMeta>;
  selectedSlot: number;
  onSelect: (i: number) => void;
  isPreview: boolean;
  /** Phase 82 — productType-aware stage shape. Bookmark vertical
   *  strip, wall art frame, sticker die-cut, tshirt silhouette vb.
   *  PhoneSVG hardcoded placeholder Phase 77-81 baseline'da idi;
   *  Phase 82 gerçek surface'i gösterir. Bilinmeyen kategori →
   *  phone fallback (legacy + final HTML parity). */
  deviceKind: StudioStageDeviceKind;
}

/* Phase 82 — Per-device cascade layout. Final HTML telefon 3-phone
 * cascade idi (204×416, 170×346, 140×284); diğer device kind'larda
 * aynı 3-slot cascade kompoze edilir ama her shape'in doğal aspect
 * ratio'su korunur. PhoneSVG kontrat'ı baseline kaldı → wall_art
 * 2:3 portrait, sticker square, bookmark tall-narrow, tshirt body
 * yatay genişlik. Layout sabitleri stage canvas 572×504 boundary
 * içine sığacak şekilde planlandı (mevcut studio.css stage-inner
 * geometrisini bozmaz). */
function cascadeLayoutFor(
  kind: StudioStageDeviceKind,
): { si: number; x: number; y: number; w: number; h: number; r: number; z: number }[] {
  switch (kind) {
    case "wall_art":
    case "canvas":
    case "printable":
      // 2:3 portrait framed surfaces — wider stance
      return [
        { si: 0, x: 30, y: 30, w: 200, h: 280, r: 0, z: 3 },
        { si: 1, x: 230, y: 70, w: 170, h: 240, r: -5, z: 2 },
        { si: 2, x: 400, y: 110, w: 140, h: 200, r: -10, z: 1 },
      ];
    case "sticker":
    case "clipart":
      // Square die-cuts — playful stacked
      return [
        { si: 0, x: 50, y: 70, w: 220, h: 220, r: 0, z: 3 },
        { si: 1, x: 270, y: 110, w: 180, h: 180, r: -6, z: 2 },
        { si: 2, x: 440, y: 160, w: 130, h: 130, r: -12, z: 1 },
      ];
    case "bookmark":
      // Tall narrow strips — pamphlet-like row
      return [
        { si: 0, x: 130, y: 30, w: 90, h: 320, r: 0, z: 3 },
        { si: 1, x: 250, y: 50, w: 78, h: 280, r: -6, z: 2 },
        { si: 2, x: 360, y: 70, w: 64, h: 240, r: -12, z: 1 },
      ];
    case "tshirt":
    case "hoodie":
    case "dtf":
      // Garment silhouettes — wider chest area
      return [
        { si: 0, x: 20, y: 30, w: 220, h: 260, r: 0, z: 3 },
        { si: 1, x: 240, y: 70, w: 190, h: 225, r: -5, z: 2 },
        { si: 2, x: 430, y: 110, w: 150, h: 180, r: -10, z: 1 },
      ];
    case "phone":
    default:
      // Final HTML iPhone cascade (Phase 77 baseline)
      return [
        { si: 0, x: 20, y: 14, w: 204, h: 416, r: 0, z: 3 },
        { si: 1, x: 224, y: 60, w: 170, h: 346, r: -6, z: 2 },
        { si: 2, x: 398, y: 110, w: 140, h: 284, r: -12, z: 1 },
      ];
  }
}

function MockupComposition({
  slots,
  selectedSlot,
  onSelect,
  isPreview,
  deviceKind,
}: MockupCompositionProps) {
  const phones = cascadeLayoutFor(deviceKind);
  return (
    <div
      className="k-studio__stage-inner"
      style={{ width: 572, height: 504 }}
      data-testid="studio-stage-mockup-comp"
    >
      {phones.map(({ si, x, y, w, h, r, z }) => {
        const slot = slots[si];
        if (!slot) return null;
        const isActive = selectedSlot === si && !isPreview;
        const isGhost = !slot.assigned && !isActive;
        const filter = isActive
          ? "drop-shadow(0 32px 64px rgba(0,0,0,0.82)) drop-shadow(0 10px 24px rgba(0,0,0,0.55)) drop-shadow(0 0 36px rgba(232,93,37,0.13))"
          : isGhost
            ? "none"
            : "drop-shadow(0 24px 44px rgba(0,0,0,0.7)) drop-shadow(0 8px 18px rgba(0,0,0,0.45))";
        return (
          <div
            key={si}
            className="k-studio__slot-wrap"
            onClick={() => {
              if (!isPreview) onSelect(si);
            }}
            style={{
              left: x,
              top: y,
              zIndex: z,
              transform: `rotate(${r}deg)`,
              filter,
              opacity: isGhost ? 0.26 : 1,
            }}
            data-testid={`studio-stage-slot-${si}`}
            data-active={isActive ? "true" : "false"}
            data-ghost={isGhost ? "true" : "false"}
          >
            {isActive ? (
              <div className="k-studio__slot-ring" data-on="true" />
            ) : null}
            {!isPreview && !isGhost ? (
              <div
                className="k-studio__slot-badge"
                data-tone={isActive ? "lit" : "dim"}
              >
                {String(slot.id).padStart(2, "0")} {slot.name}
              </div>
            ) : null}
            <StageDeviceSVG
              kind={deviceKind}
              w={w}
              h={h}
              design={slot.assigned ? slot.design : null}
              isEmpty={!slot.assigned}
              idx={si}
            />
            {isGhost && !isPreview ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.18)",
                  fontSize: 16,
                  pointerEvents: "none",
                }}
              >
                +
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

interface FrameCompositionProps {
  isEmpty: boolean;
  isPreview: boolean;
}

function FrameComposition({
  isEmpty,
  isPreview,
  deviceKind,
}: FrameCompositionProps & { deviceKind: StudioStageDeviceKind }) {
  const design = isEmpty ? null : STUDIO_SAMPLE_DESIGNS.d1;
  // Phase 82 — Frame inner device dims per kind. Frame canvas
  // 580×326 (16:9); inner device aspect korunur (wall_art portrait,
  // sticker square, bookmark tall, tshirt body). Bilinmeyen → phone.
  const innerSize =
    deviceKind === "wall_art" || deviceKind === "canvas" || deviceKind === "printable"
      ? { w: 152, h: 220 }
      : deviceKind === "sticker" || deviceKind === "clipart"
        ? { w: 180, h: 180 }
        : deviceKind === "bookmark"
          ? { w: 70, h: 240 }
          : deviceKind === "tshirt" || deviceKind === "hoodie" || deviceKind === "dtf"
            ? { w: 200, h: 240 }
            : { w: 128, h: 260 }; // phone fallback
  return (
    <div
      className="k-studio__stage-inner"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
      data-testid="studio-stage-frame-comp"
    >
      <div
        style={{
          width: 580,
          height: 326,
          background:
            "linear-gradient(145deg,#E4DDD1 0%,#C8C0B4 60%,#D4CCC0 100%)",
          border: isPreview ? "none" : "1px solid rgba(255,255,255,0.06)",
          borderRadius: 4,
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 100%,rgba(0,0,0,0.08) 0%,transparent 60%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            filter:
              "drop-shadow(0 22px 44px rgba(0,0,0,0.22)) drop-shadow(0 8px 16px rgba(0,0,0,0.14))",
            position: "relative",
            zIndex: 2,
          }}
        >
          <StageDeviceSVG
            kind={deviceKind}
            w={innerSize.w}
            h={innerSize.h}
            design={design}
            isEmpty={!design}
            idx={4}
          />
        </div>
      </div>
      {!isPreview ? (
        <div className="k-studio__frame-cap">1920 × 1080 · 16:9</div>
      ) : null}
    </div>
  );
}

export interface MockupStudioStageProps {
  mode: StudioMode;
  slots: ReadonlyArray<StudioSlotMeta>;
  selectedSlot: number;
  setSelectedSlot: (i: number) => void;
  appState: StudioAppState;
  setAppState: (next: StudioAppState) => void;
  /** Phase 79 — render-done banner "Create Mockup" CTA + RenderDone /
   *  re-render. Mockup pipeline POST /api/mockup/jobs trigger. */
  onCreateMockup?: () => void;
  /** Phase 82 — productType-aware stage shape. Shell resolve eder
   *  (selection items[0].productTypeKey) ve Stage'e geçirir. Bookmark
   *  vertical strip, wall art frame, sticker die-cut, tshirt
   *  silhouette vb. Bilinmeyen → phone fallback. */
  deviceKind: StudioStageDeviceKind;
}

export function MockupStudioStage({
  mode,
  slots,
  selectedSlot,
  setSelectedSlot,
  appState,
  setAppState,
  onCreateMockup,
  deviceKind,
}: MockupStudioStageProps) {
  const isPreview = appState === "preview" || appState === "renderDone";
  const isRender = appState === "render";
  const isEmpty = appState === "empty";

  return (
    <div
      className="k-studio__stage"
      data-testid="studio-stage"
      data-mode={mode}
      data-state={appState}
      data-device-kind={deviceKind}
    >
      {!isRender && mode === "mockup" ? (
        <div className="k-studio__stage-amb" />
      ) : null}

      {mode === "mockup" ? (
        <MockupComposition
          slots={slots}
          selectedSlot={selectedSlot}
          onSelect={setSelectedSlot}
          isPreview={isPreview}
          deviceKind={deviceKind}
        />
      ) : (
        <FrameComposition
          isEmpty={isEmpty}
          isPreview={isPreview}
          deviceKind={deviceKind}
        />
      )}

      {isEmpty && !isPreview && !isRender ? (
        <div
          className="k-studio__empty-cap"
          data-testid="studio-stage-empty-cap"
        >
          {mode === "mockup"
            ? "Drop media in the panel to begin"
            : "Select a background to start your frame"}
        </div>
      ) : null}

      {isRender ? (
        <div className="k-studio__render-ov" data-testid="studio-stage-render-overlay">
          <div className="k-studio__spinner" />
          <span className="k-studio__render-cap">Rendering…</span>
          <span className="k-studio__render-sub">
            4096 × 4096 · 3 variants
          </span>
          <button
            type="button"
            className="k-studio__render-cancel"
            onClick={() => setAppState("renderDone")}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {appState === "renderDone" ? (
        <div
          className="k-studio__render-banner"
          data-testid="studio-stage-render-banner"
        >
          <StudioIcon
            name="check"
            size={13}
            color="rgba(135,215,165,0.9)"
          />
          <span className="k-studio__render-banner-text">
            Render ready · 4096×4096 · 3 variants · 1.4s
          </span>
          <button type="button" className="k-studio__render-action">
            <StudioIcon name="download" size={11} />
            Download
          </button>
          <button
            type="button"
            className="k-studio__render-action"
            data-primary="true"
            onClick={() => {
              if (mode === "frame") return;
              if (onCreateMockup) onCreateMockup();
            }}
            disabled={mode === "frame" || !onCreateMockup}
            data-testid="studio-stage-create-mockup"
            title={
              mode === "frame"
                ? "Frame output — coming Phase 80+"
                : "Render another mockup pack"
            }
          >
            Create {mode === "frame" ? "Frame" : "Mockup"}
          </button>
        </div>
      ) : null}

      {isPreview ? (
        <button
          type="button"
          className="k-studio__edit-pill"
          onClick={() => setAppState("working")}
          data-testid="studio-stage-edit-pill"
        >
          <StudioIcon
            name="arrowL"
            size={11}
            color="rgba(255,255,255,0.38)"
          />
          Back to Edit
        </button>
      ) : null}

      {!isRender ? (
        <div className="k-studio__zoom-pill" data-testid="studio-stage-zoom-pill">
          <button type="button" className="k-studio__zp-btn" aria-label="Zoom out">
            −
          </button>
          <span className="k-studio__zp-val">50%</span>
          <button type="button" className="k-studio__zp-btn" aria-label="Zoom in">
            +
          </button>
          <button type="button" className="k-studio__zp-fit">
            <StudioIcon name="mountain" size={10} />
            Fit
          </button>
        </div>
      ) : null}
    </div>
  );
}
