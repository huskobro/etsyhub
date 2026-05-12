"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { ChevronDown, Eye, Search, Sparkles, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { confirmPresets } from "@/components/ui/confirm-presets";
import { AssetImage } from "@/components/ui/asset-image";
import { cn } from "@/lib/cn";

/**
 * ReferencesPage — Kivasy v5 B1.SubPool implementation (R11.14.4).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b1.jsx → SubPool
 *
 * Bu component v5 SubPool DOM'unu birebir uygular:
 *   - Toolbar: search input (.k-input) + 4 caret chip (.k-chip)
 *     [Source / Type / Collection / Date added] + count caption mono
 *   - Grid: 4 cols comfortable / 6 cols dense
 *   - Card recipe (.k-card overflow-hidden group):
 *       · square thumb (.k-thumb data-aspect="square") wrapped in p-2 pb-0
 *       · top-left: .k-checkbox (always visible, ring-selected on active)
 *       · top-right hover: .k-iconbtn (eye = open detail)
 *       · bottom-2 hover overlay: .k-btn--primary full-width
 *         "Create Variations" with Sparkles icon
 *       · meta block (.p-3.5 default / .p-2.5 dense):
 *         title 13px font-medium truncate + Source badge + Type · time mono
 *
 * R11.14.4 ile Önceki Implementasyondan Farklar:
 *   - Eski legacy `Toolbar / FilterBar / Chip / Input / BulkActionBar /
 *     StateMessage / SkeletonCardGrid / ReferenceCard / Button` component
 *     kullanımları **tamamen** kaldırıldı.
 *   - Tüm UI v5 HTML target'ı k-recipe (k-card, k-thumb, k-iconbtn, k-chip,
 *     k-input, k-btn--primary, k-checkbox, k-segment, k-fab) ile yazıldı.
 *   - Çift header kalktı; topbar shell tarafından sağlanıyor.
 *   - Add Reference CTA topbar'a delegate edildi (page.tsx'te render edilir).
 *
 * Boundary: References = production input pool. Card hover CTA "Create
 * Variations" tek primary aksiyondur (Reference → Batch hand-off, tek yön).
 */

