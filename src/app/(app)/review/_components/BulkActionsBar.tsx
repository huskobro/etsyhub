"use client";

// Phase 6 Dalga B (Task 16+17) — BulkActionsBar
//
// IA Phase 8 (review experience finalization) — the bar now delegates
// its render to the canonical FloatingBulkBar (`k-fab` recipe in
// globals.css), so review's bulk action surface lives in the same dark
// pill family as Library / Selections / Batches. The dialog wiring
// (approve / reject / delete + skip-on-risk + typing-confirm) is
// unchanged; only the button group, count chip, and close affordance
// switched recipes.
//
// Selection state stays in the Zustand selection store. Action results
// are surfaced via a small inline status line just above the bar so the
// dark pill never carries body text — that's the FloatingBulkBar
// contract Library and Selections already follow.

import { useMemo, useState } from "react";
import { Check, Trash2, X as XIcon } from "lucide-react";
import { useReviewSelection } from "@/features/review/stores/selection-store";
import {
  FloatingBulkBar,
  type BulkAction,
} from "@/components/ui/FloatingBulkBar";
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

  const actions: BulkAction[] = [
    {
      label: "Approve",
      icon: <Check className="h-3.5 w-3.5" aria-hidden />,
      onClick: () => setDialog("approve"),
      primary: true,
    },
    {
      label: "Reject",
      icon: <XIcon className="h-3.5 w-3.5" aria-hidden />,
      onClick: () => setDialog("reject"),
    },
  ];
  if (scope === "local") {
    actions.push({
      label: "Delete",
      icon: <Trash2 className="h-3.5 w-3.5" aria-hidden />,
      onClick: () => setDialog("delete"),
    });
  }

  return (
    <>
      {/* Status line — FloatingBulkBar carries no body text by design;
       *   action results live just above it so they survive the bar's
       *   own state transitions (clear() → bar unmounts after the
       *   message lands). 4-second auto-clear matches the QuickActions
       *   pattern. */}
      {resultMessage ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="bulk-result-message"
          className="pointer-events-none fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-md border border-line bg-paper px-3 py-1.5 text-xs text-text-muted shadow-card"
        >
          {resultMessage}
        </div>
      ) : null}

      <FloatingBulkBar
        count={selectedIds.length}
        actions={actions}
        onClear={() => {
          clear();
          setResultMessage(null);
        }}
      />

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
