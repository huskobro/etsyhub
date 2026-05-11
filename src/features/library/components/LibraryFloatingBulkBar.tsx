"use client";

import { useState } from "react";
import { Layers, Sparkles, Download, Trash2 } from "lucide-react";
import { FloatingBulkBar } from "@/components/ui/FloatingBulkBar";
import { useLibrarySelection } from "@/features/library/stores/selection-store";
import { AddToSelectionModal } from "@/features/selections/components/AddToSelectionModal";

/**
 * LibraryFloatingBulkBar — Library-scope wiring for the global FloatingBulkBar.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a1-a2.jsx
 * → A1Library FloatingBulk.
 *
 * Surface boundary: actions here are *handoffs*, not Library-internal CRUD.
 * - "Add to Selection" hands off to Selections (R4 modal — wired below).
 * - "Variations" hands off to A6 Create Variations modal (rollout-3).
 * - "Export" downloads selected assets as a ZIP (rollout-3+ wiring).
 * - "Remove" deletes asset rows (rollout-3+ wiring).
 */
export function LibraryFloatingBulkBar() {
  const count = useLibrarySelection((s) => s.selected.size);
  const clear = useLibrarySelection((s) => s.clear);
  const ids = useLibrarySelection((s) => s.ids);
  const [pickedIds, setPickedIds] = useState<string[] | null>(null);

  if (count < 2 && pickedIds === null) return null;

  return (
    <>
      {count >= 2 ? (
        <FloatingBulkBar
          count={count}
          onClear={clear}
          actions={[
            {
              label: "Add to Selection",
              icon: <Layers className="h-3.5 w-3.5" aria-hidden />,
              primary: true,
              onClick: () => setPickedIds(ids()),
            },
            {
              label: "Variations",
              icon: <Sparkles className="h-3.5 w-3.5" aria-hidden />,
              // Wired in rollout-3 (A6 modal)
              disabled: true,
            },
            {
              label: "Export",
              icon: <Download className="h-3.5 w-3.5" aria-hidden />,
              disabled: true,
            },
            {
              label: "Remove",
              icon: <Trash2 className="h-3.5 w-3.5" aria-hidden />,
              disabled: true,
            },
          ]}
        />
      ) : null}
      {pickedIds !== null ? (
        <AddToSelectionModal
          midjourneyAssetIds={pickedIds}
          onClose={() => setPickedIds(null)}
          onSuccess={() => {
            clear();
          }}
        />
      ) : null}
    </>
  );
}
