"use client";

// Phase 7 Task 37 — ArchiveAction (set kebap menü minimal).
//
// Spec Section 1.2 + 4.3 — Archive in-scope minimal: kebap menüde tek item
// "Set'i arşivle". Click → confirmation modal → POST /api/selection/sets/
// :setId/archive → /selection redirect (archived browsing UX Phase 7'de
// out-of-scope; Section 1.3).
//
// Sözleşme:
//   - Trigger: kebap (MoreVertical) icon button, aria-haspopup="menu",
//     aria-expanded toggle, aria-label="Set seçenekleri".
//   - Menu açılınca tek role="menuitem": "Set'i arşivle".
//   - State machine (Section 4.3): draft → archived ve ready → archived
//     desteklenir; archived → archived REJECT (assertCanArchive Task 4).
//     UI bu yüzden archived set'te action'ı tamamen gizler — null render.
//   - Confirmation: ConfirmDialog primitive reuse (warning tone) —
//     "Geri alınamaz (Phase 7)" + "Set verisi silinmez" mesajı.
//   - Mutation: POST /api/selection/sets/:setId/archive (body boş, schema
//     .strict()). 4xx/5xx → errorMessage modal içinde (role="alert").
//   - Success: invalidate selection set detail key + router.push("/selection").
//     Archived browsing UX Phase 7'de yok (Section 1.3); kullanıcı index'e
//     döner.
//
// Pattern: ReorderMenu (Task 31) state-driven inline menu emsali.
// Outside click + Escape close. ConfirmDialog reuse Phase 6 disiplini.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Archive, MoreVertical } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { selectionSetQueryKey } from "../queries";

export type ArchiveActionProps = {
  setId: string;
  setStatus: "draft" | "ready" | "archived";
};

export function ArchiveAction({ setId, setStatus }: ArchiveActionProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Outside click → menu kapan.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Escape → menu kapan + focus trigger'a dön.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen]);

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/selection/sets/${setId}/archive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
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
        throw new Error(detail ? detail : `HTTP ${res.status}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: selectionSetQueryKey(setId) });
      setConfirmOpen(false);
      setErrorMessage(null);
      router.push("/selections");
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
    },
  });

  // Archived set'te kebap menü gösterilmez — state machine gereği archived
  // → archived geçişi yok. Eylem yoksa UI elemanını da göstermiyoruz.
  if (setStatus === "archived") return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Set seçenekleri"
        className="grid h-control-md w-control-md place-items-center rounded-md border border-border bg-surface text-text-muted transition-colors duration-fast ease-out hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>

      {menuOpen ? (
        <div
          role="menu"
          aria-label="Set seçenekleri menüsü"
          className="absolute right-0 top-10 z-10 min-w-44 rounded-md border border-border bg-surface p-1 shadow-popover"
        >
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setErrorMessage(null);
              setConfirmOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Archive className="h-3.5 w-3.5 text-text-muted" aria-hidden />
            <span>Set&apos;i arşivle</span>
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !archiveMutation.isPending) {
            setConfirmOpen(false);
            setErrorMessage(null);
          }
        }}
        title="Set'i arşivle"
        description={
          <>
            Bu set arşivlenecek.{" "}
            <strong className="text-text">Cannot be undone</strong>
            Arşivlenmiş set&apos;ler /selection ana sayfasında görünmez. Set
            verisi silinmez — ileride archive yönetimi eklendiğinde
            erişilebilir olur.
          </>
        }
        confirmLabel="Arşivle"
        cancelLabel="İptal"
        tone="warning"
        onConfirm={() => {
          // mutate() kullanıyoruz (mutateAsync yerine) — error handling
          // mutation `onError` callback'inde state olarak yönetiliyor; bu
          // sayede unhandled promise rejection oluşmaz.
          archiveMutation.mutate();
        }}
        busy={archiveMutation.isPending}
        errorMessage={errorMessage}
      />
    </div>
  );
}
