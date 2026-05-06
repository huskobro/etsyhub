"use client";

// Phase 7 Task 26 — Filmstrip + filter dropdown + multi-select.
//
// Spec Section 3.2-3.3 + mockup B.13 (`screens-b.jsx:862`):
//   - Card içinde grid: thumbnails (aspect-portrait), her tile button.
//   - Selected → top-left checkmark badge (accent dolgu).
//   - Active (preview) → 2px accent border.
//   - Rejected → opacity reduced + "Reddedildi" badge (alt orta).
//   - Multi-select → ring class (klavye/cmd-click ile çoklu seçim).
//   - Filter dropdown: Tümü / Aktif / Reddedilenler (header sağ).
//     - Aktif = pending + selected (rejected hariç).
//   - Filter sayacı: "Varyantlar (N)" tümü; "Varyantlar (M / N)" partial.
//   - "+ Varyant ekle" tile sonunda (yalnız draft set'te; Task 32 drawer
//     trigger placeholder — şimdilik no-op onClick).
//
// Multi-select interaction (spec):
//   - Plain click → setActiveItemId + multi clear (tek seçim).
//   - Cmd/Ctrl+click → toggleMultiSelect (aktif değişmez).
//   - Shift+click → range select [lastClickedIdx..currentIdx] union mevcut.
//   - Read-only set (status !== "draft") → click yalnız preview, multi yok.
//
// Range tracking: useRef ile `lastClickedIdx` — function-local var her
// render'da reset olurdu. Rerender'lar arası persist gerek.
//
// Phase 6 disiplini: token-only Tailwind class'ları; arbitrary value
// kullanılmaz. aspect-portrait zaten tailwind config'te tanımlı (2/3); grid
// `grid-cols-8 lg:grid-cols-12` ile responsive (config-defined) — adaptif
// breakpoint paterni Phase 6 emsallerinde de bu şekilde.

import { useMemo, useRef, useState, type MouseEvent } from "react";
import { Check, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useStudioStore, type FilmstripFilter } from "../stores/studio-store";
import { AssetImage } from "@/components/ui/asset-image";
import type { SelectionItemView } from "@/features/selection/queries";
import type { SelectionSet } from "@prisma/client";
import { ReorderMenu } from "./ReorderMenu";
import { AddVariantsDrawer } from "./AddVariantsDrawer";

export type FilmstripProps = {
  setId: string;
  items: SelectionItemView[];
  setStatus: SelectionSet["status"];
};

const FILTER_OPTIONS: Array<{ value: FilmstripFilter; label: string }> = [
  { value: "all", label: "Tümü" },
  { value: "active", label: "Aktif" },
  { value: "rejected", label: "Reddedilenler" },
];

/** İki haneli pad. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Filter predicate. Spec: "active" = pending + selected; "rejected" = rejected. */
function applyFilter(
  items: SelectionItemView[],
  filter: FilmstripFilter,
): SelectionItemView[] {
  if (filter === "all") return items;
  if (filter === "active") return items.filter((i) => i.status !== "rejected");
  return items.filter((i) => i.status === "rejected");
}

