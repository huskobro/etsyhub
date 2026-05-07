"use client";

// Pass 63 — Asset-level batch panel (detail page output grid üstünde).
//
// Operatör 4 grid + child upscale'leri seçer; sticky action bar:
//   • Tümünü seç / temizle
//   • Bulk export (PNG/JPEG/WebP) → ZIP indirir
//   • "Toplu upscale (yakında)" placeholder — Pass 63 future-safe;
//     Gigapixel/MJ native upscale tamamlanınca aktif olacak
//
// State client-only (URL'e taşımak overhead'i de düşünüldü; detail page
// scope'u küçük, in-memory yeterli).

import { useState } from "react";
import {
  isExportFormat,
  useLocalStoragePref,
  type ExportFormatPref,
} from "../useLocalStoragePref";

type BatchAsset = {
  midjourneyAssetId: string;
  gridIndex: number;
  variantKind: string;
  alreadyDownloaded: boolean;
};

type AssetBatchPanelProps = {
  assets: BatchAsset[];
};

const FORMATS: Array<{ key: ExportFormatPref; label: string }> = [
  { key: "png", label: "PNG" },
  { key: "jpeg", label: "JPEG" },
  { key: "webp", label: "WebP" },
];

export function AssetBatchPanel({ assets }: AssetBatchPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState<null | ExportFormatPref>(null);
  // Pass 64 — Default format tercihi (cross-tab sync).
  const [defaultFormat] = useLocalStoragePref<ExportFormatPref>(
    "default-export-format",
    "png",
    isExportFormat,
  );
  const [error, setError] = useState<string | null>(null);

  const allIds = assets.map((a) => a.midjourneyAssetId);
  const allSelected =
    selectedIds.size > 0 && selectedIds.size === assets.length;

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }
  function selectOnlyNotDownloaded() {
    const next = new Set<string>();
    for (const a of assets) {
      if (!a.alreadyDownloaded) next.add(a.midjourneyAssetId);
    }
    setSelectedIds(next);
  }

  async function handleBulkExport(format: ExportFormatPref) {
    setError(null);
    setExporting(format);
    try {
      const res = await fetch("/api/admin/midjourney/asset/bulk-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          midjourneyAssetIds: Array.from(selectedIds),
          format,
          size: "full",
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        setError(`HTTP ${res.status}: ${t.slice(0, 120)}`);
        return;
      }
      const disp = res.headers.get("content-disposition") ?? "";
      const fnameMatch = /filename="([^"]+)"/.exec(disp);
      const filename = fnameMatch?.[1] ?? `mj-bulk-${Date.now()}.zip`;
      const blob = await res.blob();
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setExporting(null);
    }
  }

  return (
    <section
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3"
      data-testid="mj-asset-batch-panel"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Toplu işlem</span>
        <span className="text-xs text-text-muted">
          {selectedIds.size}/{assets.length} seçili
        </span>
        <button
          type="button"
          onClick={selectAll}
          className="rounded-md border border-border bg-bg px-2 py-0.5 text-xs text-text-muted hover:border-border-strong hover:text-text"
          data-testid="mj-batch-select-all"
        >
          {allSelected ? "Seçimi temizle" : "Hepsini seç"}
        </button>
        <button
          type="button"
          onClick={selectOnlyNotDownloaded}
          className="rounded-md border border-border bg-bg px-2 py-0.5 text-xs text-text-muted hover:border-border-strong hover:text-text"
          data-testid="mj-batch-select-not-downloaded"
          title="Sadece henüz indirilmemiş asset'leri seç"
        >
          ↓ Sadece indirilmeyenler
        </button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {assets.map((a) => (
          <label
            key={a.midjourneyAssetId}
            className={
              "flex cursor-pointer items-center gap-1 " +
              (a.alreadyDownloaded ? "text-success" : "text-text-muted")
            }
          >
            <input
              type="checkbox"
              checked={selectedIds.has(a.midjourneyAssetId)}
              onChange={() => toggle(a.midjourneyAssetId)}
              data-testid={`mj-batch-checkbox-${a.midjourneyAssetId}`}
            />
            Grid {a.gridIndex} · {a.variantKind}
            {a.alreadyDownloaded ? " ↓" : ""}
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-muted">
          Toplu indir (ZIP):
        </span>
        {FORMATS.map((f) => {
          const isDefault = f.key === defaultFormat;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => handleBulkExport(f.key)}
              disabled={selectedIds.size === 0 || exporting !== null}
              className={
                isDefault
                  ? "rounded-md border-2 border-accent bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-40"
                  : "rounded-md border border-accent bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-text transition hover:opacity-90 disabled:opacity-40"
              }
              data-testid={`mj-batch-export-${f.key}`}
              title={
                isDefault
                  ? `${f.label} (varsayılan format) ZIP indir`
                  : `${f.label} ZIP indir`
              }
            >
              {exporting === f.key
                ? "Hazırlanıyor…"
                : `↓ ${f.label} ZIP${isDefault ? " ★" : ""}`}
            </button>
          );
        })}
        <span
          className="ml-2 rounded-md border border-border bg-bg px-2 py-0.5 text-xs text-text-muted opacity-60"
          title="Pass 60-61: MJ native upscale park; Pass 63+: Topaz Gigapixel desktop automation araştırması"
          data-testid="mj-batch-upscale-placeholder"
        >
          ⤴ Toplu upscale (yakında)
        </span>
      </div>

      {error ? (
        <p
          className="text-xs text-danger"
          data-testid="mj-batch-error"
        >
          ⚠ {error}
        </p>
      ) : null}
    </section>
  );
}
