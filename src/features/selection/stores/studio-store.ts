"use client";

// Phase 7 Task 25 — Selection Studio canvas store (Zustand).
//
// Phase 7'ye özel client-only UI state. Phase 6 review-store
// (`src/features/review/stores/selection-store.ts`) ayrı dosya — burada
// karışmaz, bağımlılık yok.
//
// Kapsam:
//   - activeItemId: Sol canvas preview için aktif item id (null = boş).
//   - multiSelectIds: Filmstrip'te shift/ctrl-click ile çoklu seçim
//     (bulk action için). Set tipi seçim O(1) toggle disiplini.
//   - filter: Filmstrip görünüm filtresi. "active" = pending + selected
//     (rejected hariç). Spec Section 3.3.
//   - currentSetId: Hangi set yüklü? Set değişince state reset (eski
//     activeItemId/multiSelectIds yeni set'e taşınmasın — bug riski).
//
// Auto-clear paterni Phase 6 review-store'dan: scope/page değişiminde
// auto-clear; burada setId değişiminde aynı mantık.

import { create } from "zustand";

/**
 * Filmstrip filter durumu (spec Section 3.3).
 *   - "all": tüm itemler (default)
 *   - "active": pending + selected (rejected hariç)
 *   - "rejected": sadece rejected (ileride bulk-revive için faydalı)
 */
export type FilmstripFilter = "all" | "active" | "rejected";

type State = {
  /** Sol canvas için aktif preview item id'si. null → boş canvas. */
  activeItemId: string | null;
  /** Filmstrip multi-select id'leri (bulk action için). */
  multiSelectIds: Set<string>;
  /** Filmstrip görünüm filtresi. */
  filter: FilmstripFilter;
  /** Aktif set id'si — store reset trigger'ı. null → henüz set yüklenmedi. */
  currentSetId: string | null;

  setActiveItemId: (id: string | null) => void;
  toggleMultiSelect: (id: string) => void;
  /** Shift-click range veya selectAll için yeni Set ile replace. */
  selectMultiRange: (ids: string[]) => void;
  clearMultiSelect: () => void;
  setFilter: (filter: FilmstripFilter) => void;
  /**
   * Aktif set'i güncelle. setId değişirse state reset (activeItemId=null,
   * multiSelectIds=empty, filter="all"). Aynı setId no-op (gereksiz
   * re-render yok).
   */
  setCurrentSetId: (setId: string) => void;
};

export const useStudioStore = create<State>((set) => ({
  activeItemId: null,
  multiSelectIds: new Set<string>(),
  filter: "all",
  currentSetId: null,

  setActiveItemId: (id) => set({ activeItemId: id }),

  toggleMultiSelect: (id) =>
    set((state) => {
      const next = new Set(state.multiSelectIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { multiSelectIds: next };
    }),

  selectMultiRange: (ids) => set({ multiSelectIds: new Set(ids) }),

  clearMultiSelect: () => set({ multiSelectIds: new Set<string>() }),

  setFilter: (filter) => set({ filter }),

  setCurrentSetId: (setId) =>
    set((state) => {
      // Aynı setId → no-op (state korunur, gereksiz reset yok)
      if (state.currentSetId === setId) return state;
      // Yeni set → state reset (eski selection/filter taşınmaz)
      return {
        currentSetId: setId,
        activeItemId: null,
        multiSelectIds: new Set<string>(),
        filter: "all",
      };
    }),
}));
