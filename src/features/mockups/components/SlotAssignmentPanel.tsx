"use client";

/**
 * Phase 76 — Multi-design slot assignment panel (operator-facing UI).
 *
 * Apply view'da operator multi-slot template seçtiğinde bu panel açılır;
 * her slot'a kept asset (set'in design item'larından) atayabilir.
 *
 * Backend (Phase 74-75) zaten:
 *   - Multi-slot render execution (slot başına ayrı placement)
 *   - Slot-mapped designUrls[] (her slot için ayrı design)
 *   - Fanout fallback (eksik slot'lar primary'ye düşer)
 *
 * UI state (client-side only — Phase 76 scope):
 *   - Slot index → kept asset id mapping
 *   - Boş slot'lar primary kept asset'e (fanout) düşer
 *   - "Same design to all" hızlı aksiyon (operator slot başına farklı
 *     atama yerine tek design fanout istiyorsa)
 *   - "Clear slot" — operator atamayı kaldırır (fallback aktif olur)
 *
 * Persistence — Phase 77+ candidate:
 *   - Mevcut MockupJob shape (createMockupJob/POST /api/mockup/jobs)
 *     templateIds + setId alır; multi-design slot mapping job-level
 *     persisted DEĞİL — operator UI state'inde tutar
 *   - Render execution: Phase 77'de handoff.service + worker chain
 *     genişletilecek (MockupRender row'una slotDesigns JSON ekle veya
 *     job-level slotAssignments map)
 *   - Phase 76 UI bütünlüklü çalışıyor; persist Phase 77 sırası
 *
 * Operator confidence:
 *   - Per-slot kept asset thumbnail + label
 *   - Empty state: "Fanout — uses primary design"
 *   - Compact grid layout (2-3 slot: list; 4+ slot: grid)
 *
 * PSD import hint Phase 76 polish (entry link operator için Phase 77
 * PSDImportDialog'a giden yolu görür).
 */

/* eslint-disable @next/next/no-img-element */
// Kept asset thumbnails server-signed URLs; next/image overkill for
// per-slot preview at 32-40px (no optimization win, extra hop cost).

import { useState } from "react";
import { Trash2, Sparkles, FileUp } from "lucide-react";

export type SlotAssignmentKeptItem = {
  id: string;
  /** Display label (item position or asset name) */
  label: string;
  /** Thumbnail URL (signed) for per-slot preview */
  thumbnailUrl: string | null;
};

export type SlotAssignmentMap = Record<number, string | null>;

export type SlotAssignmentPanelProps = {
  /** Slot count for the active template (>=2 for this panel to render) */
  slotCount: number;
  /** Optional template name for header context */
  templateName?: string;
  /** Kept items in the selection set, ordered by position */
  keptItems: SlotAssignmentKeptItem[];
  /** Current slot-to-item mapping (slotIndex → itemId or null = fanout) */
  assignments: SlotAssignmentMap;
  /** Operator-edited mapping callback */
  onChange: (next: SlotAssignmentMap) => void;
  /** Optional PSD import entry link (Phase 77 implementation point) */
  onOpenPsdImport?: () => void;
};

// Picker dropdown max-height Tailwind arbitrary; inline style yasak rule
// (CLAUDE.md DS discipline) için class olarak.
const PICKER_MAX_HEIGHT_CLASS = "max-h-[280px]";

