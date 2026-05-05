"use client";

// Pass 21 — Local library QuickLook (Lightbox).
//
// Pre-Pass 21: kullanıcı asset card'a tıklayınca tek-tek incelemek için
// dosyayı OS'te açmak zorundaydı; review/negative-mark/sil aksiyonları
// kart üzerinde dağınıktı; bir görselden yan görsele geçmek için "Tüm
// klasörler"e dönmek gerekiyordu.
//
// Pass 21: bir asset'e tıklayınca büyük preview modal açılır:
//   - Büyük görsel preview (download endpoint stream)
//   - Sol/Sağ navigation (prev/next via arrow buttons + keyboard)
//   - Dosya bilgileri panel (filename, path, dimensions, dpi, kalite, fileSize)
//   - Inline aksiyonlar: Negatif İşaretle/Kaldır + Sil + dosya yolunu kopyala
//   - Index göstergesi: "{i}/{total}" formatında
//   - Esc ile kapanma + outside click + close button
//
// V1 lock: production logic değişmez; download endpoint zaten owner-only
// stream (Phase 5 Gap B). Negative mark / delete mevcut mutation'lar reuse.

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { LocalLibraryAsset } from "@prisma/client";
import { useMarkNegative } from "../mutations/use-mark-negative";
import { useDeleteLocalAsset } from "../mutations/use-delete-local-asset";
import { useLocalLibrarySettings } from "../queries/use-local-library-settings";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type ScoreTone = "neutral" | "ok" | "warn" | "bad";

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

export type LocalAssetQuickLookProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: LocalLibraryAsset[];
  // Açıkken hangi asset gösteriliyor (asset.id)
  currentId: string | null;
  onCurrentIdChange: (id: string) => void;
};

