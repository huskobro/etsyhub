"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { BookmarkStatus, RiskLevel } from "@prisma/client";
import { Bookmark as BookmarkIcon, Search, Plus } from "lucide-react";
import { BookmarkRow } from "./bookmark-row";
import { ImportUrlDialog } from "./import-url-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { confirmPresets } from "@/components/ui/confirm-presets";
import { useFocusTrap } from "@/components/ui/use-focus-trap";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { Button } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

type BookmarkLite = {
  id: string;
  title: string | null;
  sourceUrl: string | null;
  sourcePlatform: string | null;
  status: BookmarkStatus;
  riskLevel: RiskLevel;
  createdAt: string;
  asset: { id: string; storageKey: string; bucket: string } | null;
  productType: { id: string; displayName: string } | null;
  collection: { id: string; name: string } | null;
  tags: { tag: { id: string; name: string; color: string | null } }[];
};

type ListResponse = {
  items: BookmarkLite[];
  nextCursor: string | null;
};

const STATUS_FILTERS: { value: BookmarkStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "INBOX", label: "Inbox" },
  { value: "REFERENCED", label: "Reference" },
  { value: "RISKY", label: "Risky" },
  { value: "ARCHIVED", label: "Archive" },
];

type ProductTypeOption = { id: string; displayName: string };

