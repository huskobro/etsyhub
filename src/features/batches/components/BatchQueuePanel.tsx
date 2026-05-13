"use client";

/**
 * Phase 46 — Batch Queue Panel (collapsible + remove items).
 *
 * Phase 45 baseline'ında panel her zaman expanded'di — operatör Pool'a
 * baktığında sağda ~320px alan kaybediyordu. Phase 46:
 *   - Default state localStorage-persistent (operatör tercihi hatırlanır)
 *   - Collapsed: 56px rail, sticky right, count badge + click-to-expand
 *   - Expanded: 320px panel, full item list, remove button per item,
 *     close-to-collapse button
 *   - DRAFT yoksa panel hiç render edilmez (Pool full-width)
 *
 * Remove behavior: queue item × button → DELETE /api/batches/[id]/items/
 * [itemId] → optimistic-feeling refetch invalidation. Service yalnız
 * DRAFT'a izin verir; operatör QUEUED batch'in item'ını silemez.
 *
 * UX kararı: collapsed state'te bile "Create Similar (N)" CTA görünür
 * — operatör panel'i açmadan launch'a iniş yolu kapanmaz. Mobile/dar
 * ekranlar için ileride drawer pattern düşünülebilir; şu an desktop-
 * first.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChevronRight, Sparkles, X, Layers } from "lucide-react";
import { AssetImage } from "@/components/ui/asset-image";
import { cn } from "@/lib/cn";

type DraftBatchItem = {
  id: string;
  position: number;
  reference: {
    id: string;
    asset: { id: string; sourceUrl: string | null } | null;
    bookmark: { title: string | null } | null;
    productType: { displayName: string } | null;
  };
};

type DraftBatch = {
  id: string;
  label: string | null;
  state: string;
  updatedAt: string;
  items: DraftBatchItem[];
};

const COLLAPSED_KEY = "kivasy.queuePanel.collapsed";

export function BatchQueuePanel() {
  const qc = useQueryClient();

  const [collapsed, setCollapsed] = useState<boolean>(false);
  // localStorage hydration. Default expanded on first visit; on subsequent
  // visits remember the previous toggle so operator preference sticks.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(COLLAPSED_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* localStorage disabled — silent skip */
    }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const query = useQuery<{ batch: DraftBatch | null }>({
    queryKey: ["batches", "current-draft"],
    queryFn: async () => {
      const res = await fetch("/api/batches/current-draft", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load draft");
      return res.json();
    },
    refetchInterval: 5_000,
  });

  const removeItem = useMutation({
    mutationFn: async (args: { batchId: string; itemId: string }) => {
      const res = await fetch(
        `/api/batches/${args.batchId}/items/${args.itemId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to remove item");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches", "current-draft"] });
    },
  });

  const batch = query.data?.batch;

  if (!batch || batch.items.length === 0) {
    // No active draft → panel hidden entirely.
    return null;
  }

  const referencesWithoutPublicUrl = batch.items.filter(
    (item) => !item.reference.asset?.sourceUrl,
  ).length;

  if (collapsed) {
    // Phase 46 — collapsed rail (56px). Click to expand.
    return (
      <aside
        className="sticky top-0 flex h-screen w-14 flex-shrink-0 flex-col border-l border-line bg-k-bg-2/30"
        data-testid="batch-queue-panel"
        data-collapsed="true"
        data-batch-id={batch.id}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex h-full w-full flex-col items-center gap-3 py-4 text-ink-3 transition-colors hover:bg-k-bg-2 hover:text-ink"
          aria-label={`Expand draft batch (${batch.items.length} reference${batch.items.length === 1 ? "" : "s"})`}
          data-testid="batch-queue-expand"
        >
          <Layers className="h-4 w-4" aria-hidden />
          <span
            className="rounded-full bg-k-orange px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-k-orange-ink"
            data-testid="batch-queue-collapsed-count"
          >
            {batch.items.length}
          </span>
        </button>
      </aside>
    );
  }

  // Expanded state
  return (
    <aside
      className="sticky top-0 flex h-screen w-80 flex-shrink-0 flex-col border-l border-line bg-paper"
      data-testid="batch-queue-panel"
      data-collapsed="false"
      data-batch-id={batch.id}
    >
      <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[13.5px] font-semibold text-ink">
              Draft batch
            </h2>
            <span
              className="rounded-full bg-k-orange-soft px-1.5 font-mono text-[10.5px] font-semibold text-k-orange-ink"
              data-testid="batch-queue-count"
            >
              {batch.items.length}
            </span>
          </div>
          <p
            className="mt-0.5 truncate font-mono text-[10.5px] tracking-wider text-ink-3"
            title={batch.label ?? ""}
          >
            {batch.label ?? "Untitled batch"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-k-bg hover:text-ink"
          aria-label="Collapse draft panel"
          data-testid="batch-queue-collapse"
          title="Collapse — keep working in Pool"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="flex flex-col gap-2" data-testid="batch-queue-items">
          {batch.items.map((item) => {
            const isRemoving =
              removeItem.isPending &&
              removeItem.variables?.itemId === item.id;
            return (
              <li
                key={item.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md border border-line-soft bg-paper p-2 transition-opacity",
                  isRemoving && "opacity-40",
                )}
                data-testid="batch-queue-item"
                data-reference-id={item.reference.id}
                data-item-id={item.id}
              >
                <div className="k-thumb !aspect-square !w-12 flex-shrink-0 overflow-hidden rounded-md">
                  {item.reference.asset ? (
                    <AssetImage
                      assetId={item.reference.asset.id}
                      alt={item.reference.bookmark?.title ?? "Reference"}
                      frame={false}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-3">
                      —
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium leading-tight text-ink">
                    {item.reference.bookmark?.title ?? "Untitled"}
                  </div>
                  {item.reference.productType ? (
                    <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-meta text-ink-3">
                      {item.reference.productType.displayName}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    removeItem.mutate({
                      batchId: batch.id,
                      itemId: item.id,
                    })
                  }
                  disabled={isRemoving}
                  className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-ink-3 opacity-0 transition-all hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label={`Remove ${item.reference.bookmark?.title ?? "reference"} from draft`}
                  data-testid="batch-queue-item-remove"
                  title="Remove from draft"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {referencesWithoutPublicUrl > 0 ? (
        <div
          className="border-t border-warning/40 bg-warning-soft/40 px-4 py-2 text-[11.5px] text-ink"
          data-testid="batch-queue-warning"
        >
          {referencesWithoutPublicUrl} reference
          {referencesWithoutPublicUrl === 1 ? "" : "s"} without a public URL —
          AI launch needs URL-sourced references.
        </div>
      ) : null}

      <div className="border-t border-line bg-paper px-3 py-3">
        <Link
          href={`/batches/${batch.id}/compose`}
          className="k-btn k-btn--primary w-full"
          data-size="sm"
          data-testid="batch-queue-open-compose"
          title="Open the Create Similar compose page for this draft batch"
        >
          <Sparkles className="h-3 w-3" aria-hidden />
          Create Similar ({batch.items.length})
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
