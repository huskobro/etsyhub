"use client";

// Phase 7 Task 39 — StudioToastSlot.
//
// Spec Section 3.3: page-level Toast slot. StudioShell üstünde mount edilir.
// Phase 6 Toast primitive (`@/components/ui/Toast`) atom — role/aria-live
// tone'a göre içeride sabit (success/info → status, error → alert).
//
// Konum: fixed bottom-4 right-4 z-50 (token discipline; Tailwind utility
// class'ları design token'lara map'lenir). Stack mantığı flex-col gap-2
// ile column.
//
// Lifecycle:
//   - 0 toast → null render (DOM yok).
//   - 1+ toast → her toast 5sn sonra auto-dismiss.
//   - Click toast → dismiss (button wrapper aria-label "Bildirimi kapat: ...";
//     SR kullanıcısına dismiss intent net).
//
// Heavy edit + export only — mikro state notification YOK.

import { useEffect } from "react";
import { Toast } from "@/components/ui/Toast";
import { useSelectionStudioToasts } from "../stores/toast-store";

const AUTO_DISMISS_MS = 5000;

export function StudioToastSlot(): JSX.Element | null {
  const toasts = useSelectionStudioToasts((s) => s.toasts);
  const dismiss = useSelectionStudioToasts((s) => s.dismiss);

  // Her toast için 5sn sonra auto-dismiss timer kur. toasts referansı
  // her push/dismiss'te değişir → effect yeniden tetiklenir; cleanup'ta
  // önceki timer'lar temizlenir (multiple push'larda timer kaybolmaz —
  // her toast için 5sn sayaç sürer; pragmatik trade-off, Phase 7 v1).
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => dismiss(t.id), AUTO_DISMISS_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className="text-left"
          aria-label={`Bildirimi kapat: ${t.message}`}
        >
          <Toast tone={t.tone} message={t.message} />
        </button>
      ))}
    </div>
  );
}
