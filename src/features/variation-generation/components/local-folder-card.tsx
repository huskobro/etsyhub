"use client";

import type { FolderRow } from "../queries/use-local-folders";

// Q parsing opsiyonel: klasör adında "Q<n>" varsa beklenen dosya sayısı
// gösterilir; klasör adı (R5) korunur, normalize edilmez.
const Q_PATTERN = /Q(\d+)/;

// Pass 23 — folder card preview strip.
// Önceki davranış: sadece text (folder name + "N görsel · beklenen Q7").
// Yeni: ilk 3 thumbnail strip (16:9 row üstte) + alt satırda meta:
// fileCount + negativeCount (varsa) + Q mismatch (varsa).
// Thumbnail src: mevcut /api/local-library/thumbnail?hash=... endpoint
// (owner-only stream, cross-user 404).
export function LocalFolderCard({
  folder,
  onOpen,
}: {
  folder: FolderRow;
  onOpen: () => void;
}) {
  const qMatch = folder.name.match(Q_PATTERN);
  const expected = qMatch && qMatch[1] ? Number(qMatch[1]) : null;
  const mismatch = expected != null && expected !== folder.fileCount;
  const covers = folder.coverHashes ?? [];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="overflow-hidden rounded-md border border-border bg-surface text-left transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* Pass 23 — Preview strip */}
      <div className="flex aspect-video gap-0.5 bg-surface-2">
        {covers.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
            Önizleme yok
          </div>
        ) : (
          <>
            {covers.map((hash, i) => (
              <div
                key={hash}
                className="flex-1 overflow-hidden bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/local-library/thumbnail?hash=${encodeURIComponent(hash)}`}
                  alt={`${folder.name} preview ${i + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
            {/* 1-2 cover varsa kalan slot'lar boş — visual stability */}
            {Array.from({ length: Math.max(0, 3 - covers.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex-1 bg-surface-2" />
            ))}
          </>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-1 p-3">
        <div className="truncate text-sm font-medium text-text">
          {folder.name}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
          <span>{folder.fileCount} görsel</span>
          {folder.negativeCount > 0 ? (
            <span className="rounded bg-danger-soft px-1.5 py-0.5 text-danger">
              {folder.negativeCount} negatif
            </span>
          ) : null}
          {mismatch ? (
            <span className="text-warning">· beklenen Q{expected}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
