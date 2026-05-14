/* eslint-disable no-restricted-syntax */
// Phase 99 — Frame export result banner.
//
// File-level eslint-disable: Studio dark shell inline style yoğun
// (Sidebar / Stage / svg-art aynı pattern). Banner bottom-center
// floating, mode-aware (yalnız Frame mode), real PNG signed URL +
// scene snapshot drift indicator. Sözleşme #11 + #13.C fulfilled.

"use client";

import type { ReactNode } from "react";

export interface FrameExportResultSnapshot {
  mode: string;
  glassVariant?: string;
  lensBlur?: boolean;
  frameAspect: string;
}

export interface FrameExportResultBannerProps {
  result: {
    downloadUrl: string;
    storageKey: string;
    width: number;
    height: number;
    sizeBytes: number;
    exportId: string;
    durationMs: number;
    sceneSnapshot: FrameExportResultSnapshot;
  };
  currentSceneSnapshot: FrameExportResultSnapshot;
  onClose: () => void;
  onReexport: () => void;
  isExporting: boolean;
}

export function FrameExportResultBanner({
  result,
  currentSceneSnapshot,
  onClose,
  onReexport,
  isExporting,
}: FrameExportResultBannerProps): ReactNode {
  const sizeKb = (result.sizeBytes / 1024).toFixed(1);
  const isStale =
    currentSceneSnapshot.mode !== result.sceneSnapshot.mode ||
    currentSceneSnapshot.glassVariant !== result.sceneSnapshot.glassVariant ||
    !!currentSceneSnapshot.lensBlur !== !!result.sceneSnapshot.lensBlur ||
    currentSceneSnapshot.frameAspect !== result.sceneSnapshot.frameAspect;
  const filename = `kivasy-frame-${result.exportId.slice(0, 8)}-${result.width}x${result.height}.png`;
  return (
    <div
      data-testid="studio-frame-export-result"
      data-stale={isStale ? "true" : "false"}
      style={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        minWidth: 460,
        maxWidth: 640,
        zIndex: 20,
        background: "rgba(28,25,22,0.92)",
        backdropFilter: "blur(16px) saturate(1.2)",
        WebkitBackdropFilter: "blur(16px) saturate(1.2)",
        border: "1px solid rgba(232,93,37,0.35)",
        boxShadow:
          "0 24px 60px -16px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <img
        src={result.downloadUrl}
        alt={`Frame export ${result.width}×${result.height}`}
        width={60}
        height={Math.round(60 * (result.height / result.width))}
        style={{
          borderRadius: 5,
          border: "1px solid rgba(255,255,255,0.12)",
          flexShrink: 0,
          background: "rgba(0,0,0,0.4)",
          objectFit: "cover",
        }}
        data-testid="studio-frame-export-thumb"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--ks-fm)",
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: isStale ? "var(--ks-or)" : "rgba(255,255,255,0.55)",
            marginBottom: 2,
          }}
          data-testid="studio-frame-export-status"
        >
          {isStale ? "Preview changed · re-export?" : "Frame exported · ready"}
        </div>
        <div
          style={{
            fontFamily: "var(--ks-fm)",
            fontSize: 11,
            color: "var(--ks-t1)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
          data-testid="studio-frame-export-meta"
        >
          <span>
            {result.width}×{result.height}
          </span>
          <span style={{ color: "rgba(255,255,255,0.32)" }}>·</span>
          <span>{sizeKb} KB</span>
          <span style={{ color: "rgba(255,255,255,0.32)" }}>·</span>
          <span>{result.durationMs} ms</span>
        </div>
      </div>
      <a
        href={result.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="studio-frame-export-open"
        style={{
          padding: "6px 10px",
          borderRadius: 5,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "var(--ks-t1)",
          fontFamily: "var(--ks-fm)",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}
      >
        Open
      </a>
      <a
        href={result.downloadUrl}
        download={filename}
        data-testid="studio-frame-export-download"
        style={{
          padding: "6px 12px",
          borderRadius: 5,
          background: "var(--ks-or)",
          border: "1px solid rgba(232,93,37,0.85)",
          color: "#1a1410",
          fontFamily: "var(--ks-fm)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}
      >
        Download
      </a>
      {isStale ? (
        <button
          type="button"
          onClick={onReexport}
          disabled={isExporting}
          data-testid="studio-frame-export-reexport"
          style={{
            padding: "6px 10px",
            borderRadius: 5,
            background: "rgba(232,93,37,0.16)",
            border: "1px solid rgba(232,93,37,0.45)",
            color: "var(--ks-or)",
            fontFamily: "var(--ks-fm)",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: isExporting ? "not-allowed" : "pointer",
          }}
        >
          {isExporting ? "Exporting…" : "Re-export"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close export result"
        data-testid="studio-frame-export-close"
        style={{
          padding: "4px 8px",
          borderRadius: 4,
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "rgba(255,255,255,0.55)",
          fontFamily: "var(--ks-fm)",
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}