export function Filmstrip({ setId, items, setStatus }: FilmstripProps) {
  const filter = useStudioStore((s) => s.filter);
  const setFilter = useStudioStore((s) => s.setFilter);
  const activeItemId = useStudioStore((s) => s.activeItemId);
  const setActiveItemId = useStudioStore((s) => s.setActiveItemId);
  const multiSelectIds = useStudioStore((s) => s.multiSelectIds);
  const toggleMultiSelect = useStudioStore((s) => s.toggleMultiSelect);
  const selectMultiRange = useStudioStore((s) => s.selectMultiRange);
  const clearMultiSelect = useStudioStore((s) => s.clearMultiSelect);

  // Range tracking için son tıklanan index. useRef → renderler arası persist.
  const lastClickedIdxRef = useRef<number | null>(null);

  // Task 32 — AddVariantsDrawer state. Drawer Filmstrip seviyesinde tutulur
  // (üst component setId zaten prop'larda; mount yeri pragmatik). Mevcut
  // item'ların `generatedDesignId`'leri drawer'a duplicate koruma için geçer.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const existingDesignIds = useMemo(
    () => new Set(items.map((i) => i.generatedDesignId)),
    [items],
  );

  const isReadOnly = setStatus !== "draft";
  const filteredItems = applyFilter(items, filter);

  const handleItemClick = (
    item: SelectionItemView,
    idx: number,
    e: MouseEvent<HTMLButtonElement>,
  ) => {
    if (isReadOnly) {
      // Finalize edilmiş set: yalnız preview değişebilir, multi-select yok.
      setActiveItemId(item.id);
      lastClickedIdxRef.current = idx;
      return;
    }

    // Shift+click range
    if (e.shiftKey && lastClickedIdxRef.current !== null) {
      const start = Math.min(lastClickedIdxRef.current, idx);
      const end = Math.max(lastClickedIdxRef.current, idx);
      const rangeIds = filteredItems.slice(start, end + 1).map((i) => i.id);
      const next = new Set(multiSelectIds);
      for (const id of rangeIds) next.add(id);
      selectMultiRange(Array.from(next));
      return;
    }

    // Cmd/Ctrl+click: toggle, aktif değişmez
    if (e.metaKey || e.ctrlKey) {
      toggleMultiSelect(item.id);
      lastClickedIdxRef.current = idx;
      return;
    }

    // Plain click: aktif preview + multi-select clear
    setActiveItemId(item.id);
    if (multiSelectIds.size > 0) clearMultiSelect();
    lastClickedIdxRef.current = idx;
  };

  const counterLabel =
    filter === "all"
      ? `Varyantlar (${items.length})`
      : `Varyantlar (${filteredItems.length} / ${items.length})`;

  return (
    <Card className="p-3">
      {/* Header: counter + filter dropdown */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="font-mono text-xs uppercase tracking-meta text-text-muted">
          {counterLabel}
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilmstripFilter)}
          className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          aria-label="Filtre"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {filteredItems.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-muted">
          {filter === "rejected"
            ? "Reddedilen varyant yok"
            : "Bu filtreye uygun varyant yok"}
        </div>
      ) : (
        <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-12">
          {filteredItems.map((item, idx) => {
            const isActive = item.id === activeItemId;
            const isSelected = item.status === "selected";
            const isRejected = item.status === "rejected";
            const isMulti = multiSelectIds.has(item.id);
            // Pass 33 — edited indicator. Item'ın editedAssetId'si varsa
            // küçük bir nokta rozeti (sağ üst). Selected check sol üstte;
            // edited dot sağ üstte → çakışma yok. Kullanıcı hangi varyant
            // düzenlenmiş hangileri orijinal — bir bakışta görür.
            const isEdited = item.editedAssetId !== null;

            // Class composition: Tailwind ile token-uyumlu, arbitrary yok.
            const classes = [
              "relative cursor-pointer overflow-hidden rounded-sm border-2 aspect-portrait",
              isActive ? "border-accent" : "border-transparent",
              isRejected ? "opacity-40" : "",
              isMulti ? "ring-2 ring-accent" : "",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            ]
              .filter(Boolean)
              .join(" ");

            const ariaSuffix = isSelected
              ? " (seçili)"
              : isRejected
                ? " (reddedildi)"
                : "";
            const editedSuffix = isEdited ? " (düzenlenmiş)" : "";

            // Wrapping `<div className="relative group">`: checkbox button +
            // ReorderMenu overlay HTML semantik olarak ayrı (button içinde
            // başka button yasak). Hover/focus-within ile menu trigger görünür.
            return (
              <div key={item.id} className="group relative">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isMulti}
                  aria-label={`Varyant ${pad2(idx + 1)}${ariaSuffix}${editedSuffix}`}
                  onClick={(e) => handleItemClick(item, idx, e)}
                  className={classes}
                  data-edited={isEdited ? "true" : "false"}
                >
                  <AssetImage
                    assetId={item.editedAssetId ?? item.sourceAssetId}
                    alt={`Varyant ${pad2(idx + 1)} thumbnail`}
                    frame={false}
                  />
                  {isSelected ? (
                    <div
                      aria-hidden
                      className="absolute left-0.5 top-0.5 grid h-3.5 w-3.5 place-items-center rounded-sm bg-accent text-accent-foreground"
                    >
                      <Check className="h-2 w-2" />
                    </div>
                  ) : null}
                  {/* Pass 33 — edited indicator. Sağ üst köşede 1.5×1.5
                      success dot. Tooltip "Düzenlenmiş" ile sebep net. */}
                  {isEdited ? (
                    <div
                      aria-hidden
                      title="Düzenlenmiş"
                      data-testid="filmstrip-edited-dot"
                      className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-success ring-2 ring-bg"
                    />
                  ) : null}
                  {isRejected ? (
                    <div
                      aria-hidden
                      className="absolute bottom-0.5 left-0.5 right-0.5 rounded-sm bg-text px-1 py-0.5 text-center font-mono text-xs text-bg"
                    >
                      Reddedildi
                    </div>
                  ) : null}
                </button>
                {/* Reorder menu overlay — full set order ister; filtre yalnız
                    görsel olduğu için filtrelenmemiş `items` array'i geçilir. */}
                {!isReadOnly ? (
                  <div className="absolute right-0.5 top-0.5">
                    <ReorderMenu
                      setId={setId}
                      items={items}
                      itemId={item.id}
                      isReadOnly={isReadOnly}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}

          {!isReadOnly ? (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="grid aspect-portrait place-items-center rounded-sm border-2 border-dashed border-border text-text-muted transition-colors duration-fast ease-out hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              aria-label="Varyant ekle"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      )}

      {/* Task 32 — AddVariantsDrawer. Yalnız draft set'te mount edilebilir;
          read-only set'lerde drawer trigger butonu yok zaten. Open state
          Filmstrip içinde tutulur — drawer kapanışta yenilenmiş set verisi
          (selectionSetQueryKey invalidate ile) parent'tan tekrar gelir. */}
      {!isReadOnly ? (
        <AddVariantsDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          setId={setId}
          existingDesignIds={existingDesignIds}
        />
      ) : null}
    </Card>
  );
}
