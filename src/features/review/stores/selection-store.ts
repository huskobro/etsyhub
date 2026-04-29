// Phase 6 Dalga B (Task 16) — Review queue selection store (Zustand).
//
// CLAUDE.md: client-only UI state için Zustand. Bulk action seçimi
// server'a yansımaz; selectedIds geçici UI durumudur.
//
// Sözleşme:
//   - selectedIds: Set<string> — kart id'leri.
//   - scope: "design" | "local" — aktif tab. Scope değişiminde seçim
//     auto-clear (yeni tab'a geçişte eski seçim taşınmaz).
//   - toggle: tek kart seç/seçim kaldır.
//   - selectAll: tüm visible kartları seç (parent ids listesi geçer).
//   - clear: seçimi temizle (X butonu veya bulk action sonrası).
//   - setScope: scope değişimi (auto-clear tetikler).

import { create } from "zustand";

type Scope = "design" | "local";

type State = {
  selectedIds: Set<string>;
  scope: Scope;
  toggle: (id: string) => void;
  clear: () => void;
  selectAll: (ids: string[]) => void;
  setScope: (scope: Scope) => void;
};

export const useReviewSelection = create<State>((set) => ({
  selectedIds: new Set<string>(),
  scope: "design",
  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  clear: () => set({ selectedIds: new Set<string>() }),
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  setScope: (scope) =>
    set((state) => {
      // Scope değişimi: auto-clear (yeni tab'a geçişte eski seçim anlamsız).
      if (state.scope !== scope) {
        return { scope, selectedIds: new Set<string>() };
      }
      return { scope };
    }),
}));
