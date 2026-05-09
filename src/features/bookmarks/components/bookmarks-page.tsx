"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { BookmarkStatus, RiskLevel } from "@prisma/client";
import { Bookmark as BookmarkIcon, Search, Plus } from "lucide-react";
import { BookmarkCard } from "./bookmark-card";
import { ImportUrlDialog } from "./import-url-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { confirmPresets } from "@/components/ui/confirm-presets";
import { useFocusTrap } from "@/components/ui/use-focus-trap";
import { Toolbar } from "@/components/ui/Toolbar";
import { FilterBar } from "@/components/ui/FilterBar";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";

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
  const { confirm, close, run, state } = useConfirm();
  const [status, setStatus] = useState<BookmarkStatus | "ALL">("INBOX");
  const [q, setQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      if (!res.ok) throw new Error((await res.json()).error ?? "Liste alınamadı");
      return res.json();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Arşivleme başarısız");
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
        throw new Error((await res.json()).error ?? "Güncelleme başarısız");
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
      if (!res.ok) throw new Error((await res.json()).error ?? "Referansa taşıma başarısız");
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
       * Sadece CTA + toolbar + grid burada kalır. */}
      <div className="flex justify-end">
        <button
          type="button"
          data-size="sm"
          className="k-btn k-btn--primary"
          onClick={() => setImportOpen(true)}
        >
          <Plus className="h-3 w-3" aria-hidden />
          Add from URL
        </button>
      </div>

      <Toolbar
        leading={
          <div className="w-60">
            <Input
              type="search"
              placeholder="Search by title, source or note"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              prefix={<Search className="h-4 w-4" aria-hidden />}
            />
          </div>
        }
      >
        <FilterBar>
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={f.value}
              active={status === f.value}
              onToggle={() => setStatus(f.value)}
            >
              {f.label}
            </Chip>
          ))}
        </FilterBar>
      </Toolbar>

      <BulkActionBar
        selectedCount={selectedCount}
        label={
          selectedCount > 0 ? `${selectedCount} bookmark seçildi` : undefined
        }
        actions={
          <>
            <Button variant="ghost" size="sm" disabled>
              Referansa ekle
            </Button>
            <Button variant="ghost" size="sm" disabled>
              Koleksiyona
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={bulkArchive}
              disabled={archiveMutation.isPending}
            >
              Arşivle
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
              onClick={() => setImportOpen(true)}
            >
              Add your first bookmark
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((bm) => (
            <BookmarkCard
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
        </div>
      )}

      {importOpen ? (
        <ImportUrlDialog
          onClose={() => {
            setImportOpen(false);
            qc.invalidateQueries({ queryKey: ["bookmarks"] });
          }}
        />
      ) : null}

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
            Referansa taşı
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-sm text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            Kapat
          </button>
        </div>
        <p className="mb-3 text-xs text-text-muted">
          Bookmark {bookmarkId.slice(0, 10)}… için ürün tipi seç:
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
            Vazgeç
          </button>
          <Button
            variant="primary"
            size="sm"
            disabled={isPending || !productTypeId}
            onClick={() => onSubmit(productTypeId)}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {isPending ? "Taşınıyor…" : "Referansa Taşı"}
          </Button>
        </div>
      </div>
    </div>
  );
}

