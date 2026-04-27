"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Phase 5 §4.1 R15 — "X görsel üretilecek; bilinçli aksiyon" uyarısı.
// ConfirmDialog warning tone (sarı CTA). Maliyet tahmini sözleşme dışı —
// fake precision verilmez ("~doğrulanmamış" notu).
export function CostConfirmDialog({
  open,
  onOpenChange,
  count,
  busy,
  errorMessage,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  busy: boolean;
  errorMessage?: string | null;
  onConfirm: () => Promise<unknown>;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="AI üretimi başlatılacak"
      description={
        <>
          <span className="block text-text">
            <strong>{count} görsel</strong> üretilecek. Her görsel ayrı kuyruk
            işidir; AI provider&apos;a istek atılır ve maliyet üretir.
          </span>
          <span className="mt-2 block text-xs text-text-muted">
            Tahmini maliyet: doğrulanmamış (sağlayıcı fiyatı sözleşme dışı).
            Bilinçli aksiyonla devam et.
          </span>
        </>
      }
      confirmLabel={`${count} görsel üret`}
      cancelLabel="Vazgeç"
      tone="warning"
      busy={busy}
      errorMessage={errorMessage ?? null}
      onConfirm={async () => {
        await onConfirm();
      }}
    />
  );
}
