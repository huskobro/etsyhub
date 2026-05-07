"use client";

// Pass 62 — Per-thumb format export butonları (PNG / JPEG / WebP).
//
// Browser export endpoint'i çağırır + download dialog açar. Source
// MinIO'da canonical formatta (Pass 62 sonrası PNG; eski webp), sharp
// ile istenen format'a dönüşür.
//
// MVP: sadece "full" size (uzun kenar 1024). "web" boyut Pass 63'te
// eklenebilir.

type ExportButtonsProps = {
  midjourneyAssetId: string;
};

const FORMATS: Array<{ key: "png" | "jpeg" | "webp"; label: string }> = [
  { key: "png", label: "PNG" },
  { key: "jpeg", label: "JPEG" },
  { key: "webp", label: "WebP" },
];

export function ExportButtons({ midjourneyAssetId }: ExportButtonsProps) {
  return (
    <div className="flex gap-1">
      {FORMATS.map((f) => (
        <a
          key={f.key}
          href={`/api/admin/midjourney/asset/${midjourneyAssetId}/export?format=${f.key}&size=full`}
          download
          className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-xs text-text-muted transition hover:border-accent hover:text-accent"
          data-testid={`mj-export-${f.key}-${midjourneyAssetId}`}
          title={`İndir: ${f.label} (full-res 1024px)`}
        >
          ↓ {f.label}
        </a>
      ))}
    </div>
  );
}
