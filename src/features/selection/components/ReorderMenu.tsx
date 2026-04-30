"use client";

// Phase 7 Task 31 — ReorderMenu (button/menu tabanlı, accessible reorder).
//
// Spec Section 2.4 + 3.2 — VERILMIŞ KARAR: Drag-and-drop YOK. Reorder = menu
// item'lar (Sola/Sağa/Başa/Sona). Pure button + custom menu, A11y default.
//
// 4 menü item: "Sola taşı" / "Sağa taşı" / "Başa al" / "Sona al"
//   - İlk item (idx=0): "Sola taşı" + "Başa al" disabled
//   - Son item (idx=N-1): "Sağa taşı" + "Sona al" disabled
//   - Tek item set: 4'ü de disabled
//
// Mutation: POST /api/selection/sets/[setId]/items/reorder
//   body: { itemIds: string[] }   (full set order, ya hep ya hiç — Task 21)
//
// A11y disipline:
//   - aria-haspopup="menu" + aria-expanded toggle
//   - role="menu" + role="menuitem"
//   - Escape: menu kapan + focus trigger'a dön
//   - Outside click: menu kapan
//   - role="status" aria-live="polite" — hareket sonrası ekran okuyucu announce
//
// Filmstrip filter (Aktif/Reddedilenler) yalnız görsel; reorder API full set
// order ister. ReorderMenu bu yüzden filtrelenmemiş `items` array'ini alır
// (Filmstrip parent props ile geçirir).
//
// Phase 6 + Phase 7 Task 28 paterni: state-driven inline menu (Radix
// dropdown-menu yerine, fewer dependencies + a11y kontrolü bizde).

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ChevronsLeft,
  ChevronsRight,
  MoreVertical,
} from "lucide-react";
import { selectionSetQueryKey, type SelectionItemView } from "../queries";

type MoveAction = "left" | "right" | "first" | "last";

export type ReorderMenuProps = {
  setId: string;
  /** Full set, position asc (filtrelenmemiş — reorder API tam dizi ister). */
  items: SelectionItemView[];
  itemId: string;
  isReadOnly: boolean;
};

/** İki haneli pad — live region announce için "Varyant 02" formatı. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function ReorderMenu({
  setId,
  items,
  itemId,
  isReadOnly,
}: ReorderMenuProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");

  const idx = items.findIndex((i) => i.id === itemId);
  const total = items.length;
  const isFirst = idx <= 0;
  const isLast = idx >= total - 1;

  // Outside click → menu kapan.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Escape → menu kapan + focus trigger'a dön.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const reorderMutation = useMutation({
    mutationFn: async (newItemIds: string[]) => {
      const res = await fetch(
        `/api/selection/sets/${setId}/items/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds: newItemIds }),
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
        throw new Error(detail ? detail : `Sıralama güncellenemedi (${res.status})`);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: selectionSetQueryKey(setId) });
    },
  });

  const handleMove = (action: MoveAction) => {
    if (isReadOnly || idx < 0) return;
    setOpen(false);

    const newOrder = items.map((i) => i.id);
    const targetIdx =
      action === "left"
        ? idx - 1
        : action === "right"
          ? idx + 1
          : action === "first"
            ? 0
            : total - 1;

    if (targetIdx === idx || targetIdx < 0 || targetIdx >= total) return;

    // Splice + insert (yeni dizide hedef pozisyona yerleştir).
    const moved = newOrder.splice(idx, 1)[0];
    if (moved === undefined) return;
    newOrder.splice(targetIdx, 0, moved);

    reorderMutation.mutate(newOrder);

    // Screen reader announce — Türkçe.
    const variantNum = pad2(idx + 1);
    const newPos = targetIdx + 1;
    const verbiage =
      action === "left"
        ? "bir öne"
        : action === "right"
          ? "bir arkaya"
          : action === "first"
            ? "başa"
            : "sona";
    setAnnouncement(
      `Varyant ${variantNum} ${verbiage} taşındı. Yeni sıra: ${newPos}.`,
    );

    // Focus return — menu kapandıktan sonra trigger'a dön.
    setTimeout(() => triggerRef.current?.focus(), 0);
  };

  // Read-only set'te reorder UI yok.
  if (isReadOnly) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          // Filmstrip item click bubble'ı engelle — kebap tıklaması preview
          // değişimi tetiklememeli.
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        disabled={reorderMutation.isPending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Sıralama menüsü"
        className="grid h-5 w-5 place-items-center rounded-sm bg-text/40 text-bg opacity-0 transition-opacity hover:bg-text/60 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <MoreVertical className="h-3 w-3" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Sıralama seçenekleri"
          className="absolute right-0 top-6 z-10 min-w-36 rounded-md border border-border bg-surface p-1 shadow-popover"
        >
          <ReorderMenuItem
            label="Sola taşı"
            icon={<ArrowLeft className="h-3 w-3" aria-hidden />}
            disabled={isFirst}
            onClick={() => handleMove("left")}
          />
          <ReorderMenuItem
            label="Sağa taşı"
            icon={<ArrowRight className="h-3 w-3" aria-hidden />}
            disabled={isLast}
            onClick={() => handleMove("right")}
          />
          <ReorderMenuItem
            label="Başa al"
            icon={<ChevronsLeft className="h-3 w-3" aria-hidden />}
            disabled={isFirst}
            onClick={() => handleMove("first")}
          />
          <ReorderMenuItem
            label="Sona al"
            icon={<ChevronsRight className="h-3 w-3" aria-hidden />}
            disabled={isLast}
            onClick={() => handleMove("last")}
          />
        </div>
      ) : null}

      {/* Live region — ekran okuyucu announce. sr-only yerine className visible
          olmaz; aria-live="polite" + role="status" yeterli. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ReorderMenuItem — paylaşılan menüitem button
// ────────────────────────────────────────────────────────────

function ReorderMenuItem({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-text hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <span className="text-text-muted">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
