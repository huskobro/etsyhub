"use client";

// Phase 7 Task 29 — HeavyActionButton (background-remove + paralel heavy
// UI yasağı).
//
// Spec Section 3.2 + 5.1 (background-remove heavy edit):
//   - UX: idle → click → mutation pending → spinner; server activeHeavyJobId
//     set ettikten sonra UI "İşleniyor..." moduna düşer.
//   - DB-side lock UI'a yansır: `item.activeHeavyJobId` set ise (Task 10
//     migration alanı, Task 22 endpoint set'liyor) buton DISABLED + spinner +
//     hint; bu süre boyunca aynı item üzerinde başka heavy POST atılamaz.
//   - Polling (Task 39'da SSE/notification entegrasyonu gelene kadar
//     pragmatik): isProcessing iken set GET'i 3 saniye aralıkla invalidate;
//     job tamamlanınca server `activeHeavyJobId = null` döner → polling
//     durur.
//   - Failure: inline `role="alert"` mesaj + "Tekrar dene" buton (Phase 7 v1
//     pattern; QuickActions transparent-check ile tutarlı, page-level Toast
//     yerine kontekstüel inline).
//
// Mutation endpoint (Task 22):
//   POST /api/selection/sets/[setId]/items/[itemId]/edit/heavy
//   body: { op: "background-remove" }
//   200 → { jobId }
//
// Tip:
//   `item.activeHeavyJobId: string | null` Prisma `SelectionItem` alanı; queries.ts
//   `SelectionItemView = SelectionItem & { review }` ile otomatik dahil.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SelectionItemView } from "../queries";
import { selectionSetQueryKey } from "../queries";
import { ImageOff, AlertTriangle } from "lucide-react";
import { useHeavyEditCompletionToast } from "../hooks/useHeavyEditCompletionToast";

export type HeavyActionButtonProps = {
  setId: string;
  item: SelectionItemView;
  isReadOnly: boolean;
};

export function HeavyActionButton({
  setId,
  item,
  isReadOnly,
}: HeavyActionButtonProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isProcessing = !!item.activeHeavyJobId;

  // Task 39 — heavy edit completion/failure → page-level Toast (fail-safe;
  // inline UI ana yüzey, toast SR + görünürlük takviyesi).
  useHeavyEditCompletionToast(item);

  // Polling — job aktifken set query'sini 3 saniyede bir invalidate et.
  // useQuery `enabled: isProcessing` ile job bitince polling durur. Gerçek
  // veri set query'sinden gelir; bu hook yalnız invalidate tetikler. Task 39
  // SSE/notification entegrasyonu sonrası bu polling kaldırılabilir.
  useQuery({
    queryKey: ["selection", "set", setId, "heavy-poll", item.id],
    queryFn: async () => {
      await queryClient.invalidateQueries({
        queryKey: selectionSetQueryKey(setId),
      });
      return Date.now();
    },
    enabled: isProcessing,
    refetchInterval: isProcessing ? 3000 : false,
    staleTime: 0,
  });

  const heavyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/selection/sets/${setId}/items/${item.id}/edit/heavy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "background-remove" }),
        },
      );
      if (!res.ok) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: string };
          detail = typeof body.error === "string" ? body.error : "";
        } catch {
          // ignore parse hatası
        }
        throw new Error(detail ? detail : `İşlem başarısız (${res.status})`);
      }
      return (await res.json()) as { jobId: string };
    },
    onSuccess: () => {
      setErrorMessage(null);
      // Server `activeHeavyJobId` set etti; invalidate ile UI processing
      // moduna düşer.
      queryClient.invalidateQueries({
        queryKey: selectionSetQueryKey(setId),
      });
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
    },
  });

  const handleClick = () => {
    if (isReadOnly || isProcessing || heavyMutation.isPending) return;
    setErrorMessage(null);
    heavyMutation.mutate();
  };

  const showSpinner = isProcessing || heavyMutation.isPending;
  const disabled = isReadOnly || isProcessing || heavyMutation.isPending;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="flex h-control-md w-full items-center gap-2 rounded-md border border-border bg-transparent px-3 text-sm text-text transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={
          isProcessing
            ? "Background remove işleniyor"
            : "Background remove"
        }
      >
        <span className="text-text-muted">
          <ImageOff className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1 text-left">
          {isProcessing ? "İşleniyor..." : "Background remove"}
        </span>
        {showSpinner ? (
          <span
            className="h-3 w-3 animate-spin rounded-full border-2 border-text-muted border-t-transparent"
            aria-label="Yükleniyor"
          />
        ) : null}
      </button>

      {/* Hint — job devam ediyor */}
      {isProcessing && !errorMessage ? (
        <p className="px-1 text-xs text-text-muted">
          ~5-15 saniye sürebilir
        </p>
      ) : null}

      {/* Inline error + retry — mutation fail */}
      {errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-1.5 rounded-md border border-danger bg-danger-soft px-2 py-1.5 text-xs text-danger"
        >
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <div className="flex-1">
            <div>{errorMessage}</div>
            <button
              type="button"
              onClick={handleClick}
              className="mt-1 underline hover:no-underline"
            >
              Tekrar dene
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
