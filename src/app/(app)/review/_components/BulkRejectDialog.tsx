"use client";

// Phase 6 Dalga B (Task 16) — BulkRejectDialog
//
// Reject için skip-on-risk YOK (kullanıcı zaten "reddet" diyor; risk hint'i
// gereksiz). Basit confirm dialog.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Props = {
  scope: "design" | "local";
  ids: string[];
  open: boolean;
  onClose: () => void;
  onSuccess: (result: BulkRejectResult) => void;
};

export type BulkRejectResult = {
  requested: number;
  rejected: number;
  skippedNotFound: number;
};

async function postBulkReject(
  scope: "design" | "local",
  ids: string[],
): Promise<BulkRejectResult> {
  const res = await fetch("/api/review/decisions/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reject", scope, ids }),
  });
  if (!res.ok) throw new Error(`bulk reject failed: ${res.status}`);
  return (await res.json()) as BulkRejectResult;
}

export function BulkRejectDialog({
  scope,
  ids,
  open,
  onClose,
  onSuccess,
}: Props) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => postBulkReject(scope, ids),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      onSuccess(result);
    },
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`Reject ${ids.length} item${ids.length === 1 ? "" : "s"}`}
      description={
        <span>
          The selected <strong className="text-text">{ids.length}</strong>{" "}
          item{ids.length === 1 ? "" : "s"} will be marked as Rejected.
          This counts as an operator decision; the AI pipeline will not
          override it.
        </span>
      }
      confirmLabel="Reject"
      cancelLabel="Cancel"
      tone="destructive"
      busy={mutation.isPending}
      errorMessage={
        mutation.isError ? "Action failed. Please try again." : null
      }
      onConfirm={async () => {
        await mutation.mutateAsync();
      }}
    />
  );
}
