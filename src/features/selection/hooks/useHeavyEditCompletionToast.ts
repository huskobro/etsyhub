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

// Pass 32 — Worker fail reason'ı kullanıcıya friendly mesaja çevir.
// Pre-Pass 32: reason teknik geliyordu (örn "Python runner spawn failed:
// spawn python3 ENOENT") ve kullanıcı setup-friction olduğunu anlayamıyordu.
// Şimdi tipik setup hatalarını yakalayıp net Türkçe açıklama dönüyor.
function friendlyFailureMessage(reason: string | undefined): string {
  if (!reason) return "bilinmeyen hata";
  const r = reason.toLowerCase();
  if (r.includes("enoent") || r.includes("spawn") && r.includes("python")) {
    return "Python yüklü değil veya MAGIC_ERASER_PYTHON yolu hatalı (setup gerekli)";
  }
  if (r.includes("pillow") || r.includes("pil ")) {
    return "Pillow Python paketi yüklü değil (pip install Pillow)";
  }
  if (r.includes("simple-lama") || r.includes("lama") && r.includes("install")) {
    return "LaMa modeli yüklü değil (mock runner için MAGIC_ERASER_RUNNER_OVERRIDE kullanın)";
  }
  if (r.includes("mask boyutu") || r.includes("500kb")) {
    return "Mask çok büyük (500KB üstü); fırça ile daha az alan işaretleyin";
  }
  if (r.includes("≤50mb") || r.includes("50mb")) {
    return "Görsel dosyası 50MB'tan büyük; daha küçük görsel kullanın";
  }
  // Fallback — uzun reason'ı ilk 120 karakterle kes
  return reason.length > 120 ? reason.slice(0, 117) + "…" : reason;
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
          message: `${label} başarısız: ${friendlyFailureMessage(lastEntry?.reason)}`,
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
