"use client";

/**
 * Phase 72 — Multi-slot mockup template editor (wrapper around SafeAreaEditor).
 *
 * Operatör birden fazla design slot'u olan mockup template'i author etmek
 * için kullanır:
 *   - Sticker sheet (9-up grid)
 *   - Bundle preview (cover + 3 design overlay)
 *   - Front + back garment
 *   - Mug front + handle area
 *
 * Mevcut single-slot pattern (tek `safeArea`) Phase 72'de **bozulmaz**.
 * Operator "Add slot" tıklayana kadar multi-slot mode hiç açılmaz.
 *
 * Component sözleşmesi:
 *   - `slots: SlotEditValue[]` — eğer length === 0 ise multi-slot mode
 *     KAPALI; parent yalnız single-slot SafeAreaEditor'ı render eder.
 *   - length >= 1 → multi-slot mode AÇIK; parent slot list panel + seçili
 *     slot için SafeAreaEditor render eder.
 *   - Slot ekle → server-side cuid generate (Phase 67 user-scope assets ile
 *     parity); preset position 10% inset rect.
 *
 * Phase 72 scope:
 *   - Slot list panel (k-segment veya chip group)
 *   - Add slot button (preset rect 10% inset)
 *   - Remove slot button (last slot remove → multi-slot mode kapalı, fallback
 *     single-slot)
 *   - Slot rename (inline input)
 *   - Active slot highlight + edit
 *   - Per-slot safeArea editing (rect veya perspective; mode bağımsız)
 *
 * Phase 73+ candidate (bilinçli scope dışı):
 *   - Slot drag reorder (composite layer order)
 *   - Slot per-recipe override
 *   - Slot duplicate
 *   - Multi-design render execution (backend pipeline genişletmesi)
 */

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  SafeAreaEditor,
  type SafeAreaValue,
  rectToPerspective,
  perspectiveToRect,
} from "./SafeAreaEditor";

/** A single slot under multi-slot authoring. id is stable; name optional. */
export type SlotEditValue = {
  id: string;
  name?: string;
  safeArea: SafeAreaValue;
};

export type SlotsEditorProps = {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  slots: SlotEditValue[];
  onChange: (next: SlotEditValue[]) => void;
  disabled?: boolean;
  showSamplePreview?: boolean;
  onToggleSamplePreview?: () => void;
  recipe?: Parameters<typeof SafeAreaEditor>[0]["recipe"];
};

function genSlotId(): string {
  // Lightweight client cuid (no extra dep). Phase 67 user assets uses
  // server cuid; slot ids are config-internal so client-side ok.
  return (
    "slot_" +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  );
}

const DEFAULT_NEW_SLOT_RECT: SafeAreaValue = {
  mode: "rect",
  rect: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
};

