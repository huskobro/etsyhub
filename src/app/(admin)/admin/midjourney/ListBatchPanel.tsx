"use client";

// Pass 64 — List-level asset batch panel.
//
// Detail page'in batch panel'inin (Pass 63) list-level versiyonu:
// görünen tüm asset'ler üzerinden filtre/akıllı seçim + bulk export
// ZIP. Asset-level model — job sadece gruplayıcı.
//
// Akıllı seçim filter'ları (audit-derived):
//   • Görünenlerin tümü
//   • Yalnız indirilmeyenler (audit log MIDJOURNEY_ASSET_EXPORT yok)
//   • Yalnız review olmayanlar (generatedDesignId null)
//   • Temizle
//
// Default download format kullanıcı tercihi (localStorage). Tekli
// (detail ExportButtons) + bulk burada saklı kalır.

import { useState } from "react";
import {
  EXPORT_FORMAT_VALUES,
  isExportFormat,
  useLocalStoragePref,
  type ExportFormatPref,
} from "./useLocalStoragePref";

export type VisibleAsset = {
  midjourneyAssetId: string;
  midjourneyJobId: string;
  gridIndex: number;
  jobPrompt: string;
  mjJobId: string | null;
  isDownloaded: boolean;
  isPromoted: boolean;
};

type ListBatchPanelProps = {
  visibleAssets: VisibleAsset[];
};

const FORMAT_LABELS: Record<ExportFormatPref, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
};

export function ListBatchPanel({ visibleAssets }: ListBatchPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [defaultFormat, setDefaultFormat] = useLocalStoragePref<ExportFormatPref>(
    "default-export-format",
    "png",
    isExportFormat,
  );
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalAssets = visibleAssets.length;
  const downloadedCount = visibleAssets.filter((a) => a.isDownloaded).length;
  const promotedCount = visibleAssets.filter((a) => a.isPromoted).length;
  const undownloadedAssets = visibleAssets.filter((a) => !a.isDownloaded);
  const unreviewedAssets = visibleAssets.filter((a) => !a.isPromoted);

  function selectAll() {
    setSelectedIds(new Set(visibleAssets.map((a) => a.midjourneyAssetId)));
  }
  function selectNotDownloaded() {
    setSelectedIds(
      new Set(undownloadedAssets.map((a) => a.midjourneyAssetId)),
    );
  }
  function selectNotPromoted() {
    setSelectedIds(
      new Set(unreviewedAssets.map((a) => a.midjourneyAssetId)),
    );
  }
  function clearSel() {
    setSelectedIds(new Set());
  }

  async function handleBulkExport() {
    if (selectedIds.size === 0) {
      setError("Önce asset seç");
      return;
    }
    if (selectedIds.size > 50) {
      setError(
        `Tek seferde max 50 asset (seçili: ${selectedIds.size}). Filtre daralt veya parçalı indir.`,
      );
      return;
    }
    setError(null);
    setSuccess(null);
    setExporting(true);
    try {
      const res = await fetch("/api/admin/midjourney/asset/bulk-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          midjourneyAssetIds: Array.from(selectedIds),
          format: defaultFormat,
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSuccess(
        `✓ ${selectedIds.size} asset ZIP indirildi (${defaultFormat.toUpperCase()})`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setExporting(false);
    }
  }

  if (totalAssets === 0) return null;

  const allSelected =
    selectedIds.size > 0 && selectedIds.size === totalAssets;

  return (
    <section
      className="sticky top-0 z-10 flex flex-col gap-2 rounded-md border border-accent bg-surface p-3 shadow-card"
      data-testid="mj-list-batch-panel"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Toplu işlem (görünen)</span>
        <span className="text-xs text-text-muted">
          {selectedIds.size}/{totalAssets} seçili · {downloadedCount} indirilmiş ·{" "}
          {promotedCount} review&apos;da
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-text-muted">Akıllı seçim:</span>
        <button
          type="button"
          onClick={selectAll}
          disabled={exporting}
          className={
            "rounded-md border px-2 py-0.5 transition disabled:opacity-50 " +
            (allSelected
              ? "border-accent bg-accent text-on-accent font-semibold"
              : "border-border bg-bg text-text-muted hover:border-border-strong hover:text-text")
          }
          data-testid="mj-list-batch-select-all"
        >
          Görünenlerin tümü ({totalAssets})
        </button>
        <button
          type="button"
          onClick={selectNotDownloaded}
          disabled={exporting || undownloadedAssets.length === 0}
          className="rounded-md border border-border bg-bg px-2 py-0.5 text-text-muted transition hover:border-border-strong hover:text-text disabled:opacity-50"
          data-testid="mj-list-batch-select-undownloaded"
          title="Audit log: hiç export edilmemiş asset'ler"
        >
          ↓ Yalnız indirilmeyenler ({undownloadedAssets.length})
        </button>
        <button
          type="button"
          onClick={selectNotPromoted}
          disabled={exporting || unreviewedAssets.length === 0}
          className="rounded-md border border-border bg-bg px-2 py-0.5 text-text-muted transition hover:border-border-strong hover:text-text disabled:opacity-50"
          data-testid="mj-list-batch-select-unreviewed"
          title="generatedDesignId NULL: Review queue'da olmayan asset'ler"
        >
          ✗ Yalnız review olmayanlar ({unreviewedAssets.length})
        </button>
        {selectedIds.size > 0 ? (
          <button
            type="button"
            onClick={clearSel}
            disabled={exporting}
            className="rounded-md border border-border bg-bg px-2 py-0.5 text-text-muted transition hover:border-danger hover:text-danger disabled:opacity-50"
            data-testid="mj-list-batch-clear"
          >
            ✕ Seçimi temizle
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs">
          <span className="text-text-muted">Varsayılan format:</span>
          <select
            value={defaultFormat}
            onChange={(e) =>
              setDefaultFormat(e.target.value as ExportFormatPref)
            }
            disabled={exporting}
            className="rounded-md border border-border bg-bg px-2 py-0.5 text-xs disabled:opacity-50"
            data-testid="mj-list-batch-default-format"
            title="Bu cihazda kalıcı (localStorage). Tekli + toplu indirmeye yansır."
          >
            {EXPORT_FORMAT_VALUES.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleBulkExport}
          disabled={exporting || selectedIds.size === 0}
          className="rounded-md border border-accent bg-accent px-3 py-1 text-xs font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-40"
          data-testid="mj-list-batch-export-submit"
        >
          {exporting
            ? "Hazırlanıyor…"
            : `↓ ${selectedIds.size} asset → ${FORMAT_LABELS[defaultFormat]} ZIP`}
        </button>
        <span
          className="rounded-md border border-border bg-bg px-2 py-0.5 text-xs text-text-muted opacity-60"
          title="Pass 60-61: MJ native upscale park; Pass 63+: Topaz Gigapixel desktop automation araştırması"
          data-testid="mj-list-batch-upscale-placeholder"
        >
          ⤴ Toplu upscale (yakında)
        </span>
      </div>

      {error ? (
        <p
          className="text-xs text-danger"
          data-testid="mj-list-batch-error"
        >
          ⚠ {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="text-xs text-success"
          data-testid="mj-list-batch-success"
        >
          {success}
        </p>
      ) : null}
    </section>
  );
}