type ReferenceLite = {
  id: string;
  notes: string | null;
  createdAt: string;
  asset: { id: string; storageKey: string; bucket: string } | null;
  productType: { id: string; displayName: string } | null;
  collection: { id: string; name: string } | null;
  bookmark: {
    id: string;
    title: string | null;
    sourceUrl: string | null;
    sourcePlatform?: string | null;
  } | null;
  tags: { tag: { id: string; name: string; color: string | null } }[];
  /** Batch-first Phase 1 — production history counts. */
  _count?: { generatedDesigns: number; midjourneyJobs: number } | null;
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

type Density = "comfortable" | "dense";

export function ReferencesPage({
  productTypes: _productTypes,
}: {
  productTypes: ProductTypeOption[];
}) {
  const qc = useQueryClient();
  const { confirm, close, run, state } = useConfirm();

  const [q, setQ] = useState("");
  const [activeCollection, setActiveCollection] = useState<
    null | "uncategorized" | string
  >(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<Density>("comfortable");
  const [openFilter, setOpenFilter] = useState<
    null | "source" | "type" | "collection" | "date"
  >(null);

  // Filter state — UI placeholders (Source/Type/Date added are caret chips
  // that toggle a popover; backend filter happens via collectionId + q only).
  // Source/Type/Date filters are local-only client filters for this rollout.
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  // Collections query — chip bar için
  const collectionsQuery = useQuery<CollectionsResponse>({
    queryKey: ["collections", { kind: "REFERENCE" }],
    queryFn: async () => {
      const res = await fetch("/api/collections?kind=REFERENCE", {
        cache: "no-store",
      });
      if (!res.ok)
        throw new Error(
          (await res.json()).error ?? "Couldn't load collections",
        );
      return res.json();
    },
  });

  // References query — backend supports q + collectionId
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
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Couldn't load list");
      return res.json();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/references/${id}`, { method: "DELETE" });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Archive failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["references"] });
      qc.invalidateQueries({ queryKey: ["collections", { kind: "REFERENCE" }] });
    },
  });

  const allItems = useMemo(() => query.data?.items ?? [], [query.data]);

  // Client-side filter passes (Source / Type / Date added — UI candy)
  const items = useMemo(() => {
    let out = allItems;
    if (sourceFilter) {
      out = out.filter(
        (i) => (i.bookmark?.sourcePlatform ?? "UPLOAD") === sourceFilter,
      );
    }
    if (typeFilter) {
      out = out.filter((i) => i.productType?.displayName === typeFilter);
    }
    if (dateFilter) {
      const now = Date.now();
      const cutoff =
        dateFilter === "24h"
          ? now - 24 * 60 * 60 * 1000
          : dateFilter === "7d"
            ? now - 7 * 24 * 60 * 60 * 1000
            : dateFilter === "30d"
              ? now - 30 * 24 * 60 * 60 * 1000
              : 0;
      if (cutoff) out = out.filter((i) => +new Date(i.createdAt) >= cutoff);
    }
    return out;
  }, [allItems, sourceFilter, typeFilter, dateFilter]);

  const visibleIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const selectedCount = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)).length,
    [items, selectedIds],
  );

  // Σ _count.references + uncategorized + orphan (toplam pool sayısı)
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

  // ESC kapat (filter popovers)
  useEffect(() => {
    if (!openFilter) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenFilter(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openFilter]);

  const collectionChips = collectionsQuery.data?.items ?? [];
  const uncategorizedCount =
    collectionsQuery.data?.uncategorizedReferenceCount ?? 0;

  // Available source platforms (from data)
  const sourcePlatforms = useMemo(() => {
    const set = new Set<string>();
    for (const i of allItems) {
      set.add(i.bookmark?.sourcePlatform ?? "UPLOAD");
    }
    return Array.from(set);
  }, [allItems]);

  const productTypes = useMemo(() => {
    const set = new Set<string>();
    for (const i of allItems) {
      if (i.productType?.displayName) set.add(i.productType.displayName);
    }
    return Array.from(set);
  }, [allItems]);

  return (
    <div className="flex flex-col">
      {/* Toolbar: search + 4 caret chips + count caption.
       *   v5 SubPool toolbar (screens-b1.jsx lines 108-120) parity. */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-line bg-bg px-6 py-3">
        <div className="relative max-w-[420px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search references by title, source, type…"
            className="k-input !pl-9"
            data-testid="references-search"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <FilterChip
            label="Source"
            value={sourceFilter}
            options={sourcePlatforms}
            onSelect={(v) => {
              setSourceFilter(v);
              setOpenFilter(null);
            }}
            isOpen={openFilter === "source"}
            onToggle={() =>
              setOpenFilter(openFilter === "source" ? null : "source")
            }
          />
          <FilterChip
            label="Type"
            value={typeFilter}
            options={productTypes}
            onSelect={(v) => {
              setTypeFilter(v);
              setOpenFilter(null);
            }}
            isOpen={openFilter === "type"}
            onToggle={() => setOpenFilter(openFilter === "type" ? null : "type")}
          />
          <FilterChip
            label="Collection"
            value={
              activeCollection === "uncategorized"
                ? "Uncategorized"
                : collectionChips.find((c) => c.id === activeCollection)?.name ??
                  null
            }
            options={[
              ...collectionChips.map((c) => `${c.name}|${c.id}`),
              ...(uncategorizedCount > 0
                ? [`Uncategorized|uncategorized`]
                : []),
            ]}
            optionLabel={(o) => o.split("|")[0] ?? o}
            onSelect={(v) => {
              if (v === null) setActiveCollection(null);
              else {
                const id = v.split("|")[1] ?? null;
                setActiveCollection(id);
              }
              setOpenFilter(null);
            }}
            isOpen={openFilter === "collection"}
            onToggle={() =>
              setOpenFilter(openFilter === "collection" ? null : "collection")
            }
          />
          <FilterChip
            label="Date added"
            value={
              dateFilter === "24h"
                ? "Last 24h"
                : dateFilter === "7d"
                  ? "Last 7 days"
                  : dateFilter === "30d"
                    ? "Last 30 days"
                    : null
            }
            options={["24h", "7d", "30d"]}
            optionLabel={(o) =>
              o === "24h"
                ? "Last 24h"
                : o === "7d"
                  ? "Last 7 days"
                  : "Last 30 days"
            }
            onSelect={(v) => {
              setDateFilter(v);
              setOpenFilter(null);
            }}
            isOpen={openFilter === "date"}
            onToggle={() => setOpenFilter(openFilter === "date" ? null : "date")}
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            {items.length} of {totalCount}
          </span>
          <DensityToggle value={density} onChange={setDensity} />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {query.isLoading ? (
          <SkeletonGrid density={density} />
        ) : query.error ? (
          <EmptyState
            tone="error"
            title="Couldn't load list"
            body={(query.error as Error).message}
          />
        ) : items.length === 0 ? (
          <EmptyState
            tone="neutral"
            title="No references yet"
            body="Promote bookmarks from the Inbox sub-view, or upload directly to seed the pool."
            action={
              <Link href="/bookmarks" className="k-btn k-btn--primary" data-size="sm">
                Open Inbox
              </Link>
            }
          />
        ) : (
          <div
            className={cn(
              "grid gap-4",
              density === "dense"
                ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-6"
                : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
            )}
          >
            {items.map((ref) => (
              <ReferencePoolCard
                key={ref.id}
                reference={ref}
                density={density}
                selected={selectedIds.has(ref.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating bulk bar — k-fab recipe.
       *   v5 B1 spec: Create Variations primary + Add to Collection +
       *   Archive + Delete. Burada subset: Create Variations primary
       *   (tek-asset bulk path: ilk seçili asset'in /variations sayfasına
       *   yönlendir), Archive (mevcut), Delete deferred.
       *   R11.14.9 — k-fab recipe inline style yerine pure className.
       *   Kullanıcı feedback: "bulk bar HTML target'tan farklı hissediyor"
       *   → primary CTA + Sparkles icon eklendi, layout v4 source'a
       *   tamamen uydu. */}
      {selectedCount >= 1 ? (
        <div className="k-fab" data-testid="references-bulk-bar">
          <span className="k-fab__count">{selectedCount} selected</span>
          {selectedCount === 1 ? (
            (() => {
              const id = items.find((i) => selectedIds.has(i.id))?.id;
              return id ? (
                <Link
                  href={`/references/${id}/variations`}
                  className="k-fab__btn k-fab__btn--primary"
                  data-testid="references-bulk-create-variations"
                >
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Create Variations
                </Link>
              ) : null;
            })()
          ) : null}
          <button
            type="button"
            className="k-fab__btn"
            onClick={bulkArchive}
            disabled={archiveMutation.isPending}
          >
            Archive
          </button>
          <button
            type="button"
            className="k-fab__close"
            onClick={clearSelection}
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
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
    </div>
  );
}

// ─── FilterChip (caret + popover) ───────────────────────────────────────
function FilterChip({
  label,
  value,
  options,
  optionLabel,
  onSelect,
  isOpen,
  onToggle,
}: {
  label: string;
  value: string | null;
  options: string[];
  optionLabel?: (o: string) => string;
  onSelect: (v: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const display = value ?? label;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={cn("k-chip", value ? "k-chip--active" : "")}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span>{display}</span>
        <ChevronDown
          className={cn(
            "k-chip__caret h-3 w-3 transition-transform",
            isOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {isOpen ? (
        <div
          role="listbox"
          className="absolute left-0 top-9 z-30 min-w-[180px] rounded-md border border-line bg-paper p-1 shadow-popover"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-ink-3">No options</div>
          ) : null}
          {options.map((o) => {
            const labelText = optionLabel ? optionLabel(o) : o;
            const isActive = value === labelText || value === o;
            return (
              <button
                key={o}
                role="option"
                aria-selected={isActive}
                onClick={() => onSelect(o)}
                className={cn(
                  "block w-full rounded-sm px-2.5 py-1.5 text-left text-xs",
                  isActive
                    ? "bg-k-orange-soft text-k-orange-ink"
                    : "text-ink-2 hover:bg-ink/5",
                )}
              >
                {labelText}
              </button>
            );
          })}
          {value !== null ? (
            <>
              <div className="my-1 h-px bg-line" />
              <button
                onClick={() => onSelect(null)}
                className="block w-full rounded-sm px-2.5 py-1.5 text-left text-xs text-ink-3 hover:bg-ink/5"
              >
                Clear filter
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ─── DensityToggle (k-segment recipe) ───────────────────────────────────
function DensityToggle({
  value,
  onChange,
}: {
  value: Density;
  onChange: (next: Density) => void;
}) {
  return (
    <div className="k-segment" role="group" aria-label="Density">
      <button
        type="button"
        aria-pressed={value === "comfortable"}
        onClick={() => onChange("comfortable")}
      >
        Comfortable
      </button>
      <button
        type="button"
        aria-pressed={value === "dense"}
        onClick={() => onChange("dense")}
      >
        Dense
      </button>
    </div>
  );
}

// ─── ReferencePoolCard (v5 B1.SubPool card recipe) ─────────────────────
function ReferencePoolCard({
  reference,
  density,
  selected,
  onToggleSelect,
}: {
  reference: ReferenceLite;
  density: Density;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const title =
    reference.bookmark?.title ?? reference.bookmark?.sourceUrl ?? "Reference";
  const createdLabel = formatRelative(reference.createdAt);
  const sourcePlatform = reference.bookmark?.sourcePlatform ?? "UPLOAD";
  const sourceLabel =
    sourcePlatform === "ETSY"
      ? "Etsy"
      : sourcePlatform === "PINTEREST"
        ? "Pinterest"
        : sourcePlatform === "INSTAGRAM"
          ? "Instagram"
          : sourcePlatform === "URL"
            ? "URL"
            : "Upload";
  const sourceTone =
    sourcePlatform === "ETSY"
      ? "warning"
      : sourcePlatform === "PINTEREST"
        ? "danger"
        : sourcePlatform === "UPLOAD"
          ? "info"
          : "neutral";
  const productLabel = reference.productType?.displayName ?? null;

  return (
    <div
      className={cn("k-card overflow-hidden group", selected && "k-ring-selected")}
      data-interactive="true"
      data-testid="reference-card"
    >
      <div className="relative">
        <div className="p-2 pb-0">
          <div className="k-thumb" data-aspect="square">
            {reference.asset ? (
              <AssetImage
                assetId={reference.asset.id}
                alt={title}
                frame={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-ink-3">
                No image
              </div>
            )}
          </div>
        </div>

        {/* Top-left: checkbox (always visible) */}
        <div className="absolute left-3 top-3 z-10">
          <button
            type="button"
            aria-label="Select"
            aria-pressed={selected}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(reference.id);
            }}
            className="k-checkbox"
            data-checked={selected || undefined}
          >
            {selected ? (
              <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M5 12l5 5L20 7"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </button>
        </div>

        {/* Top-right hover: eye iconbtn (open detail / preview) */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="k-iconbtn"
            data-size="sm"
            title="Preview source"
            aria-label="Preview source"
            onClick={(e) => {
              e.stopPropagation();
              if (reference.bookmark?.sourceUrl) {
                window.open(reference.bookmark.sourceUrl, "_blank");
              }
            }}
          >
            <Eye className="h-3 w-3" aria-hidden />
          </button>
        </div>

        {/* Hover bottom: full-width primary CTA (Reference → Batch hand-off) */}
        <div className="absolute bottom-2 left-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Link
            href={`/references/${reference.id}/variations`}
            data-size="sm"
            className="k-btn k-btn--primary w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            Create Variations
          </Link>
        </div>
      </div>

      {/* Meta block — title 13px font-medium + Source badge + Type · time mono.
       *   v5 SubPool spec: kart altında ek aksiyon yok; archive bulk-bar
       *   üzerinden veya context menu ile gelir. R11.14.5 — Archive butonu
       *   meta hierarchy'i bozmasın diye kaldırıldı; tek-asset archive
       *   kart üzerine sağ-tık (`oncontextmenu`) veya checkbox + bulk-bar
       *   path'ini izlemeli. Şu anlık sadece bulk path mevcut.
       *   onArchive prop'u korundu çünkü `archiveMutation.mutate` ileride
       *   hover-only "more" iconbtn'a bağlanacak. */}
      <div className={density === "dense" ? "p-2.5" : "p-3.5"}>
        <div className="truncate text-[13px] font-medium leading-tight text-ink">
          {title}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="k-badge" data-tone={sourceTone}>
            {sourceLabel}
          </span>
          <span className="font-mono text-[10.5px] tracking-wider text-ink-3">
            {productLabel ? `${productLabel} · ` : ""}
            {createdLabel}
          </span>
        </div>
        {/* Batch-first Phase 1 — production history summary. */}
        <ReferenceBatchSummary count={reference._count} referenceId={reference.id} />
      </div>
    </div>
  );
}

// ─── EmptyState (mini) ────────────────────────────────────────────────────
function EmptyState({
  tone,
  title,
  body,
  action,
}: {
  tone: "neutral" | "error";
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto max-w-md rounded-md border border-dashed px-6 py-12 text-center",
        tone === "error"
          ? "border-k-red bg-k-red-soft/30"
          : "border-line bg-paper",
      )}
      data-testid="references-empty"
    >
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {body ? <p className="mt-2 text-sm text-ink-2">{body}</p> : null}
      {action ? <div className="mt-4 inline-flex">{action}</div> : null}
    </div>
  );
}

// ─── SkeletonGrid (loading state) ─────────────────────────────────────────
function SkeletonGrid({ density }: { density: Density }) {
  return (
    <div
      className={cn(
        "grid gap-4",
        density === "dense"
          ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-6"
          : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
      )}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="k-card overflow-hidden">
          <div className="p-2 pb-0">
            <div
              className="k-thumb animate-pulse bg-[--k-bg-2]"
              data-aspect="square"
            />
          </div>
          <div className="p-3.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-line" />
            <div className="mt-2 h-2 w-1/2 animate-pulse rounded bg-line" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ReferenceBatchSummary ───────────────────────────────────────────────
/**
 * Batch-first Phase 1 — compact production history indicator on reference cards.
 *
 * Shows total design count (generatedDesigns + MJ outputs) with a link to
 * /batches filtered by referenceId. Renders nothing when count is zero or
 * data is absent — no noise on references without batch history.
 */
function ReferenceBatchSummary({
  count,
  referenceId,
}: {
  count?: { generatedDesigns: number; midjourneyJobs: number } | null;
  referenceId: string;
}) {
  if (!count) return null;
  const total = count.generatedDesigns + count.midjourneyJobs;
  if (total === 0) return null;

  return (
    <div className="mt-1.5">
      <Link
        href={`/batches?referenceId=${referenceId}`}
        className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wider text-info underline-offset-2 hover:underline"
        data-testid="reference-batch-summary"
        onClick={(e) => e.stopPropagation()}
      >
        {total} design{total !== 1 ? "s" : ""} · view batches
      </Link>
    </div>
  );
}

// ─── formatRelative ─────────────────────────────────────────────────────
function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}