export function SlotsEditor({
  imageUrl,
  imageWidth,
  imageHeight,
  slots,
  onChange,
  disabled = false,
  showSamplePreview = false,
  onToggleSamplePreview,
  recipe,
}: SlotsEditorProps) {
  // Active slot index (defaults to first slot)
  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = Math.min(Math.max(0, activeIdx), Math.max(0, slots.length - 1));
  const active = slots[safeIdx];

  const updateActiveSlot = (next: SafeAreaValue) => {
    const updated = slots.map((s, i) =>
      i === safeIdx ? { ...s, safeArea: next } : s,
    );
    onChange(updated);
  };

  const switchActiveMode = (nextMode: "rect" | "perspective") => {
    if (!active || active.safeArea.mode === nextMode) return;
    const sa: SafeAreaValue =
      nextMode === "perspective" && active.safeArea.mode === "rect"
        ? { mode: "perspective", perspective: rectToPerspective(active.safeArea.rect) }
        : nextMode === "rect" && active.safeArea.mode === "perspective"
          ? { mode: "rect", rect: perspectiveToRect(active.safeArea.perspective) }
          : active.safeArea;
    updateActiveSlot(sa);
  };

  const addSlot = () => {
    const next: SlotEditValue = {
      id: genSlotId(),
      name: `Slot ${slots.length + 1}`,
      safeArea: DEFAULT_NEW_SLOT_RECT,
    };
    onChange([...slots, next]);
    setActiveIdx(slots.length);
  };

  const removeSlot = (idx: number) => {
    const next = slots.filter((_, i) => i !== idx);
    onChange(next);
    if (next.length === 0) setActiveIdx(0);
    else if (activeIdx >= next.length) setActiveIdx(next.length - 1);
  };

  const renameSlot = (idx: number, name: string) => {
    const next = slots.map((s, i) =>
      i === idx ? { ...s, name: name.slice(0, 40) } : s,
    );
    onChange(next);
  };

  if (slots.length === 0) {
    // Should never reach — parent gates rendering on slots.length > 0.
    return null;
  }

  if (!active) return null;

  return (
    <div className="flex flex-col gap-3" data-testid="slots-editor">
      {/* Slot list panel */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-paper p-2">
        <div
          className="flex flex-wrap items-center gap-1"
          role="tablist"
          aria-label="Design slots"
          data-testid="slots-editor-tabs"
        >
          {slots.map((s, i) => {
            const isActive = i === safeIdx;
            return (
              <div key={s.id} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  disabled={disabled}
                  className={
                    isActive
                      ? "inline-flex items-center gap-1 rounded-md border border-k-orange bg-k-orange-soft px-2 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-meta text-k-orange-ink"
                      : "inline-flex items-center gap-1 rounded-md border border-line bg-paper px-2 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-meta text-ink-2 hover:border-line-strong hover:bg-k-bg-2"
                  }
                  data-testid={`slots-editor-tab-${i}`}
                  data-active={isActive}
                  aria-selected={isActive}
                  role="tab"
                >
                  <span className="rounded bg-paper/70 px-1 text-[9px] text-ink-3">
                    {i + 1}
                  </span>
                  <span className="max-w-[12ch] truncate">
                    {s.name ?? `Slot ${i + 1}`}
                  </span>
                </button>
                {slots.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeSlot(i)}
                    disabled={disabled}
                    className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-ink-3 hover:bg-danger/10 hover:text-danger"
                    title={`Remove ${s.name ?? `Slot ${i + 1}`}`}
                    data-testid={`slots-editor-remove-${i}`}
                  >
                    <X className="h-2.5 w-2.5" aria-hidden />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addSlot}
          disabled={disabled || slots.length >= 12}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-paper px-2 font-mono text-[10.5px] font-semibold uppercase tracking-meta text-ink-2 hover:border-k-orange hover:text-k-orange-ink disabled:opacity-50"
          data-testid="slots-editor-add"
          title={
            slots.length >= 12
              ? "Max 12 slots per template"
              : "Add a new design slot (default rect, 10% inset)"
          }
        >
          <Plus className="h-3 w-3" aria-hidden /> Add slot
        </button>
      </div>

      {/* Active slot rename + mode toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            Slot {safeIdx + 1} name
          </span>
          <input
            type="text"
            value={active.name ?? ""}
            placeholder={`Slot ${safeIdx + 1}`}
            maxLength={40}
            disabled={disabled}
            onChange={(e) => renameSlot(safeIdx, e.target.value)}
            className="h-7 w-40 rounded-md border border-line bg-paper px-2 font-mono text-[12px] text-ink focus:border-k-orange focus:outline-none disabled:opacity-50"
            data-testid="slots-editor-active-name"
          />
        </label>
        <div
          className="k-segment ml-auto"
          role="group"
          aria-label="Slot safe-area mode"
          data-testid="slots-editor-mode-toggle"
        >
          {(["rect", "perspective"] as const).map((m) => {
            const isModeActive = active.safeArea.mode === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={isModeActive}
                onClick={() => switchActiveMode(m)}
                disabled={disabled}
                data-testid={`slots-editor-mode-${m}`}
                data-active={isModeActive}
                title={
                  m === "rect"
                    ? "Axis-aligned rectangle"
                    : "4-corner perspective quad"
                }
              >
                {m === "rect" ? "Rect" : "Perspective"}
              </button>
            );
          })}
        </div>
      </div>

      {/* SafeAreaEditor — operates on active slot only.
          Phase 72 multi-slot preview overlay (other slots dimmed underneath)
          handled in parent via SafeAreaEditor recipe layer (sample preview)
          for now; per-slot ghost outline Phase 73+ polish. */}
      <SafeAreaEditor
        imageUrl={imageUrl}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        value={active.safeArea}
        onChange={updateActiveSlot}
        disabled={disabled}
        showSamplePreview={showSamplePreview}
        onToggleSamplePreview={onToggleSamplePreview}
        recipe={recipe}
      />

      <p
        className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3"
        data-testid="slots-editor-hint"
      >
        {slots.length === 1
          ? "1 slot — operator can add more for sticker sheets, bundle previews, multi-area layouts"
          : `${slots.length} slots · click a tab to edit · drag corners on the canvas · save persists all`}
      </p>
    </div>
  );
}
