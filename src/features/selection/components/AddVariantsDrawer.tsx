"use client";

// Phase 7 Task 32 — AddVariantsDrawer
//
// Spec Section 2.2 + plan Task 32: Filmstrip "+ Varyant ekle" tile drawer
// trigger'ı. İki tab:
//   - "Reference Batches" (AKTİF) — reference seçimi → jobId üzerinden batch
//     grouping → multi-select + "Tüm batch'i ekle" → POST items.
//   - "Review Queue" (DISABLED) — Drift #6 + KIE flaky: Phase 6 canlı smoke
//     açık kaldığı için BLOCKED işler `selection-studio-review-queue-source`
//     hâlâ kapanmadı. Tab disabled tutulur, sahte capability YOK; tooltip
//     dürüst metin gösterir.
//
// Drawer pattern (CreateSetModal Radix Dialog ile aynı pattern, sağdan kayan
// fixed panel). Dialog.Content sağ kenarda max-w-md, full-height; CSS class
// ile sağdan slide-in. Token-only Tailwind sınıfları.
//
// Mutation: POST /api/selection/sets/[setId]/items body
// `{ items: [{ generatedDesignId }, ...] }` → server (Task 20) duplicate skip
// + cross-user filter zaten var. Success'te:
//   - `selectionSetQueryKey(setId)` invalidate (filmstrip yenilenir)
//   - drawer kapan + selection clear

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { AssetImage } from "@/components/ui/asset-image";
import {
  selectionSetQueryKey,
  useDrawerReferences,
  useDrawerDesigns,
  type DrawerDesign,
  type DrawerReference,
} from "../queries";

export type AddVariantsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setId: string;
  /**
   * Set'te zaten var olan generatedDesignId'ler. Drawer'da match'leyince
   * checkbox disabled + "set'te var" badge görünür. Server tarafında da
   * `addItems` Task 5 kontratı silent skip yapar — UI duplicate görünümü
   * yine de net olsun diye client-side filtre.
   */
  existingDesignIds: Set<string>;
};

type TabId = "batches" | "review-queue";

type Batch = {
  jobId: string;
  designs: DrawerDesign[];
  /** En yeni design'ın createdAt'i (batch sıralama anahtarı). */
  latestAt: string;
};

const REVIEW_QUEUE_DISABLED_TOOLTIP =
  "Phase 6 canlı smoke sonrası aktif edilecek";

/**
 * Designs array'ini jobId üzerinden gruplar. `jobId === null` olan design'lar
 * (eski Phase 5 öncesi rows) "_orphan" anahtarında tek batch olur.
 *
 * Sıralama: en yeni batch ilk (latestAt DESC). Batch içindeki design sırası
 * server'dan geldiği gibi (createdAt DESC).
 */
function groupDesignsByJobId(designs: DrawerDesign[]): Batch[] {
  const map = new Map<string, DrawerDesign[]>();
  for (const d of designs) {
    const key = d.jobId ?? "_orphan";
    const list = map.get(key);
    if (list) list.push(d);
    else map.set(key, [d]);
  }
  const batches: Batch[] = Array.from(map.entries()).map(([jobId, list]) => ({
    jobId,
    designs: list,
    latestAt: list[0]?.createdAt ?? "",
  }));
  batches.sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1));
  return batches;
}

