// Phase 6 Dalga B (Task 16) — Review queue selection store (Zustand).
//
// CLAUDE.md: client-only UI state için Zustand. Bulk action seçimi
// server'a yansımaz; selectedIds geçici UI durumudur.
//
// Sözleşme:
//   - selectedIds: Set<string> — kart id'leri.
//   - scope: "design" | "local" — aktif tab. Scope değişiminde seçim
//     auto-clear (yeni tab'a geçişte eski seçim taşınmaz).
//   - page: pagination cursor (1 tabanlı). Sayfa değişiminde seçim
//     auto-clear — kullanıcı sayfa 1'de N kart seçip sayfa 2'ye geçerse
//     BulkApproveDialog skip-on-risk hint'i sayfa 2 cache'inde olmayan
//     id'ler için yanlış (riskyCount=0 optimistic) hesaplardı. Server
//     yine doğru karar verir ama UI hint yanıltıcıydı.
//   - toggle: tek kart seç/seçim kaldır.
//   - selectAll: tüm visible kartları seç (parent ids listesi geçer).
//   - clear: seçimi temizle (X butonu veya bulk action sonrası).
//   - setScope: scope değişimi (auto-clear tetikler).
//   - setPage: pagination değişimi (auto-clear tetikler).

import { create } from "zustand";

type Scope = "design" | "local";

type State = {
  selectedIds: Set<string>;
  scope: Scope;
  page: number;
  toggle: (id: string) => void;
  clear: () => void;
  selectAll: (ids: string[]) => void;
  setScope: (scope: Scope) => void;
  setPage: (page: number) => void;
};

export const useReviewSelection = create<State>((set) => ({
  selectedIds: new Set<string>(),
  scope: "design",
  page: 1,
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
      // Page de 1'e döner — yeni tab'ın cursor'u eskiden bağımsız.
      if (state.scope !== scope) {
        return { scope, selectedIds: new Set<string>(), page: 1 };
      }
      return { scope };
    }),
  setPage: (page) =>
    set((state) => {
      // Page değişimi: auto-clear (sayfa boundary cache miss → yanlış
      // skip-on-risk hint riski). Aynı page idempotent; selection korunur.
      if (state.page !== page) {
        return { page, selectedIds: new Set<string>() };
      }
      return { page };
    }),
}));
