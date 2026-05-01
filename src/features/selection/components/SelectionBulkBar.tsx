"use client";

// Phase 7 Task 33 — SelectionBulkBar (multi-select sticky bottom action bar).
//
// Spec Section 3.2 (multi-select sticky bottom bar):
//   - Filmstrip'te shift/cmd-click ile multiSelectIds dolduğunda görünür.
//   - Aksiyonlar: "Seçime ekle (N)" + "Reddet (N)".
//   - Filter "Reddedilenler" ise ek aksiyon: "Kalıcı çıkar (N)" → Task 34
//     TypingConfirmation modal'ı tetikler (Task 33'te yalnız callback).
//
// Phase 6 primitive reuse:
//   - `BulkActionBar` (canvas A.1.11) — accent-soft bg, sol checkmark chip,
//     Türkçe label, opsiyonel sticky/dismiss. Burada `sticky` aktif: filmstrip
//     scroll edilirken bar bottom'da sabit kalır.
//   - `Button` primitive — variant secondary/primary/ghost; size sm.
//
// Read-only invariant (Phase 7 set state-machine):
//   - status !== "draft" → bar görünmez. Multi-select state olsa bile UI
//     bulk mutation tetikleyemez. Server `assertSetMutable` (Task 4) zaten
//     409 atar; defense-in-depth olarak UI tarafında gating var.
//
// Hard delete callback paterni (Task 33 → Task 34):
//   - `onHardDeleteRequest(itemIds)` → parent (StudioShell) state set eder
//     (`hardDeletePendingIds`); Task 34'te TypingConfirmation modal o state'e
//     bağlanır. Task 33'te yalnız callback signature'ı sabitlenir.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, XCircle, Trash2 } from "lucide-react";

import { useStudioStore } from "../stores/studio-store";
import { selectionSetQueryKey } from "../queries";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { Button } from "@/components/ui/Button";

export type SelectionBulkBarProps = {
  setId: string;
  /** Read-only invariant: ready/archived set'te bar render edilmez. */
  isReadOnly: boolean;
  /**
   * Hard delete callback — Task 34 TypingConfirmation modal'ı tetiklemek için.
   * Verilmezse buton click no-op. Modal entegrasyonu Task 34'te yapılır.
   */
  onHardDeleteRequest?: (itemIds: string[]) => void;
};

export function SelectionBulkBar({
  setId,
  isReadOnly,
  onHardDeleteRequest,
}: SelectionBulkBarProps) {
  const queryClient = useQueryClient();
  const multiSelectIds = useStudioStore((s) => s.multiSelectIds);
  const filter = useStudioStore((s) => s.filter);
  const clearMultiSelect = useStudioStore((s) => s.clearMultiSelect);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusMutation = useMutation({
    mutationFn: async ({
      status,
      itemIds,
    }: {
      status: "selected" | "rejected" | "pending";
      itemIds: string[];
    }) => {
      const res = await fetch(`/api/selection/sets/${setId}/items/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds, status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof (body as { error?: unknown }).error === "string"
            ? (body as { error: string }).error
            : `Bulk işlemi başarısız (${res.status})`;
        throw new Error(message);
      }
      return (await res.json()) as { updatedCount: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: selectionSetQueryKey(setId) });
      clearMultiSelect();
      setErrorMessage(null);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
    },
  });

  const count = multiSelectIds.size;
  // Erken çıkış: Read-only veya boş seçim → bar render edilmez.
  if (count === 0 || isReadOnly) return null;

  const showHardDelete = filter === "rejected";
  const isPending = statusMutation.isPending;

  return (
    <>
      <BulkActionBar
        selectedCount={count}
        label={`${count} varyant seçildi`}
        sticky
        onDismiss={clearMultiSelect}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<XCircle className="h-3.5 w-3.5" aria-hidden />}
              onClick={() =>
                statusMutation.mutate({
                  status: "rejected",
                  itemIds: Array.from(multiSelectIds),
                })
              }
              disabled={isPending}
            >
              Reddet ({count})
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
              onClick={() =>
                statusMutation.mutate({
                  status: "selected",
                  itemIds: Array.from(multiSelectIds),
                })
              }
              disabled={isPending}
            >
              Seçime ekle ({count})
            </Button>
            {showHardDelete && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="h-3.5 w-3.5 text-danger" aria-hidden />}
                onClick={() =>
                  onHardDeleteRequest?.(Array.from(multiSelectIds))
                }
                disabled={isPending}
                className="text-danger"
              >
                Kalıcı çıkar ({count})
              </Button>
            )}
          </div>
        }
      />
      {errorMessage && (
        <div
          role="alert"
          className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-xs text-danger"
        >
          {errorMessage}
        </div>
      )}
    </>
  );
}
