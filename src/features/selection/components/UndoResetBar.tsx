"use client";

// Phase 7 Task 30 — Selection Studio sağ panel "İşlem geçmişi" bölümü.
//
// Spec Section 3.2 + 4.5:
//   - "Son işlemi geri al" → tek seviye undo. `lastUndoableAssetId` doluysa
//     enabled; null ise UI'a "Geri alınacak işlem yok" tooltip yansır.
//   - "Orijinale döndür" → tüm düzenlemeleri sil, source'a dön. `editedAssetId`
//     doluysa enabled.
//   - History listesi info-only → max 5 entry (en yeni üstte, reverse), op
//     adı (TR mapping) + relative timestamp ("az önce", "5 dk önce", "2 sa
//     önce"), failed entry "— başarısız" + danger dot. TIKLANMAZ; replay /
//     timeline / nokta-seçim YOK (honesty: tek seviye undo modeli, history
//     sadece görünürlük).
//   - 5'ten fazla entry varsa "... +N eski işlem" hint (kullanıcıya kayıp
//     bilgi olduğu net).
//
// Multi-tenant: server route `requireSetOwnership` → cross-user 404. UI bu
// sözleşmeyi varsayar; payload yalnızca aktif kullanıcının view'ı.
//
// Mutation:
//   - POST /api/selection/sets/[setId]/items/[itemId]/undo  (Task 22)
//   - POST /api/selection/sets/[setId]/items/[itemId]/reset (Task 22)
// Başarı sonrası `selectionSetQueryKey(setId)` invalidate → set detay fresh
// fetch (lastUndoableAssetId / editedAssetId / editHistoryJson hep güncel).
//
// Token discipline:
//   - 10px arbitrary text size VIOLATION → text-xs (12px) kullanıldı
//     (token sınırlı font ölçeği; arbitrary tailwind value yok).
//   - danger inline alert → Phase 7 emsali `border-danger bg-danger-soft
//     text-danger` (HeavyActionButton + QuickActions ile aynı pattern).

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Undo2, RotateCcw, AlertTriangle } from "lucide-react";
import {
  selectionSetQueryKey,
  type SelectionItemView,
} from "../queries";

const SECTION_LABEL_CLASS =
  "font-mono text-xs uppercase tracking-meta text-text-muted";

type EditOp =
  | "crop"
  | "transparent-check"
  | "background-remove"
  | "magic-eraser";

type EditHistoryEntry = {
  op: EditOp;
  params?: { ratio?: string };
  at: string;
  result?: { ok?: boolean; summary?: string };
  failed?: boolean;
  reason?: string;
};

// Pass 32 — magic-eraser eklendi. Pre-Pass 32: history listesinde raw
// "magic-eraser" string görünüyordu (yarı-deneysel hissi). Şimdi TR label.
const OP_LABELS: Record<EditOp, string> = {
  crop: "Crop",
  "transparent-check": "Transparent kontrol",
  "background-remove": "Background remove",
  "magic-eraser": "Magic Eraser",
};

/**
 * Relative timestamp (TR).
 *
 * 30 sn altı  → "az önce"
 * 60 sn altı  → "N sn önce"
 * 60 dk altı  → "N dk önce"
 * 24 sa altı  → "N sa önce"
 * üstü        → "N gün önce"
 *
 * Test stratejisi: `vi.useFakeTimers()` + `vi.setSystemTime(...)` ile
 * deterministik (Phase 6 emsal: tests/unit/url-public-check.test.ts).
 */
function formatRelative(at: string): string {
  const diff = Date.now() - new Date(at).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 30) return "az önce";
  if (sec < 60) return `${sec} sn önce`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}

export type UndoResetBarProps = {
  setId: string;
  item: SelectionItemView;
  isReadOnly: boolean;
};

