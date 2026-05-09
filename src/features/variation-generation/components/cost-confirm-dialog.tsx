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
      title="AI generation will start"
      description={
        <>
          <span className="block text-text">
            <strong>{count} images</strong> will be generated. Each image is
            a separate queue job; the AI provider is hit per request and
            incurs cost.
          </span>
          <span className="mt-2 block text-xs text-text-muted">
            Estimated cost: unverified (provider pricing is out of scope).
            Confirm only if you intend to proceed.
          </span>
        </>
      }
      confirmLabel={`Generate ${count} images`}
      cancelLabel="Cancel"
      tone="warning"
      busy={busy}
      errorMessage={errorMessage ?? null}
      onConfirm={async () => {
        await onConfirm();
      }}
    />
  );
}
