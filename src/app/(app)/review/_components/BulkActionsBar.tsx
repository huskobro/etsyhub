"use client";

// Phase 6 Dalga B (Task 16+17) — BulkActionsBar
//
// Sticky bottom action bar — selectedIds > 0 ise görünür.
// Karar 6: tek bulk endpoint (approve | reject | delete) — barda 3 buton
// (delete sadece local scope'ta).
//
// Selection state Zustand store'da; bar store'u dinler. Action sonrası
// "${result}" mesajı kart altında 4 saniye görünür (basit inline toast),
// sonra clear() ile selection sıfırlanır.

import { useMemo, useState } from "react";
import { useReviewSelection } from "@/features/review/stores/selection-store";
import { Button } from "@/components/ui/Button";
import { BulkApproveDialog } from "./BulkApproveDialog";
import { BulkRejectDialog } from "./BulkRejectDialog";
import { BulkDeleteDialog } from "./BulkDeleteDialog";

type Props = { scope: "design" | "local" };

type Dialog = "approve" | "reject" | "delete" | null;

export function BulkActionsBar({ scope }: Props) {
  // Set referansı doğrudan selector döndürelim (referential stable);
  // Array.from'u memoize ederek child'lara stabil prop verelim. Aksi halde
  // selector her render'da yeni array üretir ⇒ infinite re-render.
  const selectedSet = useReviewSelection((s) => s.selectedIds);
  const selectedIds = useMemo(() => Array.from(selectedSet), [selectedSet]);
  const clear = useReviewSelection((s) => s.clear);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const close = () => setDialog(null);

  return (
    <>
      <div
        role="region"
        aria-label="Toplu eylemler"
        data-testid="bulk-actions-bar"
        className="sticky bottom-4 z-20 mx-auto flex w-full max-w-screen-xl flex-col gap-2 rounded-md border border-border bg-surface p-3 shadow-popover"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-text">
            {selectedIds.length} öğe seçildi
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setDialog("approve")}
            data-testid="bulk-approve-trigger"
          >
            Onayla ({selectedIds.length})
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDialog("reject")}
            data-testid="bulk-reject-trigger"
          >
            Reddet ({selectedIds.length})
          </Button>
          {scope === "local" ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDialog("delete")}
              data-testid="bulk-delete-trigger"
            >
              Sil ({selectedIds.length})
            </Button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              clear();
              setResultMessage(null);
            }}
            data-testid="bulk-clear"
            className="ml-auto text-sm text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            İptal
          </button>
        </div>
        {resultMessage ? (
          <p
            role="status"
            aria-live="polite"
            data-testid="bulk-result-message"
            className="text-xs text-text-muted"
          >
            {resultMessage}
          </p>
        ) : null}
      </div>

      <BulkApproveDialog
        scope={scope}
        ids={selectedIds}
        open={dialog === "approve"}
        onClose={close}
        onSuccess={(result) => {
          close();
          clear();
          setResultMessage(
            result.skippedRisky > 0
              ? `${result.approved} tasarım onaylandı, ${result.skippedRisky} risk işaretli atlandı.`
              : `${result.approved} tasarım onaylandı.`,
          );
        }}
      />
      <BulkRejectDialog
        scope={scope}
        ids={selectedIds}
        open={dialog === "reject"}
        onClose={close}
        onSuccess={(result) => {
          close();
          clear();
          setResultMessage(`${result.rejected} tasarım reddedildi.`);
        }}
      />
      {scope === "local" ? (
        <BulkDeleteDialog
          ids={selectedIds}
          open={dialog === "delete"}
          onClose={close}
          onSuccess={(result) => {
            close();
            clear();
            setResultMessage(`${result.deleted} asset silindi.`);
          }}
        />
      ) : null}
    </>
  );
}
