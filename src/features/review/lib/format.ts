// Small formatters used by the review focus workspace info-rail. Pure
// functions (no React, no fetches) so they can be unit-tested and
// reused on any surface that renders review item metadata.

/**
 * Format-level transparency capability based on the MIME type.
 *
 * This is NOT a runtime alpha probe — we don't open the file with
 * Sharp on each request. We surface what the format can carry, which
 * is the operator-meaningful signal for "is this file a candidate for
 * a transparent product (sticker / clipart bundle)?":
 *
 *   • PNG  → transparency capable (alpha channel supported by spec)
 *   • WebP → transparency capable (alpha channel supported by spec)
 *   • JPEG → no transparency (format cannot carry alpha)
 *   • Anything else → unknown (we don't second-guess uncommon types)
 *
 * Schema extension would let us persist a true `hasAlpha` from the
 * scan worker; deferred to a follow-up phase. The format-level hint
 * is honest and ships today.
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
  // Strip "image/" prefix for the unknown label (UI only).
  const friendly = m.startsWith("image/") ? m.slice(6).toUpperCase() : m;
  return { kind: "unknown", format: friendly };
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
 * Print-readiness hint derived from DPI + dimensions. Used as a
 * passive caption next to the resolution row — not a blocking gate.
 *
 * Heuristic mirrors the scan worker's quality scorer (DPI ≥ target
 * + resolution within 80% of target == "Print-ready"); without DPI
 * we degrade gracefully to a "DPI unreadable" caption instead of
 * pretending the file is OK.
 */
export function resolutionHint(input: {
  dpi: number | null;
  width: number | null;
  height: number | null;
}): string | null {
  if (input.width == null || input.height == null) return null;
  if (input.dpi == null) return "DPI bilgisi okunamadı";
  if (input.dpi >= 300 && Math.min(input.width, input.height) >= 2400) {
    return "Print-ready";
  }
  if (input.dpi >= 200) return "Web-only — yüksek kaliteli baskı için yetersiz";
  return "Düşük çözünürlük — upscale gerekebilir";
}
