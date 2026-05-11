// Small formatters used by the review focus workspace info-rail. Pure
// functions (no React, no fetches) so they can be unit-tested and
// reused on any surface that renders review item metadata.

/**
 * Format-level transparency capability based on the MIME type.
 *
 * IA Phase 11 added a persisted `hasAlpha` Sharp probe on
 * LocalLibraryAsset / Asset; this helper is the format-only fallback
 * for legacy rows that haven't been re-scanned. Use
 * `transparencyDescriptor(mimeType, hasAlpha)` instead when you have
 * access to the persisted boolean — it picks the strongest signal
 * available (real probe wins over format hint).
 *
 *   • PNG  → transparency capable (alpha channel supported by spec)
 *   • WebP → transparency capable (alpha channel supported by spec)
 *   • JPEG → no transparency (format cannot carry alpha)
 *   • Anything else → unknown
 */
export type TransparencyCapability =
  | { kind: "supports-alpha"; format: "PNG" | "WebP" }
  | { kind: "no-alpha"; format: "JPEG" }
  | { kind: "unknown"; format: string };

export function transparencyForMime(mimeType: string): TransparencyCapability {
  const m = mimeType.toLowerCase();
  if (m === "image/png") return { kind: "supports-alpha", format: "PNG" };
  if (m === "image/webp") return { kind: "supports-alpha", format: "WebP" };
  if (m === "image/jpeg" || m === "image/jpg") {
    return { kind: "no-alpha", format: "JPEG" };
  }
  const friendly = m.startsWith("image/") ? m.slice(6).toUpperCase() : m;
  return { kind: "unknown", format: friendly };
}

/**
 * Operator-facing transparency descriptor — picks the strongest
 * available signal:
 *   • persisted hasAlpha === true   → "Yes — alpha channel detected"
 *   • persisted hasAlpha === false  → "No — flat / no alpha"
 *   • hasAlpha === null:
 *       fall back to format-level hint (PNG/WebP supports / JPEG no)
 *
 * Returns the format string separately so callers can keep the
 * "Format" row in sync with what they're claiming about transparency.
 */
export interface TransparencyDescriptor {
  /** "Yes (probed)" / "No (probed)" / "Supported (format-level)" /
   *  "Not supported (JPEG)" / "Unknown". */
  label: string;
  /** True when the call relied on the persisted hasAlpha probe rather
   *  than the format-level fallback. UI may use this to render a
   *  small "probed" caption next to the value. */
  probed: boolean;
  /** Same format string as `transparencyForMime`. */
  format: string;
}

export function transparencyDescriptor(
  mimeType: string,
  hasAlpha: boolean | null | undefined,
): TransparencyDescriptor {
  const cap = transparencyForMime(mimeType);
  if (hasAlpha === true) {
    return { label: "Yes — alpha channel", probed: true, format: cap.format };
  }
  if (hasAlpha === false) {
    return { label: "No — flat image", probed: true, format: cap.format };
  }
  // null / undefined → format-level fallback.
  if (cap.kind === "supports-alpha") {
    return {
      label: "Supported (format-level)",
      probed: false,
      format: cap.format,
    };
  }
  if (cap.kind === "no-alpha") {
    return {
      label: "Not supported (JPEG)",
      probed: false,
      format: cap.format,
    };
  }
  return { label: "Unknown", probed: false, format: cap.format };
}

/**
 * Human-readable file size — KB up to 999, then MB. We don't go GB
 * on purpose: a single review asset above 1 GB is already a setup
 * problem that "1024.0 MB" surfaces just as well as "1.0 GB".
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1000) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

/**
 * Print-readiness hint — pixel-count first, DPI metadata is treated
 * as a secondary signal because PNG/JPEG metadata fields are often
 * stripped or set to a generic 72 by image editors even when the
 * raw resolution is print-grade (e.g. 4096×4096 @ 72 DPI is still
 * a 13.6"×13.6" 300-DPI print). Anchoring the hint on min-side
 * pixel count matches the scan worker's quality scorer.
 *
 * Tiers:
 *   • min ≥ 3000 px ⇒ Print-ready (regardless of DPI tag)
 *   • min ≥ 1800 px AND DPI ≥ 200 ⇒ Print-ready (DPI confirms)
 *   • min ≥ 1800 px ⇒ Print-ready (large pixel count rescues)
 *   • min ≥ 1000 px ⇒ Web-only — not enough for premium print
 *   • else ⇒ Low resolution — upscale recommended
 */
export function resolutionHint(input: {
  dpi: number | null;
  width: number | null;
  height: number | null;
}): string | null {
  if (input.width == null || input.height == null) return null;
  const minSide = Math.min(input.width, input.height);
  if (minSide >= 1800) {
    return "Print-ready";
  }
  if (minSide >= 1000) {
    return "Web-only — not large enough for premium print";
  }
  return "Low resolution — upscale recommended";
}
