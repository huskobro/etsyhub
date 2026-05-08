"use client";

// Pass 90 — Kept Workspace state container.
//
// Server component (page.tsx) cards listesini ve summary'yi getirir;
// bu client component sadece **selection state**'i ve toolbar action'ları
// yönetir (select all, clear, handoff panel). Cards mapping'i grid render
// burada — server'dan props ile geliyor.

import { useState, useMemo } from "react";
import type { MJVariantKind } from "@prisma/client";
import { KeptCard } from "./KeptCard";
import { HandoffPanel } from "./HandoffPanel";

type KeptCardData = {
  midjourneyAssetId: string;
  assetId: string;
  gridIndex: number;
  variantKind: MJVariantKind;
  mjActionLabel: string | null;
  parentAssetId: string | null;
  parentAssetThumbId: string | null;
  midjourneyJobId: string;
  prompt: string;
  expandedPrompt: string | null;
  batchId: string | null;
  templateId: string | null;
  alreadyPromotedDesignId: string | null;
};

type KeptWorkspaceProps = {
  cards: KeptCardData[];
};

export function KeptWorkspace({ cards }: KeptWorkspaceProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allIds = useMemo(() => cards.map((c) => c.midjourneyAssetId), [cards]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(allIds));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Hide-already-promoted toggle yerine bilgi: badge'le promoted gösteriliyor.
  // Operatör isterse onlar hariç seçim yapabilir (idempotent zaten).

  const selectedCount = selectedIds.size;
  const visibleCount = cards.length;

  return (
    <>
      {/* Toolbar — sadece kart varsa */}
      {visibleCount > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-2 text-xs"
          data-testid="mj-kept-toolbar"
        >
          <span className="text-text-muted">
            Görünen: <strong className="text-text">{visibleCount}</strong>
          </span>
          <span className="text-text-muted">·</span>
          <span className="text-text-muted">
            Seçili: <strong className="text-text">{selectedCount}</strong>
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={selectAllVisible}
              disabled={visibleCount === 0 || selectedCount === visibleCount}
              className="rounded border border-border bg-bg px-2 py-1 text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-40"
              data-testid="mj-kept-select-all"
            >
              Görünenlerin hepsini seç
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectedCount === 0}
              className="rounded border border-border bg-bg px-2 py-1 text-text-muted transition hover:border-danger hover:text-danger disabled:opacity-40"
              data-testid="mj-kept-clear-selection"
            >
              Seçimi temizle
            </button>
          </div>
        </div>
      ) : null}

      {/* Grid */}
      {visibleCount === 0 ? null : (
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          data-testid="mj-kept-grid"
        >
          {cards.map((card) => (
            <KeptCard
              key={card.midjourneyAssetId}
              card={card}
              selected={selectedIds.has(card.midjourneyAssetId)}
              onToggle={() => toggle(card.midjourneyAssetId)}
            />
          ))}
        </div>
      )}

      {/* Sticky bottom handoff panel */}
      <HandoffPanel
        selectedIds={Array.from(selectedIds)}
        onClearSelection={clearSelection}
      />
    </>
  );
}
