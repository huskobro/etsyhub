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
  /** Phase 99 — Frame mode export dispatch callback (POST
   *  /api/frame/export). Yalnız Frame mode'da aktif; Mockup mode
   *  export capsule disabled (Render button mockup pack pipeline'ı
   *  kullanır). */
  onExportFrame?: () => void;
  /** Phase 99 — Frame export disabled (no assigned slot / loading). */
  exportDisabled?: boolean;
  /** Phase 99 — Frame export in progress. */
  isExporting?: boolean;
  /** Phase 99 — Frame export error (last dispatch failure). */
  exportError?: string | null;
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
  onExportFrame,
  exportDisabled,
  isExporting,
  exportError,
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
                ? "Frame mode is a presentation surface — render lives in Mockup mode. Export pipeline Phase 82+"
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
      {/* Phase 99 — Export capsule.
       *
       * Mockup mode: disabled (mockup pack pipeline Render button
       *   üzerinden; mockup result S7/S8 result view download'u
       *   sunar). Frame mode'a özel export çekirdeği Phase 99'da
       *   açıldı.
       * Frame mode: aktif (Sözleşme #11 + #13.C fulfilled).
       *   onExportFrame Shell tarafından POST /api/frame/export'a
       *   dispatch eder; result panel sidebar/stage altında signed
       *   download URL gösterir. */}
      <button
        type="button"
        className="k-studio__export-cap"
        data-testid="studio-toolbar-export"
        disabled={
          mode === "frame"
            ? (exportDisabled ?? false) || (isExporting ?? false)
            : true
        }
        onClick={() => {
          if (mode !== "frame") return;
          if (exportDisabled || isExporting) return;
          onExportFrame?.();
        }}
        title={
          mode === "frame"
            ? exportError
              ? `Last export failed: ${exportError}`
              : exportDisabled
                ? "No assigned slots yet — pick at least one kept item to export"
                : isExporting
                  ? "Exporting…"
                  : "Export Frame · PNG"
            : "Frame export lives in Frame mode (Render button on Mockup mode runs the mockup pack)"
        }
        data-mode={mode}
        data-state={
          isExporting ? "exporting" : exportError ? "error" : "ready"
        }
      >
        <StudioIcon name="upload" size={11} />
        {mode === "frame"
          ? isExporting
            ? "Exporting…"
            : "Export · 1× · PNG"
          : "Export · 1× · PNG"}
      </button>
      {mode === "frame" && exportError ? (
        <span
          className="k-studio__tb-error"
          data-testid="studio-toolbar-export-error"
          role="alert"
        >
          {exportError}
        </span>
      ) : null}
    </div>
  );
}
