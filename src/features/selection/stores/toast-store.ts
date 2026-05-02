"use client";

// Phase 7 Task 39 — Selection Studio toast store (Zustand).
//
// Spec Section 3.3 (notification entegrasyonu): YALNIZ heavy edit
// completion/failure + export completion/failure. Mikro state için
// notification YOK — inline UI ana yüzey olmaya devam eder; toast page-level
// fail-safe (sayfada kalsa bile inline + toast ek görünürlük; sayfadan
// ayrılırsa polling completion'da toast son state'i bildirir).
//
// Phase 6 Toast primitive (`@/components/ui/Toast`) atom (state-driven,
// konum/yaşam döngüsü parent'a ait). Bu store push/dismiss/clear API'si
// sağlar; render `StudioToastSlot` parent'ında, lifecycle StudioShell
// üstünde yönetilir.
//
// Phase 6 review pipeline'a yeni notification mantığı eklenmez (Drift #6 +
// KIE flaky notu). Bu store yalnız Phase 7 scope'unda heavy edit + export.
//
// Centralized notification context Phase 7 v1 için fazla overhead — pragmatik
// custom store + page-level slot. Phase 7 sonrası global notification
// altyapısı geldiğinde bu store retire edilir veya proxy görevi görür.

import { create } from "zustand";

export type ToastTone = "success" | "info" | "error";

export type ToastEvent = {
  id: string;
  tone: ToastTone;
  message: string;
  /** Debug/observability için. UI'da görünür değil; test'lerde varlık
   *  doğrulanır (heavy-edit / export / mockup-job). */
  source?: "heavy-edit" | "export" | "mockup-job";
};

type State = {
  toasts: ToastEvent[];
  /** Yeni toast ekle; id otomatik üretilir (Date.now + random suffix). */
  push: (toast: Omit<ToastEvent, "id">) => void;
  /** Belirli id'li toast'ı kaldır. Eşleşmezse no-op. */
  dismiss: (id: string) => void;
  /** Tüm toast'ları sil. */
  clear: () => void;
};

export const useSelectionStudioToasts = create<State>((set) => ({
  toasts: [],
  push: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          ...toast,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      ],
    })),
  dismiss: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clear: () => set({ toasts: [] }),
}));
