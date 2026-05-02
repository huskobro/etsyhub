"use client";

// Phase 8 Task 24 — SetSummaryCard.
//
// Spec §5.2 Zone 2: Selection set özeti kartı.
//
// Gösterilenler:
//   - Set adı
//   - Seçili tasarım sayısı
//   - Set statüsü badge'i (draft | ready | archived)
//   - Tasarım şu anki filtre durumu (quick pack vs custom)
//
// Kullanım:
//   S3ApplyView'de Zone 2 placeholder replace (§5.2)

import { type SelectionSetDetailView } from "@/features/selection/queries";

export interface SetSummaryCardProps {
  set: SelectionSetDetailView;
  isQuickPack: boolean;
  selectedCount: number;
}

/**
 * Spec §5.2 Zone 2 — Set özeti kartı.
 *
 * Basit, oku-yazılır bilgi gösterimi.
 * Kullanıcı edit etmez; sadece bilgi alır.
 */
export function SetSummaryCard({
  set,
  isQuickPack,
  selectedCount,
}: SetSummaryCardProps) {
  // Status badge rengini belirle
  const statusColor = {
    draft: "bg-slate-100 text-slate-700",
    ready: "bg-green-100 text-green-700",
    archived: "bg-gray-100 text-gray-700",
  }[set.status];

  const statusLabel = {
    draft: "Taslak",
    ready: "Hazır",
    archived: "Arşivlendi",
  }[set.status];

  return (
    <section
      aria-label="Set özeti"
      className="rounded-md border border-border bg-surface-2 p-4"
    >
      <div className="space-y-3">
        {/* Set adı + statüsü */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-text">{set.name}</h2>
            <p className="text-xs text-text-muted">
              Toplam {set.items.length} tasarım seçili
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Pack türü ve seçili say */}
        <div className="border-t border-border pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">
              {isQuickPack ? "Quick Pack" : "Özel Seçim"}
            </span>
            <span className="text-sm font-medium text-text">
              {selectedCount} mockup
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
