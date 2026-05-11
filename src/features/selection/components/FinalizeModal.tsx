"use client";

// Phase 7 Task 35 — FinalizeModal (selected ≥ 1 gate UX + breakdown).
//
// Spec Section 2.5 (finalize akışı):
//   - Gate: selected ≥ 1 — modal'da görünür uyarı + Finalize butonu disabled.
//   - Breakdown text: X seçili / Y beklemede / Z reddedildi.
//   - Dürüst handoff: yalnız "selected" variants in the next phase 8 Mockup Studio
//     input'u olur. Pending/rejected manifest'e dahil ama Mockup Studio'ya
//     geçmez.
//   - Onay sonrası: draft → ready, item status'ları donar (state machine
//     guard server-side — Task 4/22), set düzenlenemez.
//
// Server endpoint: POST /api/selection/sets/[setId]/finalize (Task 22).
//   - 200 → set { id, status: "ready", finalizedAt }
//   - 409 FinalizeGateError → "selected ≥ 1 gate" sunucu tarafı kontrolü
//   - 409 SetReadOnlyError → set zaten finalize edilmiş
//
// Gate UX katmanları:
//   - StudioShell üst bar Finalize butonu: 0 selected → disabled + native
//     title tooltip. Modal hiç açılmaz (kullanıcı yanlış aksiyona girmez).
//   - Modal kendisi defensive olarak gate'i tekrar kontrol eder: items prop
//     değişebilir (örn. modal açıkken bir varyant rejected'a alınırsa).
//     Gate fail → uyarı mesajı + Finalize disabled.
//
// Phase 6 emsali: BulkHardDeleteDialog (Task 34) + CreateSetModal (Task 24)
// — Radix Dialog Portal/Overlay/Content paterni, mutation pending state,
// onSuccess invalidate + onOpenChange(false).

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/Button";
import { selectionSetQueryKey } from "../queries";
import type { SelectionItemView } from "../queries";

export type FinalizeModalProps = {
  setId: string;
  items: SelectionItemView[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FinalizeModal({
  setId,
  items,
  open,
  onOpenChange,
}: FinalizeModalProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal kapandığında error state'i temizle. Yeniden açıldığında temiz
  // bir surface ile başlar (BulkHardDeleteDialog emsali).
  useEffect(() => {
    if (!open) setErrorMessage(null);
  }, [open]);

  // Breakdown — items array'inden status'a göre sayım. Multi-select state
  // değil; "selected" status'un kendisi.
  const selectedCount = items.filter((i) => i.status === "selected").length;
  const pendingCount = items.filter((i) => i.status === "pending").length;
  const rejectedCount = items.filter((i) => i.status === "rejected").length;
  const gateOk = selectedCount >= 1;

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/selection/sets/${setId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: unknown };
          if (typeof body.error === "string") detail = body.error;
        } catch {
          // ignore parse hatası
        }
        throw new Error(detail || `Finalize başarısız (${res.status})`);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: selectionSetQueryKey(setId) });
      setErrorMessage(null);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
    },
  });

  function handleOpenChange(next: boolean) {
    if (finalizeMutation.isPending) return;
    onOpenChange(next);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-text/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-md border border-border bg-surface p-6 shadow-popover focus:outline-none"
          onEscapeKeyDown={(e) => {
            if (finalizeMutation.isPending) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (finalizeMutation.isPending) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (finalizeMutation.isPending) e.preventDefault();
          }}
        >
          <Dialog.Title className="text-lg font-semibold text-text">
            Set&apos;i finalize et
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-text-muted">
            Bu set Mockup Studio&apos;ya hazır olarak işaretlenecek.
          </Dialog.Description>

          {/* Breakdown grid — selected / pending / rejected.
              data-testid'leri test seçicileri için stabil; açıklama
              metninde de "Beklemede"/"Reddedilen" geçtiği için label'a
              güvenilen `getByText` ambigous olur — testid net ayrım. */}
          <div className="mt-4 rounded-md border border-border bg-surface-2 px-3 py-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div data-testid="finalize-breakdown-selected">
                <div className="font-mono text-2xl font-semibold text-success">
                  {selectedCount}
                </div>
                <div className="text-xs text-text-muted">Selected</div>
              </div>
              <div data-testid="finalize-breakdown-pending">
                <div className="font-mono text-2xl font-semibold text-text-muted">
                  {pendingCount}
                </div>
                <div className="text-xs text-text-muted">Beklemede</div>
              </div>
              <div data-testid="finalize-breakdown-rejected">
                <div className="font-mono text-2xl font-semibold text-text-muted">
                  {rejectedCount}
                </div>
                <div className="text-xs text-text-muted">Reddedildi</div>
              </div>
            </div>
          </div>

          {/* Dürüst handoff açıklaması */}
          <div className="mt-4 space-y-2 text-xs text-text-muted">
            <p>
              <span className="text-text">Only selected</span> variants in the next phase
              8 Mockup Studio input&apos;u olur.
            </p>
            <p>
              <span className="text-text">Beklemede</span> ve{" "}
              <span className="text-text">reddedilen</span> varyantlar
              dondurulur — sonradan değiştirilemez. Manifest dosyasına dahil
              olur ama Mockup Studio&apos;ya geçmez.
            </p>
            <p>
              After finalize, the set is <span className="text-text">read-only</span>
              {" "}
              (yeni varyant ekleme, edit, status değişimi tümü pasif).
            </p>
          </div>

          {/* Gate fail uyarısı (selectedCount === 0) */}
          {!gateOk && (
            <p
              role="status"
              className="mt-3 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning"
            >
              En az 1 &apos;Seçime ekle&apos; yapılmış varyant gerekli.
            </p>
          )}

          {/* Submit hatası inline alert */}
          {errorMessage && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {errorMessage}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={finalizeMutation.isPending}
            >
              İptal
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => finalizeMutation.mutate()}
              disabled={!gateOk || finalizeMutation.isPending}
            >
              {finalizeMutation.isPending
                ? "Finalize ediliyor..."
                : "Finalize et"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
