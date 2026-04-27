"use client";

import type { FolderRow } from "../queries/use-local-folders";

// Q parsing opsiyonel: klasör adında "Q<n>" varsa beklenen dosya sayısı
// gösterilir; klasör adı (R5) korunur, normalize edilmez.
const Q_PATTERN = /Q(\d+)/;

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

  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-md border border-border bg-surface p-4 text-left transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="truncate text-sm font-medium text-text">
        {folder.name}
      </div>
      <div className="mt-1 text-xs text-text-muted">
        {folder.fileCount} görsel
        {mismatch ? (
          <span className="ml-2 text-warning">
            · beklenen Q{expected}
          </span>
        ) : null}
      </div>
    </button>
  );
}