export function SlotAssignmentPanel({
  slotCount,
  templateName,
  keptItems,
  assignments,
  onChange,
  onOpenPsdImport,
}: SlotAssignmentPanelProps) {
  const [activePicker, setActivePicker] = useState<number | null>(null);

  if (slotCount <= 1) {
    // Single-slot template — panel hiç render edilmez (Phase 8 baseline akışı)
    return null;
  }

  if (keptItems.length === 0) {
    return (
      <div
        className="rounded-md border border-line-soft bg-k-bg-2/40 p-4 text-[12px] text-ink-2"
        data-testid="slot-assignment-empty"
      >
        <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          Slot assignment
        </span>
        <p className="mt-1">
          No kept items in this set — finalize variants before assigning to
          slots.
        </p>
      </div>
    );
  }

  const primaryItem = keptItems[0]!;
  const slots = Array.from({ length: slotCount }, (_, i) => i);

  const setSlot = (slotIdx: number, itemId: string | null) => {
    onChange({ ...assignments, [slotIdx]: itemId });
    setActivePicker(null);
  };

  const fillAllWithPrimary = () => {
    const next: SlotAssignmentMap = {};
    slots.forEach((i) => {
      next[i] = primaryItem.id;
    });
    onChange(next);
    setActivePicker(null);
  };

  const clearAll = () => {
    const next: SlotAssignmentMap = {};
    slots.forEach((i) => {
      next[i] = null;
    });
    onChange(next);
    setActivePicker(null);
  };

  const layoutMode: "list" | "grid" = slotCount <= 3 ? "list" : "grid";

  const slotItem = (slotIdx: number) => {
    const itemId = assignments[slotIdx];
    if (!itemId) return null;
    return keptItems.find((k) => k.id === itemId) ?? null;
  };

  return (
    <div
      className="space-y-3 rounded-md border border-line bg-paper p-4"
      data-testid="slot-assignment-panel"
      data-slot-count={slotCount}
      data-layout={layoutMode}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-ink">
              Slot assignment
            </span>
            <span
              className="inline-flex items-center rounded-md border border-k-orange/40 bg-k-orange-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-meta text-k-orange-ink"
              data-testid="slot-assignment-count-badge"
            >
              {slotCount} slots
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            {templateName
              ? `${templateName} · pick a kept item for each slot · empty slots use primary fanout`
              : "Pick a kept item for each slot · empty slots use primary fanout"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={fillAllWithPrimary}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-paper px-2 font-mono text-[10.5px] font-semibold uppercase tracking-meta text-ink-2 hover:border-k-orange hover:text-k-orange-ink"
            data-testid="slot-assignment-fill-all"
            title={`Assign primary kept item (${primaryItem.label}) to all ${slotCount} slots`}
          >
            <Sparkles className="h-3 w-3" aria-hidden /> Fill all with primary
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-paper px-2 font-mono text-[10.5px] font-semibold uppercase tracking-meta text-ink-2 hover:border-danger hover:text-danger"
            data-testid="slot-assignment-clear-all"
            title="Clear all assignments — all slots will fall back to primary fanout"
          >
            <Trash2 className="h-3 w-3" aria-hidden /> Clear all
          </button>
          {onOpenPsdImport ? (
            <button
              type="button"
              onClick={onOpenPsdImport}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-paper px-2 font-mono text-[10.5px] font-semibold uppercase tracking-meta text-ink-2 hover:border-k-orange hover:text-k-orange-ink"
              data-testid="slot-assignment-psd-import"
              title="Import slot layout from a PSD smart-object template (Phase 77+)"
            >
              <FileUp className="h-3 w-3" aria-hidden /> From PSD
            </button>
          ) : null}
        </div>
      </div>

      {/* Slot list / grid */}
      <div
        className={
          layoutMode === "list"
            ? "flex flex-col gap-2"
            : "grid grid-cols-2 gap-2 sm:grid-cols-3"
        }
        data-testid="slot-assignment-slots"
      >
        {slots.map((slotIdx) => {
          const assigned = slotItem(slotIdx);
          const isOpen = activePicker === slotIdx;
          return (
            <div
              key={slotIdx}
              className="rounded-md border border-line-soft bg-k-bg-2/30 p-2"
              data-testid={`slot-assignment-slot-${slotIdx}`}
              data-assigned-item={assigned ? assigned.id : ""}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                  Slot {slotIdx + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setActivePicker(isOpen ? null : slotIdx)
                    }
                    className="inline-flex h-6 items-center gap-1 rounded-md border border-line bg-paper px-1.5 font-mono text-[10px] font-semibold uppercase tracking-meta text-ink-2 hover:border-k-orange hover:text-k-orange-ink"
                    data-testid={`slot-assignment-slot-${slotIdx}-pick`}
                    aria-expanded={isOpen}
                  >
                    {assigned ? "Change" : "Pick item"}
                  </button>
                  {assigned ? (
                    <button
                      type="button"
                      onClick={() => setSlot(slotIdx, null)}
                      className="inline-flex h-6 items-center justify-center rounded-md border border-line bg-paper px-1.5 text-ink-3 hover:border-danger hover:text-danger"
                      data-testid={`slot-assignment-slot-${slotIdx}-clear`}
                      title="Clear this slot — falls back to primary fanout"
                    >
                      <Trash2 className="h-2.5 w-2.5" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Assigned state preview */}
              <div className="mt-2 flex items-center gap-2">
                {assigned && assigned.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={assigned.thumbnailUrl}
                    alt={`Slot ${slotIdx + 1}: ${assigned.label}`}
                    className="h-10 w-10 rounded-md object-cover ring-1 ring-line"
                    data-testid={`slot-assignment-slot-${slotIdx}-thumb`}
                  />
                ) : assigned ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-k-bg-2 font-mono text-[10px] text-ink-3">
                    —
                  </div>
                ) : (
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-line bg-paper font-mono text-[9px] tracking-meta text-ink-3"
                    data-testid={`slot-assignment-slot-${slotIdx}-empty-thumb`}
                    title="Empty — falls back to primary fanout"
                  >
                    FANOUT
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium text-ink">
                    {assigned ? assigned.label : "Primary fanout"}
                  </div>
                  <div
                    className="font-mono text-[10px] uppercase tracking-meta text-ink-3"
                    data-testid={`slot-assignment-slot-${slotIdx}-status`}
                  >
                    {assigned
                      ? `Item · ${assigned.id.slice(0, 8)}`
                      : `Default · ${primaryItem.label}`}
                  </div>
                </div>
              </div>

              {/* Picker dropdown */}
              {isOpen ? (
                <div
                  className={`mt-2 overflow-auto rounded-md border border-line bg-paper p-1 ${PICKER_MAX_HEIGHT_CLASS}`}
                  data-testid={`slot-assignment-slot-${slotIdx}-picker`}
                >
                  {keptItems.map((item) => {
                    const isPicked = assignments[slotIdx] === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSlot(slotIdx, item.id)}
                        className={
                          isPicked
                            ? "flex w-full items-center gap-2 rounded-md border border-k-orange bg-k-orange-soft/40 p-1.5 text-left"
                            : "flex w-full items-center gap-2 rounded-md border border-transparent p-1.5 text-left hover:bg-k-bg-2"
                        }
                        data-testid={`slot-assignment-slot-${slotIdx}-pick-${item.id}`}
                        data-picked={isPicked}
                      >
                        {item.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.thumbnailUrl}
                            alt={item.label}
                            className="h-8 w-8 rounded object-cover ring-1 ring-line"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-k-bg-2 font-mono text-[9px] text-ink-3">
                            —
                          </div>
                        )}
                        <span className="flex-1 truncate text-[12px] text-ink">
                          {item.label}
                        </span>
                        {isPicked ? (
                          <span className="font-mono text-[9px] uppercase tracking-meta text-k-orange-ink">
                            Picked
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <p
        className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3"
        data-testid="slot-assignment-hint"
      >
        Slot mapping persists with Phase 77 render execution wiring; for now,
        assignment guides operator authoring intent and powers per-slot preview.
      </p>
    </div>
  );
}
