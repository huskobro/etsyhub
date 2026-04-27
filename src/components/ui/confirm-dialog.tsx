"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ConfirmTone } from "./confirm-presets";

export type { ConfirmTone };

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  // Phase 5 Task 13/14 — DeleteAssetConfirm ve CostConfirmDialog yapılandırılmış
  // metin (liste, dl, vurgular) gönderiyor. ReactNode geriye uyumlu (string
  // assignable).
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: ConfirmTone;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  /**
   * Handler hata fırlattığında dialog içinde gösterilecek mesaj. Değer set
   * edildiğinde dialog açık kalır ve kullanıcıya retry / vazgeç seçimi verir.
   */
  errorMessage?: string | null;
};

const CONFIRM_TONE_CLASSES: Record<ConfirmTone, string> = {
  destructive: "bg-danger text-white hover:bg-danger/90",
  warning: "bg-warning text-text hover:bg-warning/90",
  neutral: "bg-accent text-accent-foreground hover:bg-accent/90",
};

const BASE_BTN =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "destructive",
  onConfirm,
  busy = false,
  errorMessage = null,
}: ConfirmDialogProps) {
  function handleOpenChange(next: boolean) {
    if (busy) return;
    onOpenChange(next);
  }

  function handleCancel() {
    if (busy) return;
    onOpenChange(false);
  }

  async function handleConfirm() {
    await onConfirm();
  }

  const toneClass = CONFIRM_TONE_CLASSES[tone];

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-text/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-md border border-border bg-surface p-6 shadow-popover focus:outline-none"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (busy) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <Dialog.Title className="text-base font-semibold text-text">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-text-muted">
            {description}
          </Dialog.Description>

          {errorMessage ? (
            <p
              role="alert"
              className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              autoFocus
              onClick={handleCancel}
              disabled={busy}
              className={`${BASE_BTN} border border-border bg-surface-muted text-text hover:bg-surface disabled:opacity-70`}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className={`${BASE_BTN} ${toneClass} disabled:opacity-70`}
            >
              {busy ? "Çalışıyor…" : errorMessage ? "Tekrar dene" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
