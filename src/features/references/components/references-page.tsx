"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { BookmarkIcon, Plus, Search, SlidersHorizontal } from "lucide-react";
import { ReferenceCard } from "./reference-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { confirmPresets } from "@/components/ui/confirm-presets";
import { Toolbar } from "@/components/ui/Toolbar";
import { FilterBar } from "@/components/ui/FilterBar";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";

type ReferenceLite = {
  id: string;
  notes: string | null;
  createdAt: string;
  asset: { id: string; storageKey: string; bucket: string } | null;
  productType: { id: string; displayName: string } | null;
  collection: { id: string; name: string } | null;
  bookmark: { id: string; title: string | null; sourceUrl: string | null } | null;
  tags: { tag: { id: string; name: string; color: string | null } }[];
};

type ListResponse = {
  items: ReferenceLite[];
  nextCursor: string | null;
};

type CollectionItem = {
  id: string;
  name: string;
  _count: { references: number };
};

type CollectionsResponse = {
  items: CollectionItem[];
  uncategorizedReferenceCount: number;
  orphanedReferenceCount: number;
};

type ProductTypeOption = { id: string; displayName: string };

type CollectionFilter = null | "uncategorized" | string;

export function ReferencesPage({
  productTypes,
}: {
  productTypes: ProductTypeOption[];
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const { confirm, close, run, state } = useConfirm();
  const [q, setQ] = useState("");
  const [activeCollection, setActiveCollection] = useState<CollectionFilter>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Collections query — chip bar için
  const collectionsQuery = useQuery<CollectionsResponse>({
    queryKey: ["collections", { kind: "REFERENCE" }],
    queryFn: async () => {
      const res = await fetch("/api/collections?kind=REFERENCE", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Koleksiyonlar alınamadı");
      return res.json();
    },
  });

  // References query — aktif koleksiyon + arama filtresine göre
  const query = useQuery<ListResponse>({
    queryKey: ["references", activeCollection, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeCollection) params.set("collectionId", activeCollection);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "60");
      const res = await fetch(`/api/references?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Liste alınamadı");
      return res.json();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/references/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Arşivleme başarısız");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["references"] });
      qc.invalidateQueries({ queryKey: ["collections", { kind: "REFERENCE" }] });
    },
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const visibleIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const selectedCount = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)).length,
    [items, selectedIds],
  );

  // Toplam sayaç: Σ _count.references + uncategorized + orphan
  const totalCount = useMemo(() => {
    if (!collectionsQuery.data) return 0;
    const fromCollections = collectionsQuery.data.items.reduce(
      (acc, c) => acc + c._count.references,
      0,
    );
    return (
      fromCollections +
      collectionsQuery.data.uncategorizedReferenceCount +
      collectionsQuery.data.orphanedReferenceCount
    );
  }, [collectionsQuery.data]);

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
    confirm(confirmPresets.archiveReferencesBulk(targets.length), async () => {
      for (const id of targets) {
        await archiveMutation.mutateAsync(id);
      }
      clearSelection();
    });
  };

  // Liste değiştiğinde görünmeyen id'leri seçimden düşür
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (visibleIds.has(id)) next.add(id);
      return next;
    });
  }, [visibleIds]);

  const collectionChips = collectionsQuery.data?.items ?? [];
  const uncategorizedCount = collectionsQuery.data?.uncategorizedReferenceCount ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Referans Havuzu</h1>
          <p className="text-xs text-text-muted">
            {items.length > 0
              ? `${items.length} referans · Seçilmiş kaynak havuzu`
              : "Seçilmiş referanslar — üretime hazır kaynak havuzu"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* R11.14.1 — k-btn recipe (Kivasy v4 gradient parity) — eski
              Button component'i flat solid orange üretiyordu; references
              top-level CTA için design-system canon. */}
          <button
            type="button"
            data-size="sm"
            className="k-btn k-btn--primary"
            onClick={() => router.push("/collections?intent=create")}
          >
            <Plus className="h-3 w-3" aria-hidden />
            Yeni koleksiyon
          </button>
        </div>
      </div>

      <Toolbar
        leading={
          <div className="w-60">
            <Input
              type="search"
              placeholder="Başlık, tag veya koleksiyonda ara"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              prefix={<Search className="h-4 w-4" aria-hidden />}
            />
          </div>
        }
        trailing={
          <Button
            variant="ghost"
            size="sm"
            icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
            disabled
          >
            Filtre
          </Button>
        }
      >
        <FilterBar>
          <Chip
            active={activeCollection === null}
            onToggle={() => setActiveCollection(null)}
          >
            {`Tümü · ${totalCount}`}
          </Chip>

          {/* Koleksiyon chip'leri */}
          {collectionChips.map((c) => (
            <Chip
              key={c.id}
              active={activeCollection === c.id}
              onToggle={() => setActiveCollection(c.id)}
            >
              {`${c.name} · ${c._count.references}`}
            </Chip>
          ))}

          {/* Koleksiyonsuz chip */}
          {uncategorizedCount > 0 ? (
            <Chip
              active={activeCollection === "uncategorized"}
              onToggle={() => setActiveCollection("uncategorized")}
            >
              {`Koleksiyonsuz · ${uncategorizedCount}`}
            </Chip>
          ) : null}
        </FilterBar>
      </Toolbar>

      <BulkActionBar
        selectedCount={selectedCount}
        label={selectedCount > 0 ? `${selectedCount} referans seçildi` : undefined}
        actions={
          <>
            <Button variant="ghost" size="sm" disabled>
              Üret
            </Button>
            <Button variant="ghost" size="sm" disabled>
              Koleksiyona taşı
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
        <SkeletonCardGrid count={8} />
      ) : query.error ? (
        <StateMessage
          tone="error"
          title="Liste yüklenemedi"
          body={(query.error as Error).message}
        />
      ) : items.length === 0 ? (
        <StateMessage
          tone="neutral"
          icon={<BookmarkIcon className="h-5 w-5" aria-hidden />}
          title="Henüz referans yok"
          body="Bookmark sayfasından 'Referansa Taşı' ile ekleyebilir ya da doğrudan görsel yükleyerek havuza bir referans alabilirsin."
          action={
            <Button variant="primary" disabled>
              Referans ekle
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((ref) => (
            <ReferenceCard
              key={ref.id}
              reference={ref}
              selected={selectedIds.has(ref.id)}
              onToggleSelect={toggleSelect}
              onArchive={(id) => {
                const item = query.data?.items.find((r) => r.id === id);
                confirm(
                  confirmPresets.archiveReference(
                    item?.bookmark?.title ?? item?.bookmark?.sourceUrl,
                  ),
                  async () => {
                    await archiveMutation.mutateAsync(id);
                  },
                );
              }}
            />
          ))}
        </div>
      )}

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
    </div>
  );
}
