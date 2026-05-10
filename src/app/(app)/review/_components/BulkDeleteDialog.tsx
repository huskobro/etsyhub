"use client";

// Phase 6 Dalga B (Task 17) — BulkDeleteDialog (typing confirmation)
//
// Karar 5: local soft-delete (isUserDeleted=true + deletedAt=now).
// Karar 4: typing confirmation phrase = "SİL" (Türkçe).
//
// Phase 5 carry-forward "destructive-typing-confirmation" — yıkıcı işlemde
// kullanıcı "SİL" yazmadan confirm enabled olmaz.
//
// Sadece local scope için. Design scope için bulk delete YOK (Not 1).

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { TypingConfirmation } from "@/components/ui/TypingConfirmation";

type Props = {
  ids: string[];
  open: boolean;
  onClose: () => void;
  onSuccess: (result: BulkDeleteResult) => void;
};

export type BulkDeleteResult = {
  requested: number;
  deleted: number;
  skippedNotFound: number;
};

async function postBulkDelete(ids: string[]): Promise<BulkDeleteResult> {
  const res = await fetch("/api/review/decisions/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", scope: "local", ids }),
  });
  if (!res.ok) throw new Error(`bulk delete failed: ${res.status}`);
  return (await res.json()) as BulkDeleteResult;
}

export function BulkDeleteDialog({ ids, open, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => postBulkDelete(ids),
    onSuccess: (result) => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      onSuccess(result);
    },
    onError: () => {
      setError("Delete failed. Try again.");
    },
  });

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-text/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-md border border-border bg-surface p-6 shadow-popover focus:outline-none"
          data-testid="bulk-delete-dialog"
          onEscapeKeyDown={(e) => {
            if (mutation.isPending) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (mutation.isPending) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (mutation.isPending) e.preventDefault();
          }}
        >
          <Dialog.Title className="text-base font-semibold text-text">
            Delete {ids.length} asset{ids.length === 1 ? "" : "s"}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-text-muted">
            This cannot be undone. Assets are removed from the local
            library (disk files are not deleted).
          </Dialog.Description>

          <div className="mt-4">
            {/*
              message prop verilmiyor: TypingConfirmation kendi typing
              yönergesini ("Onaylamak için aşağıya `SİL` yazın:") render
              ediyor. Yıkıcı uyarı zaten Dialog.Description'da.
              Daha önce message="Onaylamak için aşağıya yazın:" geçiyordu,
              component cümlesiyle çakışıp iki ardışık cümle olarak
              gözüküyordu (Dalga B polish — UX bug fix).
            */}
            <TypingConfirmation
              phrase="DELETE"
              buttonLabel={`Delete ${ids.length} asset${ids.length === 1 ? "" : "s"}`}
              isLoading={mutation.isPending}
              onConfirm={() => mutation.mutate()}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="inline-flex items-center justify-center rounded-md border border-border bg-surface-muted px-4 py-2 text-sm font-medium text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-70"
            >
              Vazgeç
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