/** Batch label — kısa "yyyy-MM-dd HH:mm" (TR locale). */
function formatBatchTimestamp(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Reference dropdown label — notes varsa kullan, yoksa id slice + productType. */
function referenceLabel(r: DrawerReference): string {
  const trimmed = r.notes?.trim();
  if (trimmed && trimmed.length > 0) return trimmed.slice(0, 60);
  const pt = r.productType?.displayName;
  const idSlice = r.id.slice(0, 6);
  return pt ? `${pt} · ${idSlice}` : idSlice;
}

export function AddVariantsDrawer({
  open,
  onOpenChange,
  setId,
  existingDesignIds,
}: AddVariantsDrawerProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("batches");
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitError, setSubmitError] = useState<string | null>(null);

  const referencesQuery = useDrawerReferences(open);
  const designsQuery = useDrawerDesigns(open ? referenceId : null);

  // Drawer kapanınca local state'i sıfırla. Sonraki açılışta temiz state.
  useEffect(() => {
    if (!open) {
      setReferenceId(null);
      setSelectedIds(new Set());
      setSubmitError(null);
      setActiveTab("batches");
    }
  }, [open]);

  const batches = useMemo(
    () => groupDesignsByJobId(designsQuery.data ?? []),
    [designsQuery.data],
  );

  const mutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch(`/api/selection/sets/${setId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: ids.map((id) => ({ generatedDesignId: id })),
        }),
      });
      if (!res.ok) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: unknown };
          if (typeof body.error === "string") detail = body.error;
        } catch {
          // ignore parse hatası
        }
        throw new Error(detail || `Variant eklenemedi (${res.status})`);
      }
      return (await res.json()) as { items: unknown[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: selectionSetQueryKey(setId) });
      setSubmitError(null);
      setSelectedIds(new Set());
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setSubmitError(err.message);
    },
  });

  function toggleDesign(designId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(designId)) next.delete(designId);
      else next.add(designId);
      return next;
    });
  }

  function selectEntireBatch(batch: Batch) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const d of batch.designs) {
        if (!existingDesignIds.has(d.id)) next.add(d.id);
      }
      return next;
    });
  }

  function handleSubmit() {
    if (selectedIds.size === 0 || mutation.isPending) return;
    setSubmitError(null);
    mutation.mutate(Array.from(selectedIds));
  }

  function handleOpenChange(next: boolean) {
    if (mutation.isPending) return;
    onOpenChange(next);
  }

  const selectedCount = selectedIds.size;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-text/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-label="Varyant ekle"
          className="fixed inset-y-0 right-0 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-popover focus:outline-none"
          onEscapeKeyDown={(e) => {
            if (mutation.isPending) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (mutation.isPending) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (mutation.isPending) e.preventDefault();
          }}
        >
          {/* Header: title */}
          <div className="border-b border-border px-4 py-3">
            <Dialog.Title className="text-base font-semibold text-text">
              Varyant ekle
            </Dialog.Title>
            <Dialog.Description className="mt-0.5 text-sm text-text-muted">
              Sete eklenecek varyantları seçin.
            </Dialog.Description>
          </div>

          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Kaynak"
            className="flex gap-1 border-b border-border bg-surface px-4 pt-3"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "batches"}
              onClick={() => setActiveTab("batches")}
              className={[
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors duration-fast ease-out",
                activeTab === "batches"
                  ? "border-accent text-text"
                  : "border-transparent text-text-muted hover:text-text",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              ].join(" ")}
            >
              Reference Batches
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={false}
              disabled
              title={REVIEW_QUEUE_DISABLED_TOOLTIP}
              aria-describedby="review-queue-disabled-hint"
              className="px-3 py-2 text-sm font-medium border-b-2 -mb-px border-transparent text-text-muted opacity-60 cursor-not-allowed"
            >
              Review Queue
              <span
                id="review-queue-disabled-hint"
                className="sr-only"
              >
                {REVIEW_QUEUE_DISABLED_TOOLTIP}
              </span>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {activeTab === "batches" ? (
              <BatchesTabContent
                referencesQuery={referencesQuery}
                designsQuery={designsQuery}
                referenceId={referenceId}
                onReferenceChange={setReferenceId}
                batches={batches}
                selectedIds={selectedIds}
                existingDesignIds={existingDesignIds}
                onToggleDesign={toggleDesign}
                onSelectEntireBatch={selectEntireBatch}
              />
            ) : null}
          </div>

          {/* Bottom action bar */}
          <div className="border-t border-border px-4 py-3">
            {submitError ? (
              <p
                role="alert"
                className="mb-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {submitError}
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-text-muted">
                {selectedCount > 0
                  ? `Eklenecek ${selectedCount} variant`
                  : "Seçim yok"}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenChange(false)}
                  disabled={mutation.isPending}
                >
                  İptal
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  data-testid="submit-add-items"
                  onClick={handleSubmit}
                  disabled={selectedCount === 0 || mutation.isPending}
                >
                  {mutation.isPending
                    ? "Ekleniyor..."
                    : `Ekle${
                        selectedCount > 0 ? ` (${selectedCount} variant)` : ""
                      }`}
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ────────────────────────────────────────────────────────────
// Batches tab content
// ────────────────────────────────────────────────────────────

type BatchesTabContentProps = {
  referencesQuery: ReturnType<typeof useDrawerReferences>;
  designsQuery: ReturnType<typeof useDrawerDesigns>;
  referenceId: string | null;
  onReferenceChange: (id: string | null) => void;
  batches: Batch[];
  selectedIds: Set<string>;
  existingDesignIds: Set<string>;
  onToggleDesign: (id: string) => void;
  onSelectEntireBatch: (batch: Batch) => void;
};

function BatchesTabContent({
  referencesQuery,
  designsQuery,
  referenceId,
  onReferenceChange,
  batches,
  selectedIds,
  existingDesignIds,
  onToggleDesign,
  onSelectEntireBatch,
}: BatchesTabContentProps) {
  if (referencesQuery.isLoading) {
    return (
      <div className="space-y-2" aria-label="Yükleniyor">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    );
  }

  if (referencesQuery.isError) {
    return (
      <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
        Referans listesi alınamadı.
      </p>
    );
  }

  const references = referencesQuery.data ?? [];

  if (references.length === 0) {
    return (
      <div className="rounded-md border border-border bg-bg/60 px-3 py-6 text-center text-sm text-text-muted">
        Henüz referansınız yok. Reference Board'dan ekleyin.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Reference selector */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="drawer-reference-select"
          className="text-sm font-medium text-text"
        >
          Referans seç
        </label>
        <select
          id="drawer-reference-select"
          value={referenceId ?? ""}
          onChange={(e) => onReferenceChange(e.target.value || null)}
          className="rounded-md border border-border bg-surface px-2 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <option value="">— Seçin —</option>
          {references.map((r) => (
            <option key={r.id} value={r.id}>
              {referenceLabel(r)}
            </option>
          ))}
        </select>
      </div>

      {/* Designs / batches */}
      {!referenceId ? (
        <p className="text-sm text-text-muted">
          Bir referans seçin; o referansa ait varyant batch'leri burada
          listelenecek.
        </p>
      ) : designsQuery.isLoading ? (
        <div className="space-y-2" aria-label="Yükleniyor">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : designsQuery.isError ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Variation designs alınamadı.
        </p>
      ) : batches.length === 0 ? (
        <div className="rounded-md border border-border bg-bg/60 px-3 py-6 text-center text-sm text-text-muted">
          Bu reference için henüz variation üretilmemiş.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {batches.map((batch) => (
            <BatchCard
              key={batch.jobId}
              batch={batch}
              selectedIds={selectedIds}
              existingDesignIds={existingDesignIds}
              onToggleDesign={onToggleDesign}
              onSelectEntireBatch={onSelectEntireBatch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Batch card
// ────────────────────────────────────────────────────────────

type BatchCardProps = {
  batch: Batch;
  selectedIds: Set<string>;
  existingDesignIds: Set<string>;
  onToggleDesign: (id: string) => void;
  onSelectEntireBatch: (batch: Batch) => void;
};

function BatchCard({
  batch,
  selectedIds,
  existingDesignIds,
  onToggleDesign,
  onSelectEntireBatch,
}: BatchCardProps) {
  const eligibleCount = batch.designs.filter(
    (d) => !existingDesignIds.has(d.id),
  ).length;

  return (
    <div
      data-testid="batch-card"
      className="rounded-md border border-border bg-surface p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-mono text-xs uppercase tracking-meta text-text-muted">
            {formatBatchTimestamp(batch.latestAt)}
          </span>
          <span className="text-sm text-text">
            {batch.designs.length} varyant
            {eligibleCount < batch.designs.length
              ? ` · ${batch.designs.length - eligibleCount} set'te var`
              : ""}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onSelectEntireBatch(batch)}
          disabled={eligibleCount === 0}
        >
          Tüm batch&apos;i ekle
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {batch.designs.map((d, idx) => {
          const isExisting = existingDesignIds.has(d.id);
          const isSelected = selectedIds.has(d.id);
          return (
            <label
              key={d.id}
              className={[
                "relative block cursor-pointer overflow-hidden rounded-sm border-2 aspect-portrait",
                isSelected ? "border-accent" : "border-transparent",
                isExisting ? "opacity-40 cursor-not-allowed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                type="checkbox"
                role="checkbox"
                aria-label={`Varyant ${idx + 1}`}
                checked={isSelected}
                disabled={isExisting}
                onChange={() => {
                  if (!isExisting) onToggleDesign(d.id);
                }}
                className="sr-only"
              />
              <AssetImage assetId={d.assetId} alt="" frame={false} />
              {isExisting ? (
                <div
                  aria-hidden
                  className="absolute bottom-0.5 left-0.5 right-0.5 rounded-sm bg-text px-1 py-0.5 text-center font-mono text-xs text-bg"
                >
                  set&apos;te var
                </div>
              ) : null}
              {isSelected && !isExisting ? (
                <div
                  aria-hidden
                  className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-sm bg-accent text-accent-foreground"
                >
                  <span className="text-xs">✓</span>
                </div>
              ) : null}
            </label>
          );
        })}
      </div>
    </div>
  );
}
