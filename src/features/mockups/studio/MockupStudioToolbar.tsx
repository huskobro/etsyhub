"use client";

/* Phase 77 — Studio toolbar.
 * Phase 79 — Real render dispatch wire.
 *
 * Final HTML "DarkToolbar" → dark studio chrome (38px). Soldan sağa:
 *   - back glyph + brand mark + breadcrumb + template/frame pill
 *     + status badge (set name / "Phase 80+")
 *   - spacer
 *   - undo/redo cluster + Start Over + expand
 *   - Edit / Preview mode tabs
 *   - eye / Saved / Render / Export capsule
 *
 * Phase 79: Render button artık `onRender` callback'i alır (Phase 77'de
 * yalnız appState'i "render"a çekiyordu). MockupStudioShell `onRender`
 * gerçek `POST /api/mockup/jobs` çağrısı yapar + S7 redirect uygular.
 * Frame mode'da disabled + dürüst "Phase 80+" rozeti.
 */

import { StudioBrandMark, StudioIcon } from "./icons";
import type { StudioAppState, StudioMode } from "./types";

export interface MockupStudioToolbarProps {
  mode: StudioMode;
  appState: StudioAppState;
  setAppState: (next: StudioAppState) => void;
  templateLabel: string;
  statusLabel: string;
  backHref: string;
  /** Phase 79 — real render dispatch callback. */
  onRender?: () => void;
  /** Phase 79 — render disabled (no template / loading / frame mode). */
  renderDisabled?: boolean;
  /** Phase 79 — inline error message (last render dispatch failure). */
  renderError?: string | null;
}

export function MockupStudioToolbar({
  mode,
  appState,
  setAppState,
  templateLabel,
  statusLabel,
  backHref,
  onRender,
  renderDisabled,
  renderError,
}: MockupStudioToolbarProps) {
  const isEdit = appState === "working" || appState === "empty";
  const isRendering = appState === "render";
  return (
    <div className="k-studio__toolbar" data-testid="studio-toolbar">
      <div className="k-studio__tb-left">
        <a
          className="k-studio__tb-icon"
          href={backHref}
          aria-label="Back to selection"
          data-testid="studio-toolbar-back"
        >
          <StudioIcon name="arrowL" size={13} />
        </a>
        <StudioBrandMark size={18} />
        <span className="k-studio__tb-crumb">Templates</span>
        <span className="k-studio__tb-crumb" data-dim="true">
          /
        </span>
        <button type="button" className="k-studio__tb-pill" data-testid="studio-toolbar-template-pill">
          {templateLabel}
          <StudioIcon
            name="chevD"
            size={9}
            color="rgba(255,255,255,0.32)"
          />
        </button>
        <span
          className="k-studio__tb-status"
          data-testid="studio-toolbar-status"
        >
          <span className="k-studio__tb-status-dot" />
          {statusLabel}
        </span>
      </div>
      <div className="k-studio__tb-spacer" />
      <div className="k-studio__tb-cluster">
        <button type="button" className="k-studio__tb-icon" aria-label="Undo">
          <StudioIcon name="undo" size={13} />
        </button>
        <button type="button" className="k-studio__tb-icon" aria-label="Redo">
          <StudioIcon name="redo" size={13} />
        </button>
        <span className="k-studio__tb-sep" aria-hidden />
        <button type="button" className="k-studio__tb-icon" data-wide="true">
          Start Over
        </button>
        <button type="button" className="k-studio__tb-icon" aria-label="Expand">
          <StudioIcon name="expand" size={13} />
        </button>
      </div>
      <span className="k-studio__tb-sep" aria-hidden />
      <div
        className="k-studio__mode-tabs"
        role="group"
        aria-label="Edit / Preview"
      >
        <button
          type="button"
          className="k-studio__mode-tab"
          aria-pressed={isEdit}
          onClick={() => setAppState("working")}
          data-testid="studio-toolbar-edit-tab"
        >
          Edit
        </button>
        <button
          type="button"
          className="k-studio__mode-tab"
          aria-pressed={!isEdit}
          onClick={() => setAppState("preview")}
          data-testid="studio-toolbar-preview-tab"
        >
          Preview
        </button>
      </div>
      <span className="k-studio__tb-sep" aria-hidden />
      <button type="button" className="k-studio__tb-icon" aria-label="Eye">
        <StudioIcon name="eye" size={13} />
      </button>
      <button
        type="button"
        className="k-studio__tb-icon"
        data-wide="true"
        data-testid="studio-toolbar-saved"
      >
        <StudioIcon
          name="check"
          size={11}
          color="rgba(130,210,155,0.75)"
        />
        Saved
      </button>
      <button
        type="button"
        className="k-studio__tb-icon"
        data-wide="true"
        onClick={() => {
          if (renderDisabled || isRendering) return;
          if (onRender) onRender();
          else setAppState("render");
        }}
        disabled={renderDisabled || isRendering}
        data-testid="studio-toolbar-render"
        data-render-disabled={renderDisabled ? "true" : "false"}
        title={
          renderError
            ? `Last render failed: ${renderError}`
            : renderDisabled
              ? mode === "frame"
                ? "Frame mode render — coming Phase 80+"
                : "Loading or no template selected"
              : "Render mockup pack"
        }
      >
        <StudioIcon name="retry" size={11} />
        {isRendering ? "Rendering…" : "Render"}
      </button>
      {renderError ? (
        <span
          className="k-studio__tb-error"
          data-testid="studio-toolbar-render-error"
          role="alert"
        >
          {renderError}
        </span>
      ) : null}
      <button
        type="button"
        className="k-studio__export-cap"
        data-testid="studio-toolbar-export"
        disabled={mode === "frame"}
        title={
          mode === "frame"
            ? "Frame export pipeline — coming Phase 80+"
            : "Export · 1× · PNG"
        }
      >
        <StudioIcon name="upload" size={11} />
        Export · 1× · PNG
      </button>
    </div>
  );
}