export function UndoResetBar({ setId, item, isReadOnly }: UndoResetBarProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasUndoable = !!item.lastUndoableAssetId;
  const hasEdits = !!item.editedAssetId;

  // History — Json field; defensive array check + max 5 reverse + hidden
  // count. editHistoryJson Prisma `Json` (any) → array değilse boş.
  const historyRaw = Array.isArray(item.editHistoryJson)
    ? (item.editHistoryJson as unknown as EditHistoryEntry[])
    : [];
  const visibleHistory = historyRaw.slice(-5).reverse();
  const hiddenCount = Math.max(0, historyRaw.length - 5);

  const undoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/selection/sets/${setId}/items/${item.id}/undo`,
        { method: "POST" },
      );
      if (!res.ok) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: string };
          detail = typeof body.error === "string" ? body.error : "";
        } catch {
          // ignore parse hatası
        }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: selectionSetQueryKey(setId) });
    },
    onError: (err: Error) => setErrorMessage(err.message),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/selection/sets/${setId}/items/${item.id}/reset`,
        { method: "POST" },
      );
      if (!res.ok) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: string };
          detail = typeof body.error === "string" ? body.error : "";
        } catch {
          // ignore
        }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: selectionSetQueryKey(setId) });
    },
    onError: (err: Error) => setErrorMessage(err.message),
  });

  const isPending = undoMutation.isPending || resetMutation.isPending;
  const undoDisabled = isReadOnly || isPending || !hasUndoable;
  const resetDisabled = isReadOnly || isPending || !hasEdits;

  const undoTitle = hasUndoable
    ? "Son işlemi geri al"
    : "Geri alınacak işlem yok";
  const resetTitle = hasEdits
    ? "Tüm düzenlemeleri sil, orijinale dön"
    : "Düzenleme yok";

  return (
    <div className="flex-1 flex flex-col gap-2 px-4 py-3 overflow-hidden">
      <div className={SECTION_LABEL_CLASS}>İşlem geçmişi</div>

      {/* Action butonları */}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => undoMutation.mutate()}
          disabled={undoDisabled}
          title={undoTitle}
          className="flex h-control-sm items-center gap-1.5 rounded-md border border-border bg-transparent px-2 text-xs text-text transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Undo2 className="h-3 w-3 text-text-muted" aria-hidden />
          Son işlemi geri al
        </button>
        <button
          type="button"
          onClick={() => resetMutation.mutate()}
          disabled={resetDisabled}
          title={resetTitle}
          className="flex h-control-sm items-center gap-1.5 rounded-md border border-border bg-transparent px-2 text-xs text-text transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3 text-text-muted" aria-hidden />
          Orijinale döndür
        </button>
      </div>

      {/* History listesi (info-only — tıklanmaz) */}
      <div className="mt-2 flex flex-col gap-1 overflow-y-auto">
        {historyRaw.length === 0 ? (
          <p className="text-xs text-text-muted">Henüz düzenleme yok</p>
        ) : (
          <>
            {visibleHistory.map((entry, idx) => {
              const label = OP_LABELS[entry.op] ?? entry.op;
              const ratioSuffix = entry.params?.ratio
                ? ` (${entry.params.ratio})`
                : "";
              const failedSuffix = entry.failed ? " — başarısız" : "";
              return (
                <div
                  key={`${entry.at}-${idx}`}
                  className="flex items-center gap-2 text-xs text-text-muted"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      entry.failed ? "bg-danger" : "bg-success"
                    }`}
                    aria-hidden
                  />
                  <span className="flex-1">
                    {label}
                    {ratioSuffix}
                    {failedSuffix}
                  </span>
                  <span className="font-mono text-xs">
                    {formatRelative(entry.at)}
                  </span>
                </div>
              );
            })}
            {hiddenCount > 0 ? (
              <p className="text-xs text-text-muted">
                ... +{hiddenCount} eski işlem
              </p>
            ) : null}
          </>
        )}
      </div>

      {/* Inline error — mutation fail */}
      {errorMessage ? (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-2 flex items-start gap-1.5 rounded-md border border-danger bg-danger-soft px-2 py-1.5 text-xs text-danger"
        >
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>{errorMessage}</span>
        </div>
      ) : null}
    </div>
  );
}
