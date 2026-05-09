/* eslint-disable no-restricted-syntax */
// FilesTab — Kivasy v4 A5 file reality table. v4 spec sabit boyutlar:
//  · text-[12.5px] / text-[13px] / text-[24px] yarı-piksel typography
//  · k-card stat tile + table cell padding A5 ile birebir
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { detectFormat } from "@/features/products/state-helpers";
import type { ListingDraftView } from "@/features/listings/types";

/**
 * FilesTab — A5 Files tab, real deliverables view.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a5.jsx →
 * A5ProductDetail files tab.
 *
 * R5 surface: bind to listing.imageOrder (mockup render outputs) +
 * format breakdown via outputKey extension. Phase 9 V1 listing draft
 * view zaten signedUrl + outputKey'leri taşıyor — ilave query yok.
 *
 * Bundle ZIP henüz auto-generate yok (V1.1 export pipeline). UI'da
 * "Bundle ZIP" satırı placeholder olarak gösterilir + format toggle
 * Listing tab'ında manuel set edilir.
 *
 * Boundary discipline:
 *   No physical / no shipping. Tüm formatlar dijital teslim için
 *   (ZIP/PNG/PDF/JPG/JPEG).
 */

interface FilesTabProps {
  listing: ListingDraftView;
}

interface FileRow {
  filename: string;
  format: ReturnType<typeof detectFormat>;
  sizeLabel: string;
  resolutionLabel: string;
  source: "render" | "bundle" | "asset";
}

function formatBadgeTone(
  format: ReturnType<typeof detectFormat>,
): "accent" | "info" | "neutral" {
  if (format === "ZIP") return "accent";
  if (format === "PDF") return "info";
  return "neutral";
}

export function FilesTab({ listing }: FilesTabProps) {
  // Mockup render'ları file reality için satır üret
  const renderRows: FileRow[] = listing.imageOrder.map((it, idx) => {
    const filename =
      it.outputKey?.split("/").pop() ??
      `${it.templateName.toLowerCase().replace(/\s+/g, "_")}_${idx + 1}.png`;
    const format = detectFormat(filename) ?? "PNG";
    return {
      filename,
      format,
      sizeLabel: "—",
      resolutionLabel: "Mockup render",
      source: "render",
    };
  });

  // Bundle ZIP placeholder (R6'da auto-generate edilince gerçek ZIP gelir)
  // — kullanıcı dijital teslim hattını burada görür.
  const formatPrefixed = listing.materials.filter((m) =>
    m.startsWith("format:"),
  );
  const hasZip = formatPrefixed.some(
    (m) => m.toUpperCase() === "FORMAT:ZIP",
  );
  const hasPdf = formatPrefixed.some(
    (m) => m.toUpperCase() === "FORMAT:PDF",
  );

  const placeholderRows: FileRow[] = [];
  if (hasZip) {
    placeholderRows.push({
      filename: `${listing.id.slice(0, 8)}_bundle.zip`,
      format: "ZIP",
      sizeLabel: "auto-bundle (R6)",
      resolutionLabel: "All assets bundled",
      source: "bundle",
    });
  }
  if (hasPdf) {
    placeholderRows.push({
      filename: `${listing.id.slice(0, 8)}_print.pdf`,
      format: "PDF",
      sizeLabel: "auto-export (R6)",
      resolutionLabel: "Print-ready",
      source: "bundle",
    });
  }

  const allRows = [...placeholderRows, ...renderRows];

  // Top stats
  const totalFiles = allRows.length;
  const formatCounts = allRows.reduce<Record<string, number>>((acc, r) => {
    if (r.format) acc[r.format] = (acc[r.format] ?? 0) + 1;
    return acc;
  }, {});
  const formatBreakdown = Object.entries(formatCounts)
    .map(([k, v]) => `${v} ${k}`)
    .join(" · ");

  return (
    <div
      className="flex-1 overflow-y-auto bg-bg px-8 py-8"
      data-testid="product-files-tab"
    >
      {/* Stats row */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat label="Files" value={String(totalFiles)} />
        <Stat label="Format breakdown" value={formatBreakdown || "—"} />
        <Stat
          label="Bundle"
          value={hasZip ? "ZIP enabled" : "Per-asset only"}
        />
      </div>

      {/* Boundary banner — dijital teslim disiplini */}
      <div className="mb-4 rounded-md border border-line bg-k-bg-2/60 px-4 py-3">
        <p className="text-[12.5px] text-ink-2">
          <strong className="font-semibold">Digital download only.</strong>{" "}
          Files listed below are what the buyer downloads after purchase. No
          shipping, no production partner — toggle the file types in the{" "}
          <span className="font-mono text-[11px] text-info">Listing</span>{" "}
          tab to control what&apos;s included.
        </p>
      </div>

      {totalFiles === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center">
          <h3 className="text-base font-semibold text-ink">
            No deliverable files yet
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Apply mockups to a Selection to populate this product&apos;s files.
            Mockup renders land here as PNG; ZIP / PDF auto-bundle in R6.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-line bg-paper">
          <table className="w-full">
            <thead>
              <tr>
                {["File", "Format", "Size", "Resolution"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-line bg-k-bg-2/40 px-4 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-meta text-ink-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.map((r, i) => (
                <tr
                  key={`${r.filename}-${i}`}
                  className={cn(
                    "border-b border-line-soft last:border-b-0 hover:bg-k-bg-2/30",
                  )}
                  data-testid="product-file-row"
                  data-format={r.format ?? "unknown"}
                  data-source={r.source}
                >
                  <td className="px-4 py-3 text-[13px] font-medium text-ink">
                    {r.filename}
                  </td>
                  <td className="px-4 py-3">
                    {r.format ? (
                      <Badge tone={formatBadgeTone(r.format)}>{r.format}</Badge>
                    ) : (
                      <Badge tone="neutral">—</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] tabular-nums text-ink-2">
                    {r.sizeLabel}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-ink-2">
                    {r.resolutionLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="k-card px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
        {label}
      </div>
      <div className="mt-1.5 truncate text-[24px] font-semibold tracking-tight text-ink">
        {value}
      </div>
    </div>
  );
}
