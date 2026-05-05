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

// Pass 31 — Op-aware kullanıcı mesajları. Pre-Pass 31: "Background remove
// tamamlandı" hardcoded'tu; Magic Eraser tetiklendiğinde de yanlış mesaj
// görünüyordu. Şimdi son history entry'sinin op tipine göre lokalize.
const OP_LABELS: Record<string, string> = {
  "background-remove": "Arka plan silme",
  "magic-eraser": "Magic Eraser",
};

function opLabel(op: string | undefined): string {
  if (!op) return "İşlem";
  return OP_LABELS[op] ?? op;
}

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
      const label = opLabel(lastEntry?.op);

      if (isFailure) {
        push({
          tone: "error",
          message: `${label} başarısız: ${
            lastEntry?.reason ?? "bilinmeyen hata"
          }`,
          source: "heavy-edit",
        });
      } else {
        push({
          tone: "success",
          message: `${label} tamamlandı`,
          source: "heavy-edit",
        });
      }
    }

    prevProcessingRef.current = isProcessing;
  }, [item, push]);
}
