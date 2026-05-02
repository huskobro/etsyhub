// Phase 8 Task 25 — Boş Pack durumu (template seçimi yok).
//
// Spec §5.2.2a: Template seçimi boşsa bağlam eksik mesajı
// ve "Şablonları Aç" aksiyonu ile durumu açık.

import { memo } from "react";

interface EmptyPackStateProps {
  onOpenTemplates?: () => void;
}

function EmptyPackStateComponent({ onOpenTemplates }: EmptyPackStateProps) {
  return (
    <div
      className="rounded-md border border-dashed border-border bg-surface-2 p-6 text-center"
      data-testid="empty-pack-state"
    >
      <p className="text-sm font-medium text-text">
        Template seçimi yapılmadı
      </p>
      <p className="mt-1 text-xs text-text-muted">
        Başlamak için en az bir şablon seçin
      </p>

      {onOpenTemplates && (
        <button
          type="button"
          onClick={onOpenTemplates}
          className="mt-3 inline-flex rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700"
        >
          Şablonları Aç
        </button>
      )}
    </div>
  );
}

export const EmptyPackState = memo(EmptyPackStateComponent);
