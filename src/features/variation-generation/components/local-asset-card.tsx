"use client";

import { useState } from "react";
import type { LocalLibraryAsset } from "@prisma/client";
import { NegativeMarkMenu } from "./negative-mark-menu";
import { DeleteAssetConfirm } from "./delete-asset-confirm";
import { useMarkNegative } from "../mutations/use-mark-negative";
import { useLocalLibrarySettings } from "../queries/use-local-library-settings";
import { cn } from "@/lib/cn";

type ScoreTone = "neutral" | "ok" | "warn" | "bad";

// Task 15 — operator-facing: eşikler Settings Registry'den (hardcoded yasak).
// Settings yüklenmediği veya yüklenemediği anlık fallback için var.
const DEFAULT_THRESHOLDS = { ok: 75, warn: 40 } as const;

function scoreTone(s: number | null, thresholds: { ok: number; warn: number }): ScoreTone {
  if (s == null) return "neutral";
  if (s >= thresholds.ok) return "ok";
  if (s >= thresholds.warn) return "warn";
  return "bad";
}

const TONE_BADGE: Record<ScoreTone, string> = {
  ok: "bg-success-soft text-success",
  warn: "bg-warning-soft text-warning",
  bad: "bg-danger-soft text-danger",
  neutral: "bg-surface-2 text-text-muted",
};

export function LocalAssetCard({
  asset,
  onPreview,
}: {
  asset: LocalLibraryAsset;
  // Pass 21 — kart tıklandığında QuickLook lightbox tetiklenir.
  onPreview?: (id: string) => void;
}) {
  const mark = useMarkNegative();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const settings = useLocalLibrarySettings();
  const thresholds = settings.data?.settings.qualityThresholds ?? DEFAULT_THRESHOLDS;
  const tone = scoreTone(asset.qualityScore, thresholds);

  // Görsel alanına tıklama QuickLook'u açar; alt taraftaki action butonları
  // event propagation kesilerek çakışmadan korunur.
  const triggerPreview = () => {
    if (onPreview) onPreview(asset.id);
  };

  return (
    <article className="overflow-hidden rounded-md border border-border bg-surface">
      <button
        type="button"
        onClick={triggerPreview}
        disabled={!onPreview}
        aria-label={`${asset.fileName} önizleme`}
        className="relative block aspect-square w-full bg-surface-2 transition-opacity disabled:cursor-default enabled:hover:opacity-90"
      >
        {asset.thumbnailPath ? (
          // Phase 5 Gap B — owner-only thumbnail stream; cross-user 404.
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/local-library/thumbnail?hash=${encodeURIComponent(asset.hash)}`}
            alt={asset.fileName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
            Önizleme yok
          </div>
        )}
        <span
          aria-label={`Kalite skoru: ${asset.qualityScore ?? "bilinmiyor"}`}
          className={cn(
            "absolute right-2 top-2 rounded-md px-2 py-0.5 text-xs font-medium",
            TONE_BADGE[tone],
          )}
        >
          {asset.qualityScore ?? "—"}
        </span>
        {asset.isNegative ? (
          <span
            className="absolute bottom-2 left-2 rounded-md bg-danger px-2 py-0.5 text-xs font-medium text-white"
            title={asset.negativeReason ?? "Negatif"}
          >
            Negatif
          </span>
        ) : null}
      </button>
      <div className="flex flex-col gap-1 p-3 text-xs">
        <div className="truncate font-medium text-text">{asset.fileName}</div>
        <div className="text-text-muted">
          {asset.width}×{asset.height} · {asset.dpi ?? "?"}dpi
        </div>
        {asset.isNegative && asset.negativeReason ? (
          <div className="truncate text-text-subtle" title={asset.negativeReason}>
            Sebep: {asset.negativeReason}
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between">
          <NegativeMarkMenu
            asset={asset}
            onMark={(reason) =>
              mark.mutate({
                id: asset.id,
                isNegative: !asset.isNegative,
                reason,
              })
            }
          />
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="text-xs text-danger underline hover:text-danger"
          >
            Sil
          </button>
        </div>
      </div>
      <DeleteAssetConfirm
        asset={asset}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </article>
  );
}