export function LocalAssetQuickLook({
  open,
  onOpenChange,
  assets,
  currentId,
  onCurrentIdChange,
}: LocalAssetQuickLookProps) {
  const settings = useLocalLibrarySettings();
  const thresholds = settings.data?.settings.qualityThresholds ?? DEFAULT_THRESHOLDS;
  const mark = useMarkNegative();
  const del = useDeleteLocalAsset();
  const [busy, setBusy] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);

  const idx = assets.findIndex((a) => a.id === currentId);
  const current: LocalLibraryAsset | null = idx >= 0 ? (assets[idx] ?? null) : null;
  const total = assets.length;

  const goPrev = () => {
    if (total === 0 || idx < 0) return;
    const next = (idx - 1 + total) % total;
    const target = assets[next];
    if (target) onCurrentIdChange(target.id);
  };
  const goNext = () => {
    if (total === 0 || idx < 0) return;
    const next = (idx + 1) % total;
    const target = assets[next];
    if (target) onCurrentIdChange(target.id);
  };

  // Keyboard navigation (Arrow keys)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx, total, busy]);

  // Copy path to clipboard feedback reset
  useEffect(() => {
    if (!pathCopied) return;
    const t = setTimeout(() => setPathCopied(false), 1500);
    return () => clearTimeout(t);
  }, [pathCopied]);

  if (!current) return null;

  const tone = scoreTone(current.qualityScore, thresholds);

  const onCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(current.filePath);
      setPathCopied(true);
    } catch {
      // Clipboard API yoksa fallback yok — sessizce geç
    }
  };

  const onToggleNegative = () => {
    if (busy) return;
    setBusy(true);
    mark.mutate(
      {
        id: current.id,
        isNegative: !current.isNegative,
        // Negatif kaldırıldığında reason'u da temizlemek için undefined gönder
        // (mevcut DB değeri korunur ama UI tarafında reason gizlenir).
        reason: current.isNegative ? undefined : "manual",
      },
      {
        onSettled: () => setBusy(false),
      },
    );
  };

  const onDelete = () => {
    if (busy) return;
    if (
      !window.confirm(
        `"${current.fileName}" silinsin mi? Disk üzerindeki dosya korunur (sadece veritabanı kaydı silinir).`,
      )
    ) {
      return;
    }
    setBusy(true);
    // İndex önce ileri kaydır ki silindikten sonra doğru asset gelsin
    const fallbackId =
      total > 1 ? assets[(idx + 1) % total]?.id ?? null : null;
    del.mutate(current.id, {
      onSettled: () => setBusy(false),
      onSuccess: () => {
        if (fallbackId) {
          onCurrentIdChange(fallbackId);
        } else {
          onOpenChange(false);
        }
      },
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          // Modal viewport: full-screen modal, w-screen + h-screen Tailwind
          // built-in scale; left-0 top-0 fixed pinning. Padding bizim layer
          // değil; app-level overlay'de fullscreen kabul. Mobile: flex-col.
          // md+: 3-col grid (image col-span-2 + info col-span-1).
          className="fixed left-0 top-0 z-50 flex h-screen w-screen flex-col overflow-hidden bg-bg shadow-card md:grid md:grid-cols-3"
          aria-describedby={undefined}
        >
          {/* Image preview (col-span-2 on md+) — flex-1 mobil, col-span-2 md+ */}
          <div className="relative flex flex-1 items-center justify-center bg-black md:col-span-2 md:flex-none">
            {/* Prev/Next arrows */}
            {total > 1 ? (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={busy}
                  aria-label="Önceki görsel"
                  className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-md bg-bg/80 px-3 py-2 text-text shadow-card transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={busy}
                  aria-label="Sonraki görsel"
                  className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md bg-bg/80 px-3 py-2 text-text shadow-card transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ›
                </button>
              </>
            ) : null}

            {/* Index pill (top-left) */}
            <span className="absolute left-3 top-3 z-10 rounded-md bg-bg/80 px-2 py-0.5 text-xs font-medium text-text-muted">
              {idx + 1}/{total}
            </span>

            {/* Quality badge (top-right of image) */}
            <span
              aria-label={`Kalite skoru: ${current.qualityScore ?? "bilinmiyor"}`}
              className={cn(
                "absolute right-3 top-3 z-10 rounded-md px-2 py-0.5 text-xs font-medium",
                TONE_BADGE[tone],
              )}
            >
              Kalite: {current.qualityScore ?? "—"}
            </span>

            {/* Image — endpoint thumbnail (webp) döner; QuickLook için
                yeterli (Sharp default ~1024px). Full-size streaming V2.x
                carry-forward (download endpoint için ayrı route gerekir). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/local-library/thumbnail?hash=${encodeURIComponent(current.hash)}`}
              alt={current.fileName}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {/* Info panel (col 2 on md+) */}
          <div className="flex flex-col gap-4 overflow-y-auto border-t border-border p-5 md:border-l md:border-t-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                {/* Pass 23 — Context badge: kullanıcı modal içinde de
                    hangi akışta olduğunu hatırlasın. */}
                <span className="w-fit rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">
                  Lokal kütüphane
                </span>
                <Dialog.Title className="text-base font-semibold text-text">
                  {current.fileName}
                </Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Kapat"
                  className="rounded-md px-2 py-1 text-text-muted hover:bg-surface-2 hover:text-text"
                >
                  ✕
                </button>
              </Dialog.Close>
            </div>

            {/* Path / breadcrumb */}
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-text-muted">Tam yol</span>
              <div className="flex items-start gap-2">
                <span className="break-all font-mono text-text">{current.filePath}</span>
              </div>
              <button
                type="button"
                onClick={onCopyPath}
                className="self-start text-xs text-accent underline hover:text-accent-hover"
              >
                {pathCopied ? "✓ Kopyalandı" : "Yolu kopyala"}
              </button>
            </div>

            {/* Properties */}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-text-muted">Klasör</dt>
              <dd className="text-text">{current.folderName}</dd>
              <dt className="text-text-muted">Çözünürlük</dt>
              <dd className="text-text">
                {current.width}×{current.height}
              </dd>
              <dt className="text-text-muted">DPI</dt>
              <dd className="text-text">{current.dpi ?? "?"}</dd>
              <dt className="text-text-muted">Boyut</dt>
              <dd className="text-text">
                {current.fileSize > 0
                  ? `${Math.round(current.fileSize / 1024)} KB`
                  : "?"}
              </dd>
              <dt className="text-text-muted">MIME</dt>
              <dd className="text-text">{current.mimeType}</dd>
              {current.isNegative ? (
                <>
                  <dt className="text-text-muted">Durum</dt>
                  <dd className="text-danger">
                    Negatif{current.negativeReason ? ` · ${current.negativeReason}` : ""}
                  </dd>
                </>
              ) : null}
            </dl>

            {/* Inline actions */}
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant={current.isNegative ? "secondary" : "ghost"}
                onClick={onToggleNegative}
                disabled={busy}
              >
                {current.isNegative ? "Negatif işaretini kaldır" : "Negatif olarak işaretle"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                disabled={busy}
                className="text-danger hover:text-danger"
              >
                Sil (DB kaydı)
              </Button>
              <p className="text-xs text-text-muted">
                ←/→ tuşları ile gezinin · Esc ile kapatın. Sil yalnız veritabanı
                kaydını kaldırır; disk üzerindeki dosya korunur.
              </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
