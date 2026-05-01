"use client";

// Phase 7 Task 39 — Heavy edit completion/failure → page-level Toast.
//
// Spec Section 3.3: heavy edit (background-remove) tamamlanınca veya
// fail olunca page-level Toast push. Inline UI ana yüzey; toast ek
// görünürlük (sayfada kalsa SR + visual reinforcement; sayfadan ayrılırsa
// fail-safe).
//
// State machine — `item.activeHeavyJobId`:
//   - Processing: !!activeHeavyJobId (Task 10 worker DB-side lock).
//   - Idle: activeHeavyJobId === null.
//
// Transition processing → idle:
//   - editHistoryJson son entry'de `failed: true` → error toast (reason).
//   - aksi → success toast.
//
// `prevProcessingRef` ile prev state karşılaştırması yapılır; ilk render'da
// (mount) push yok (transition gerekli).

import { useEffect, useRef } from "react";
import { useSelectionStudioToasts } from "../stores/toast-store";
import type { SelectionItemView } from "../queries";

type HistoryEntry = {
  op: string;
  failed?: boolean;
  reason?: string;
};

export function useHeavyEditCompletionToast(
  item: SelectionItemView | null,
): void {
  const push = useSelectionStudioToasts((s) => s.push);
  const prevProcessingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!item) {
      prevProcessingRef.current = false;
      return;
    }
    const isProcessing = !!item.activeHeavyJobId;
    const wasProcessing = prevProcessingRef.current;

    // Transition: processing → idle (completion or failure)
    if (wasProcessing && !isProcessing) {
      const history = Array.isArray(item.editHistoryJson)
        ? (item.editHistoryJson as unknown as HistoryEntry[])
        : [];
      const lastEntry = history[history.length - 1];
      const isFailure = lastEntry?.failed === true;

      if (isFailure) {
        push({
          tone: "error",
          message: `Background remove başarısız: ${
            lastEntry?.reason ?? "bilinmeyen hata"
          }`,
          source: "heavy-edit",
        });
      } else {
        push({
          tone: "success",
          message: "Background remove tamamlandı",
          source: "heavy-edit",
        });
      }
    }

    prevProcessingRef.current = isProcessing;
  }, [item, push]);
}
