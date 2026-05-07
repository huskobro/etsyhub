"use client";

// Pass 62/64 — Per-thumb format export butonları (PNG / JPEG / WebP).
//
// Pass 64: Kullanıcı tercih ettiği default format'ı küçük bir
// "varsayılan" işaretiyle vurgular (border-accent + bold). Tercih
// list page ListBatchPanel'da değiştirilir; localStorage cross-tab
// sync sayesinde detail page anında günceller.

import {
  EXPORT_FORMAT_VALUES,
  isExportFormat,
  useLocalStoragePref,
  type ExportFormatPref,
} from "../useLocalStoragePref";

type ExportButtonsProps = {
  midjourneyAssetId: string;
};

const FORMAT_LABELS: Record<ExportFormatPref, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
};

export function ExportButtons({ midjourneyAssetId }: ExportButtonsProps) {
  const [defaultFormat] = useLocalStoragePref<ExportFormatPref>(
    "default-export-format",
    "png",
    isExportFormat,
  );

  return (
    <div className="flex gap-1">
      {EXPORT_FORMAT_VALUES.map((f) => {
        const isDefault = f === defaultFormat;
        const cls = isDefault
          ? "rounded border border-accent bg-accent-soft px-1.5 py-0.5 font-mono text-xs font-semibold text-accent transition hover:opacity-90"
          : "rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-xs text-text-muted transition hover:border-accent hover:text-accent";
        return (
          <a
            key={f}
            href={`/api/admin/midjourney/asset/${midjourneyAssetId}/export?format=${f}&size=full`}
            download
            className={cls}
            data-testid={`mj-export-${f}-${midjourneyAssetId}`}
            title={
              isDefault
                ? `İndir: ${FORMAT_LABELS[f]} (varsayılan · full-res 1024px)`
                : `İndir: ${FORMAT_LABELS[f]} (full-res 1024px)`
            }
          >
            ↓ {FORMAT_LABELS[f]}
            {isDefault ? " ★" : ""}
          </a>
        );
      })}
    </div>
  );
}