export function BookmarksPage({
  productTypes,
}: {
  productTypes: ProductTypeOption[];
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { confirm, close, run, state } = useConfirm();
  const [status, setStatus] = useState<BookmarkStatus | "ALL">("INBOX");
  const [q, setQ] = useState("");
  const [importOpenLocal, setImportOpenLocal] = useState(false);
  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* Phase 22 — Pool-canonical action slot pattern (page.tsx tarafı).
   * Topbar CTA stateless Link → /bookmarks?add=url query'si bırakır.
   *
   * Modal "open" durumu URL-derived: `?add=url` görünür olduğu
   * sürece modal açık sayılır. Bu pattern Next.js App Router'da
   * en stabil çözüm — `setState + router.replace` çakışması
   * (re-render sırasında state'in yutulması) burada olmuyor çünkü
   * URL'in kendisi truth. Modal close → `router.replace(pathname)`
   * ile param'ı çıkarıyoruz; aynı zamanda manuel "+ New" buton
   * (`setImportOpenLocal(true)`) için local state var (örn. empty
   * state CTA, future entries). İki kaynak `OR`'lanır. */
  const importOpen =
    importOpenLocal || searchParams?.get("add") === "url";

  const closeImport = () => {
    setImportOpenLocal(false);
    if (searchParams?.get("add") === "url") {
      const next = new URLSearchParams(searchParams);
      next.delete("add");
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    }
    qc.invalidateQueries({ queryKey: ["bookmarks"] });
  };

  const query = useQuery<ListResponse>({
    queryKey: ["bookmarks", status, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status !== "ALL") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "60");
      const res = await fetch(`/api/bookmarks?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load list");
      return res.json();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Archive failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async (args: {
      id: string;
      input: { collectionId?: string | null; tagIds?: string[] };
    }) => {
      const res = await fetch(`/api/bookmarks/${args.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args.input),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Update failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const promoteMutation = useMutation({
    mutationFn: async (args: { bookmarkId: string; productTypeId: string }) => {
      const res = await fetch("/api/references/promote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Move to reference failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["references"] });
      setPromoteId(null);
    },
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const visibleIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const selectedCount = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)).length,
    [items, selectedIds],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkArchive = () => {
    const targets = items.filter((i) => selectedIds.has(i.id)).map((i) => i.id);
    if (targets.length === 0) return;
    confirm(confirmPresets.archiveBookmarksBulk(targets.length), async () => {
      for (const id of targets) {
        await archiveMutation.mutateAsync(id);
      }
      clearSelection();
    });
  };

  // Liste değiştiğinde görünmeyen id'leri seçimden düşür (stale seçim olmasın).
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (visibleIds.has(id)) next.add(id);
      return next;
    });
  }, [visibleIds]);

  return (
    <div className="flex flex-col gap-6">
      {/* R11.14.3 — Çift header kaldırıldı; üst topbar References shell
       * tarafından tek h1 + sub-view subtitle olarak render ediliyor.
       *
       * Phase 22 — Pool-canonical action slot pattern uygulandı.
       * Pre-Phase 22 "Add from URL" inline `<div justify-end>` satırı
       * burada yaşıyordu; wrapper `gap-6` ile toolbar'a 70px boş satır
       * üretiyordu. CTA artık references shell topbar action slot'unda
       * (bkz. app/(app)/bookmarks/page.tsx) — Link href="?add=url"
       * yukarıdaki `importOpen` URL-derived state'ini açar. */}

      {/* Phase 20 — B1 family parity toolbar.
       *   v5 SubInbox: k-input (left, prefix search icon) + inline segmented
       *   k-chip filter group. Pre-Phase 20 legacy Toolbar/FilterBar/Input/
       *   Chip primitive karışımı kullanıyordu — Pool/Products ile aile
       *   hissini bozuyordu. Aynı görsel sözleşme (h-9, font-mono uppercase
       *   chip text) artık References Pool ve /products toolbar ile birebir. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bg px-6 py-3">
        <div className="relative max-w-[420px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search bookmarks by title, source or note…"
            className="k-input !pl-9"
            data-testid="bookmarks-search"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              aria-pressed={status === f.value}
              className={cn("k-chip", status === f.value && "k-chip--active")}
              data-testid={`bookmarks-filter-${f.value.toLowerCase()}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedCount}
        label={
          selectedCount > 0 ? `${selectedCount} bookmark(s) selected` : undefined
        }
        actions={
          <>
            <Button variant="ghost" size="sm" disabled>
              Promote to Reference
            </Button>
            <Button variant="ghost" size="sm" disabled>
              Add to collection
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={bulkArchive}
              disabled={archiveMutation.isPending}
            >
              Archive
            </Button>
          </>
        }
        onDismiss={clearSelection}
      />

      {query.isLoading ? (
        <SkeletonCardGrid count={6} />
      ) : query.error ? (
        <StateMessage
          tone="error"
          title="Couldn't load list"
          body={(query.error as Error).message}
        />
      ) : items.length === 0 ? (
        <StateMessage
          tone="neutral"
          icon={<BookmarkIcon className="h-5 w-5" aria-hidden />}
          title="No bookmarks yet"
          body="Paste any URL from Etsy, Pinterest, Amazon or elsewhere to start collecting ideas. You can promote bookmarks to references later."
          action={
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" aria-hidden />}
              onClick={() => setImportOpenLocal(true)}
            >
              Add your first bookmark
            </Button>
          }
        />
      ) : (
        /* Phase 21 — B1 Inbox canonical layout (screens-b1.jsx:218-260).
         *   Inbox **table**, grid değil. k-card wrapper içinde 7 column:
         *   checkbox / thumb / Title (+meta inline) / Source / Status /
         *   Added / row-action (Promote + Archive).
         *   Bookmark-specific metadata (tags, collection, productType,
         *   status) row içinde korunur — Pool kart yüzeyinden farkı
         *   "intake-yoğun" işlevi sağlar; B1 spec'inden Status sütunu
         *   eklendi (bookmark workflow gereği; B1 demo'da status uniform
         *   "Inbox" varsayıyordu). */
        <div className="k-card overflow-hidden" data-testid="bookmarks-table">
          <table className="w-full">
            <thead className="border-b border-line bg-k-bg-2/40">
              <tr>
                <th className="w-9 px-3 py-2.5"></th>
                <th className="w-16 px-3 py-2.5"></th>
                <th className="px-3 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-meta text-ink-3">
                  Title
                </th>
                <th className="w-28 px-3 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-meta text-ink-3">
                  Source
                </th>
                <th className="w-24 px-3 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-meta text-ink-3">
                  Status
                </th>
                <th className="w-24 px-3 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-meta text-ink-3">
                  Added
                </th>
                <th className="w-64 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((bm) => (
                <BookmarkRow
                  key={bm.id}
                  bookmark={bm}
                  selected={selectedIds.has(bm.id)}
                  onToggleSelect={toggleSelect}
                  onArchive={(id) =>
                    confirm(
                      confirmPresets.archiveBookmark(
                        items.find((b) => b.id === id)?.title,
                      ),
                      async () => {
                        await archiveMutation.mutateAsync(id);
                      },
                    )
                  }
                  onPromote={(id) => setPromoteId(id)}
                  onSetCollection={(id, collectionId) =>
                    updateMutation.mutate({ id, input: { collectionId } })
                  }
                  onSetTags={(id, tagIds) =>
                    updateMutation.mutate({ id, input: { tagIds } })
                  }
                  updating={updateMutation.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {importOpen ? <ImportUrlDialog onClose={closeImport} /> : null}

      {state.preset ? (
        <ConfirmDialog
          open={state.open}
          onOpenChange={(o) => {
            if (!o) close();
          }}
          {...state.preset}
          onConfirm={run}
          busy={state.busy}
          errorMessage={state.errorMessage}
        />
      ) : null}

      {promoteId ? (
        <PromoteDialog
          bookmarkId={promoteId}
          productTypes={productTypes}
          isPending={promoteMutation.isPending}
          error={
            promoteMutation.isError
              ? (promoteMutation.error as Error).message
              : null
          }
          onSubmit={(productTypeId) =>
            promoteMutation.mutate({ bookmarkId: promoteId, productTypeId })
          }
          onClose={() => setPromoteId(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * PromoteDialog — bookmark'i referansa taşırken productType seçtiren disclosure.
 *
 * T-39 hizalaması (CP-9 stabilization wave): AddCompetitorDialog +
 * PromoteToReferenceDialog ile aynı manuel disclosure pattern'ine taşındı.
 *
 * a11y davranışları:
 * - role="dialog" + aria-modal="true" + aria-labelledby="promote-dialog-title"
 * - useFocusTrap → Tab boundary + initial focus (productType select)
 * - Escape → onClose (isPending iken iptal edilmez; mutation in-flight koruması)
 * - Backdrop click → onClose (target === currentTarget guard + isPending guard)
 * - Header "Kapat" + footer "Vazgeç" iki ayrı kapatma yolu
 *
 * NOT: ConfirmDialog primitive KULLANILMADI. Bu akış confirmation değil,
 * productType picker içeren bir disclosure. Karar gerekçeleri için
 * docs/design/implementation-notes/cp9-stabilization-wave.md (T-39) bölümü.
 */
function PromoteDialog({
  bookmarkId,
  productTypes,
  isPending,
  error,
  onSubmit,
  onClose,
}: {
  bookmarkId: string;
  productTypes: ProductTypeOption[];
  isPending: boolean;
  error: string | null;
  onSubmit: (productTypeId: string) => void;
  onClose: () => void;
}) {
  const firstId = productTypes[0]?.id ?? "";
  const [productTypeId, setProductTypeId] = useState(firstId);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const initialFocusRef = useRef<HTMLSelectElement | null>(null);

  // T-39 a11y: Tab boundary + initial focus tek hook ile yönetilir.
  // Initial focus productType select'e — productTypes boşsa bile select
  // render edilir (boş seçenekle) ve kullanıcı en azından dialog içine girer.
  useFocusTrap(dialogRef, true, initialFocusRef);

  // T-39 a11y: Escape → onClose. isPending iken iptal edilmez (mutation
  // in-flight; ConfirmDialog'un busy guard paterni).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isPending) return;
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPending, onClose]);

  // T-39 a11y: Backdrop tıklamasında onClose. Dialog içi tıklama event
  // bubbling ile buraya gelse de target !== currentTarget olduğu için
  // tetiklenmez. isPending iken iptal edilmez.
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (isPending) return;
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promote-dialog-title"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-popover">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="promote-dialog-title"
            className="text-lg font-semibold text-text"
          >
            Move to reference
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-sm text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            Close
          </button>
        </div>
        <p className="mb-3 text-xs text-text-muted">
          Pick a product type for bookmark {bookmarkId.slice(0, 10)}…:
        </p>
        <select
          ref={initialFocusRef}
          value={productTypeId}
          onChange={(e) => setProductTypeId(e.target.value)}
          disabled={isPending}
          className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          {productTypes.map((pt) => (
            <option key={pt.id} value={pt.id}>
              {pt.displayName}
            </option>
          ))}
        </select>
        {error ? (
          <p className="mt-3 text-xs text-danger">{error}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-border px-3 py-2 text-sm text-text hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <Button
            variant="primary"
            size="sm"
            disabled={isPending || !productTypeId}
            onClick={() => onSubmit(productTypeId)}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {isPending ? "Moving…" : "Move to reference"}
          </Button>
        </div>
      </div>
    </div>
  );
}

