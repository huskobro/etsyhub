"use client";

// Phase 6 Dalga B (Task 16) — BulkApproveDialog
//
// Karar 3: Bulk approve confirm dialog skip-on-risk hint'i ile.
// Dialog'da kullanıcıya: "X temiz onaylanır, Y risk atlanır" mesajı.
//
// Hint queue cache'inden hesaplanır (server'a fazladan istek yok); ancak
// gerçek karar server'da (endpoint) verilir — UI hint sadece kullanıcıya
// önceden bilgi (sessiz fallback YASAK; server tek doğru kaynak).

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useReviewQueue,
  type ReviewQueueItem,
} from "@/features/review/queries";

type Props = {
  scope: "design" | "local";
  ids: string[];
  open: boolean;
  onClose: () => void;
  onSuccess: (result: BulkApproveResult) => void;
};

export type BulkApproveResult = {
  requested: number;
  approved: number;
  skippedRisky: number;
  skippedRiskyIds: string[];
  skippedNotFound: number;
};

async function postBulkApprove(
  scope: "design" | "local",
  ids: string[],
): Promise<BulkApproveResult> {
  const res = await fetch("/api/review/decisions/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve", scope, ids }),
  });
  if (!res.ok) throw new Error(`bulk approve failed: ${res.status}`);
  return (await res.json()) as BulkApproveResult;
}

export function BulkApproveDialog({
  scope,
  ids,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { data } = useReviewQueue({ scope });
  const queryClient = useQueryClient();

  // UI hint: cache'ten risk durumu hesapla. Cache miss durumunda hint yok
  // (server karar verir); fallback: confirm cümlesi sayı belirsiz.
  const hint = useMemo(() => {
    if (!data) return { safeCount: ids.length, riskyCount: 0 };
    const map = new Map<string, ReviewQueueItem>();
    for (const it of data.items) map.set(it.id, it);
    let safe = 0;
    let risky = 0;
    for (const id of ids) {
      const item = map.get(id);
      if (!item) continue;
      if (item.riskFlagCount > 0) risky += 1;
      else safe += 1;
    }
    return { safeCount: safe, riskyCount: risky };
  }, [data, ids]);

  const mutation = useMutation({
    mutationFn: () => postBulkApprove(scope, ids),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      onSuccess(result);
    },
  });

  const description = (
    <span>
      Risk işareti taşıyan{" "}
      <strong className="text-text">{hint.riskyCount}</strong> tasarım atlanacak;{" "}
      <strong className="text-text">{hint.safeCount}</strong> temiz tasarım{" "}
      Approve anyway olarak işaretlenecek.
    </span>
  );

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`${ids.length} tasarımı onayla`}
      description={description}
      confirmLabel="Onayla"
      cancelLabel="Vazgeç"
      tone="neutral"
      busy={mutation.isPending}
      errorMessage={
        mutation.isError ? "İşlem başarısız oldu. Tekrar deneyin." : null
      }
      onConfirm={async () => {
        await mutation.mutateAsync();
      }}
    />
  );
}
