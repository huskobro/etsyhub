"use client";

// Phase 6 Dalga B (Task 15) — ReviewDetailActions
//
// Detay panelin action grubu: Approve anyway / Reject / Reset to system.
// Karar 2: Approve/Reject SADECE panelden — kart üstünde tek-tık aksiyon yok.
//
// Sticky kontrat (R12):
//   - Approve disabled when SYSTEM APPROVED — zaten onaylı, override anlamsız.
//     Tooltip: "Zaten SYSTEM tarafından onaylandı".
//   - Reset visible YALNIZCA reviewStatusSource === "USER". SYSTEM kararı için
//     reset göstermek gereksiz (aynı SYSTEM tekrar tetiklenir, idempotent).
//   - Local scope reset için PATCH endpoint productTypeKey ZORUNLU; UI bunu
//     görüntülemediğinden default "wall_art" gönderiyoruz (Phase 6 Task 11
//     spec'inde bu alan zorunlu — ileride Recipes ile bağlanır).
//
// React Query: tüm mutation'lar başarı sonrası ["review-queue"] invalidate;
// queue UI yeni status'u otomatik fetch eder. Detail panel acık kalır —
// kullanıcı sonucu (badge değişimi) görsün.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReviewQueueItem } from "@/features/review/queries";

type Props = {
  item: ReviewQueueItem;
  scope: "design" | "local";
};

async function postDecision(
  scope: "design" | "local",
  id: string,
  decision: "APPROVED" | "REJECTED",
): Promise<void> {
  const res = await fetch("/api/review/decisions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, id, decision }),
  });
  if (!res.ok) throw new Error(`decision failed: ${res.status}`);
}

async function patchReset(
  scope: "design" | "local",
  id: string,
): Promise<void> {
  const body: Record<string, unknown> = { scope, id };
  if (scope === "local") {
    // PATCH local'de productTypeKey ZORUNLU (Karar 3, Phase 6 Task 11).
    // UI henüz product type seçim arayüzüne sahip değil — default kullanılıyor.
    body.productTypeKey = "wall_art";
  }
  const res = await fetch("/api/review/decisions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`reset failed: ${res.status}`);
}

export function ReviewDetailActions({ item, scope }: Props) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["review-queue"] });

  const approveMutation = useMutation({
    mutationFn: () => postDecision(scope, item.id, "APPROVED"),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e) => setError((e as Error).message),
  });

  const rejectMutation = useMutation({
    mutationFn: () => postDecision(scope, item.id, "REJECTED"),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e) => setError((e as Error).message),
  });

  const resetMutation = useMutation({
    mutationFn: () => patchReset(scope, item.id),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e) => setError((e as Error).message),
  });

  const isLoading =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    resetMutation.isPending;

  // Sticky kontrat: SYSTEM zaten APPROVED ise ek "Approve anyway" anlamsız.
  const approveDisabled =
    item.reviewStatus === "APPROVED" && item.reviewStatusSource === "SYSTEM" ||
    isLoading;
  const approveTitle =
    item.reviewStatus === "APPROVED" && item.reviewStatusSource === "SYSTEM"
      ? "Zaten SYSTEM tarafından onaylandı"
      : "Kullanıcı onayı (Approve anyway)";

  const resetVisible = item.reviewStatusSource === "USER";

  return (
    // Pass 27 — Container'ın border-t/pt'si kaldırıldı; ReviewDetailPanel
    // bu component'i artık sticky <footer> içinde render ediyor (panel
    // border'ı footer wrapper'da). Çift border önlendi.
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="detail-approve"
          onClick={() => approveMutation.mutate()}
          disabled={approveDisabled}
          aria-label="Approve anyway"
          title={approveTitle}
          className="flex-1 rounded-md bg-success px-4 py-2 text-sm font-medium text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {approveMutation.isPending ? "…" : "Approve anyway"}
        </button>
        <button
          type="button"
          data-testid="detail-reject"
          onClick={() => rejectMutation.mutate()}
          disabled={isLoading}
          className="flex-1 rounded-md bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {rejectMutation.isPending ? "…" : "Reject"}
        </button>
      </div>
      {resetVisible ? (
        <button
          type="button"
          data-testid="detail-reset"
          onClick={() => resetMutation.mutate()}
          disabled={isLoading}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-text disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {resetMutation.isPending ? "…" : "Reset to system"}
        </button>
      ) : null}
      {error ? (
        <p
          role="alert"
          data-testid="detail-action-error"
          className="text-xs text-danger"
        >
          İşlem başarısız oldu. Tekrar deneyin.
        </p>
      ) : null}
    </div>
  );
}
