"use client";

// Phase 8 Task 25 — EmptyPackState.
// Phase 55 — EN parity + Kivasy DS migration.
//
// Spec §5.2 — Boş pack durumu (seçilmiş template yok).
// PackPreviewCard içinde, selectedTemplateIds.length === 0 ise gösterilir.

export interface EmptyPackStateProps {
  onCustomizeClick: () => void;
}

export function EmptyPackState({ onCustomizeClick }: EmptyPackStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-k-bg-2/60 p-8"
      data-testid="mockup-empty-pack-state"
    >
      <p className="mb-2 text-sm font-medium text-ink">
        No mockup template selected
      </p>
      <p className="mb-6 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        Pick a Quick pack or use Custom Selection
      </p>
      <button
        type="button"
        onClick={onCustomizeClick}
        className="k-btn k-btn--primary"
        data-size="sm"
      >
        Pick templates
      </button>
    </div>
  );
}
