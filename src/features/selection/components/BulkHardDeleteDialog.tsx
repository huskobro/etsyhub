"use client";

// Phase 7 Task 34 — BulkHardDeleteDialog (TypingConfirmation primitive reuse).
//
// Spec Section 2.2 (TypingConfirmation server-side enforcement) +
// Section 7.2 (POST /items/bulk-delete endpoint).
//
// Bağlam:
//   - Filmstrip filter "Reddedilenler" + multi-select varken SelectionBulkBar
//     "Kalıcı çıkar (N)" butonu görünür (Task 33). Bu buton parent'a
//     `onHardDeleteRequest(ids)` callback'i atar.
//   - StudioShell `hardDeletePendingIds` state'ini set eder; bu state
//     dolduğunda BulkHardDeleteDialog `open=true` ile mount edilir.
//   - Kullanıcı `phrase="SİL"` (Türkçe büyük İ) yazana kadar confirm disabled
//     (TypingConfirmation primitive — Phase 6 reuse). Yazınca POST
//     /items/bulk-delete tetiklenir; sentinel server-side de zod literal "SİL"
//     ile zorunlu (Task 21 endpoint).
//
// Phase 6 emsali: src/app/(app)/review/_components/BulkDeleteDialog.tsx —
// Radix Dialog + TypingConfirmation entegrasyonu. Phase 6 component'ine
// dokunulmaz; bu dosya Phase 7 ayrı bir tüketici (review scope ≠ selection
// scope, body shape farklı: { itemIds, confirmation: "SİL" }).
//
// Token discipline:
//   - Overlay `bg-text/40` (CreateSetModal + AddVariantsDrawer ile aynı)
//   - Modal `bg-surface border-border shadow-popover`
//   - Inline alert `border-danger bg-danger-soft text-danger`
//   - Hardcoded renk YOK; arbitrary value YOK.
//
// Read-only invariant:
//   - Server `assertSetMutable` (Task 4) ready/archived set'te 409 atar; UI
//     SelectionBulkBar `isReadOnly` gating ile bar'ı zaten gizler. Modal
//     teorik olarak ulaşılmaz; defensive 409 inline alert hâlâ render edilir.

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";

import { TypingConfirmation } from "@/components/ui/TypingConfirmation";
import { useStudioStore } from "../stores/studio-store";
import { selectionSetQueryKey } from "../queries";

export type BulkHardDeleteDialogProps = {
  /** Hangi set'ten silinecek (route slug). */
  setId: string;
  /** Silinecek item id'leri (BulkBar onHardDeleteRequest payload'ı). */
  itemIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BulkHardDeleteDialog({
  setId,
  itemIds,
  open,
  onOpenChange,
}: BulkHardDeleteDialogProps) {
  const queryClient = useQueryClient();
  const clearMultiSelect = useStudioStore((s) => s.clearMultiSelect);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal kapandığında → açıldığında hata mesajı sıfırlansın. Aksi halde
  // önceki hata yeni açılışta hâlâ görünür kalırdı.
  useEffect(() => {
    if (!open) setErrorMessage(null);
  }, [open]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/selection/sets/${setId}/items/bulk-delete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds, confirmation: "SİL" }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof (body as { error?: unknown }).error === "string"
            ? (body as { error: string }).error
            : `Kalıcı çıkarma başarısız (${res.status})`;
        throw new Error(message);
      }
      return (await res.json()) as { deletedCount: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: selectionSetQueryKey(setId) });
      clearMultiSelect();
      setErrorMessage(null);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
    },
  });

  const count = itemIds.length;
  const isPending = deleteMutation.isPending;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (isPending) return; // mutation pending iken kapatma engelli
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-text/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-md border border-border bg-surface p-6 shadow-popover focus:outline-none"
          data-testid="bulk-hard-delete-dialog"
          onEscapeKeyDown={(e) => {
            if (isPending) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (isPending) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (isPending) e.preventDefault();
          }}
        >
          <Dialog.Title className="text-base font-semibold text-text">
            Permanently remove
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-text-muted">
            {count} rejected variant{count === 1 ? "" : "s"} will be permanently
            removed from this set. Asset files are preserved (they may still be
            used by another set). This action cannot be undone.
          </Dialog.Description>

          <div className="mt-4">
            {/*
              TypingConfirmation primitive (Phase 6 reuse) — phrase "SİL"
              (Türkçe büyük İ). Server zod literal "SİL" ile uyumlu; case
              veya whitespace farkı reject edilir (Task 21).
            */}
            <TypingConfirmation
              phrase="SİL"
              buttonLabel={`Permanently remove (${count})`}
              isLoading={isPending}
              onConfirm={() => deleteMutation.mutate()}
            />
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="mt-4 rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-md border border-border bg-surface-muted px-4 py-2 text-sm font-medium text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-70"
            >
              Cancel
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
