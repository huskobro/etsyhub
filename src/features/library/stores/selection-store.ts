import { create } from "zustand";

/**
 * Library bulk-select store — survives across nav clicks within /library
 * but resets on full reload. Per-asset boolean: a Set keyed by
 * MidjourneyAsset.id (the same key used in URL state and lineage).
 *
 * Per docs/IMPLEMENTATION_HANDOFF.md §5 (Library / Selections / Products
 * boundary): selection here is *transient* — picking items to act on, NOT
 * the curated `Selection` set entity. Acting on the selection (e.g. "Add
 * to Selection set") happens via the FloatingBulkBar action which hands
 * off to the Selections surface (rollout-4).
 */

interface LibrarySelectionState {
  selected: Set<string>;
  toggle: (assetId: string) => void;
  add: (assetId: string) => void;
  remove: (assetId: string) => void;
  clear: () => void;
  has: (assetId: string) => boolean;
  count: () => number;
  /** Replace selection with the provided ids (used by select-all etc.). */
  replace: (assetIds: string[]) => void;
  /** Selected ids as an array (stable for snapshot rendering). */
  ids: () => string[];
}

export const useLibrarySelection = create<LibrarySelectionState>((set, get) => ({
  selected: new Set<string>(),
  toggle: (assetId) =>
    set((state) => {
      const next = new Set(state.selected);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return { selected: next };
    }),
  add: (assetId) =>
    set((state) => {
      if (state.selected.has(assetId)) return state;
      const next = new Set(state.selected);
      next.add(assetId);
      return { selected: next };
    }),
  remove: (assetId) =>
    set((state) => {
      if (!state.selected.has(assetId)) return state;
      const next = new Set(state.selected);
      next.delete(assetId);
      return { selected: next };
    }),
  clear: () => set({ selected: new Set() }),
  has: (assetId) => get().selected.has(assetId),
  count: () => get().selected.size,
  replace: (assetIds) => set({ selected: new Set(assetIds) }),
  ids: () => Array.from(get().selected),
}));
