"use client";

// Phase 8 Task 25 — EmptyPackState.
//
// Spec §5.2 — Boş pack durumu (seçilmiş template yok).
// PackPreviewCard içinde, selectedTemplateIds.length === 0 ise gösterilir.

export interface EmptyPackStateProps {
  onCustomizeClick: () => void;
}

export function EmptyPackState({ onCustomizeClick }: EmptyPackStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-2 p-8">
      <p className="mb-4 text-sm font-medium text-text">
        Seçilmiş mockup şablonu yok
      </p>
      <p className="mb-6 text-xs text-text-muted">
        Quickpack veya özel seçim yapınız
      </p>
      <button
        type="button"
        onClick={onCustomizeClick}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
      >
        Şablon Seç
      </button>
    </div>
  );
}
