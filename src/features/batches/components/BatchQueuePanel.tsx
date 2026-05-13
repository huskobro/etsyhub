"use client";

/**
 * Phase 46 — Batch Queue Panel (collapsible + remove items).
 * Phase 47 — Default collapsed + inline Compose mode.
 * Phase 60 — Default EXPANDED + provider-aware Compose form (Midjourney
 *   first-class + mode picker + sref/oref/cref chips + honest backend
 *   disclosure).
 *
 * Phase 60 kararları:
 *   1. **Default expanded** (Phase 47 defaultu collapsed idi; operator
 *      Pool'da "Add to Draft" yapınca Create Similar formu iki tıklama
 *      gerisindeydi — Phase 60 düzeltmesi: panel queue mode'da hemen
 *      açılır, form'un girişi tek tıklamaya iner). Operatör hâlâ
 *      collapse edebilir; localStorage tercihini hatırlar.
 *   2. **Provider-aware form fields**: provider seçimine göre alanlar
 *      farklılaşır (Midjourney → mode picker + sref/oref/cref + prompt;
 *      Kie GPT → brief + quality). provider-capabilities.formFields
 *      tek doğruluk kaynağı.
 *   3. **Midjourney default**: settings'ten override gelmezse Midjourney
 *      seçili gelir (operator preference: Midjourney-first).
 *   4. **Honest backend disclosure**: Midjourney `launchBackendReady=false`
 *      olduğu için launch CTA disabled + actionable hint ("Switch to Kie
 *      to launch now"). Fake disabled CTA DEĞİL — operatör tıklayınca ne
 *      olacağını/olmayacağını biliyor, alternative path biliyor.
 *
 * Mode kararı UX gerekçesi (CLAUDE.md Madde A "single canonical surface"):
 *   - Pool'da operatör staging yapıyor → aynı panel'de compose etmesi
 *     mental model'i kesintisiz tutar
 *   - Ayrı /batches/[id]/compose page'i hâlâ erişilebilir (deep-link
 *     bookmark + backward compat); ama Pool'dan inline akış canonical
 *   - Yeni big abstraction yok: form alanları BatchComposeClient ile
 *     uyumlu (provider/aspect/similarity/count/quality/brief +
 *     Phase 60 Midjourney mode/prompt/refparams); launch endpoint aynı
 *     (POST /api/batches/[id]/launch)
 *
 * Provider/aspect defaults Phase 9 + Phase 60:
 *   - provider: Midjourney (Phase 60; Kie GPT idi)
 *   - aspect: 2:3
 *   - count: 6
 *   - similarity: Medium (advisory; brief'e enjekte edilmez)
 *   - quality: medium (if supported by provider)
 *   - midjourney mode: "sref" (Phase 60 — style reference Etsy/Pinterest
 *     reference workflow için en doğal default)
 *
 * Remove behavior: queue item × button → DELETE /api/batches/[id]/items/
 * [itemId] → optimistic-feeling refetch invalidation. Service yalnız
 * DRAFT'a izin verir.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronRight,
  Sparkles,
  X,
  Layers,
} from "lucide-react";
import { AssetImage } from "@/components/ui/asset-image";
import { cn } from "@/lib/cn";
import { BatchComposeSplitModal } from "./BatchComposeSplitModal";

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
  const router = useRouter();

  /* Phase 60 — Default EXPANDED (Phase 47 defaultu collapsed idi).
   * Sebep: operator Pool'da "Add to Draft" yapınca Create Similar formu
   * iki tıklama gerisindeydi (rail + Create Similar). Phase 60'ta panel
   * Pool'a girer girmez expanded açılır; queue list + Create Similar
   * CTA hemen görünür. Operatör hâlâ collapse edebilir; localStorage
   * "1" ile tercihi hatırlanır.
   *
   * localStorage truth-table:
   *   - no value (first visit) → expanded (Phase 60 default)
   *   - "0" → expanded (legacy Phase 47 explicit expand)
   *   - "1" → collapsed (explicit operator collapse) */
  const [collapsed, setCollapsed] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(COLLAPSED_KEY);
      if (stored === "1") {
        setCollapsed(true);
      }
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

  /* Phase 62 — Modal compose. Phase 47 inline ComposePanel mode kaldırıldı
   * (440px sıkışık idi); v4 A6 split modal canonical compose surface.
   * "Create Similar" CTA modal açar; panel queue mode'da kalır. Launch
   * sonrası modal kapanır + /batches/[id] redirect. */
  const [composeModalOpen, setComposeModalOpen] = useState<boolean>(false);

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
    // No active draft → panel hidden entirely. If we were in compose
    // mode and items get removed externally, fall back gracefully.
    return null;
  }

  const referencesWithoutPublicUrl = batch.items.filter(
    (item) => !item.reference.asset?.sourceUrl,
  ).length;

  if (collapsed) {
    // Phase 46 — collapsed rail (56px). Click to expand.
    return (
      <>
        <aside
          className="sticky top-0 flex h-screen w-14 flex-shrink-0 flex-col border-l border-line bg-k-bg-2/30"
          data-testid="batch-queue-panel"
          data-collapsed="true"
          data-mode="queue"
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
        {/* Modal can still open while collapsed (operator triggered from
         * elsewhere in future; today only the expanded CTA opens it). */}
        <BatchComposeSplitModal
          batch={batch}
          open={composeModalOpen}
          onClose={() => setComposeModalOpen(false)}
          onLaunchSuccess={(batchId) => {
            setComposeModalOpen(false);
            router.push(`/batches/${batchId}`);
          }}
        />
      </>
    );
  }

  // Expanded queue mode
  return (
    <>
    <aside
      className="sticky top-0 flex h-screen w-80 flex-shrink-0 flex-col border-l border-line bg-paper"
      data-testid="batch-queue-panel"
      data-collapsed="false"
      data-mode="queue"
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
        /* Phase 49 — Warning sakinleştirildi (Phase 48 sürdürüldü).
         * Sakin info tone + actionable copy: operatör hangisini fix
         * edeceğini ve nereye gideceğini öğrenir. */
        <div
          className="flex items-start gap-2 border-t border-line-soft bg-k-bg-2/50 px-4 py-2 text-[11px] text-ink"
          data-testid="batch-queue-warning"
        >
          <span
            className="mt-1 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-k-amber"
            aria-hidden
          />
          <span className="text-ink-2">
            {referencesWithoutPublicUrl === batch.items.length
              ? "All references are local-only — AI launch needs URL-sourced refs."
              : `${referencesWithoutPublicUrl} of ${batch.items.length} reference${
                  batch.items.length === 1 ? "" : "s"
                } local-only — launch will skip them.`}
          </span>
        </div>
      ) : null}

      <div
        className="border-t border-line bg-paper px-3 py-3"
        data-testid="batch-queue-footer"
      >
        <button
          type="button"
          onClick={() => setComposeModalOpen(true)}
          className="k-btn k-btn--primary w-full"
          data-size="sm"
          data-testid="batch-queue-open-compose"
          title="Open Create Similar compose modal (provider, mode, count, aspect)"
        >
          <Sparkles className="h-3 w-3" aria-hidden />
          Create Similar ({batch.items.length})
          <ArrowRight className="h-3 w-3" aria-hidden />
        </button>

        {/* Phase 49 — Next-step handoff strip.
         *
         * Operatör draft'ı doldurduktan sonra "ne olacak?" sorusunun
         * cevabını burada görür. Three-line subtle guidance:
         *   1) After launch this becomes a Batch in Batches
         *   2) Track progress + decide kept items there
         *   3) You can stage multiple drafts in parallel from Pool
         *
         * Görünüm: küçük border-t separator + mono caption + Batches
         * link chip. Didaktik metin değil; küçük yönlendirme satırı.
         * Operatör çoklu batch modelini de görerek "tek batch zorunda
         * değilim" mental model'ini alır. */}
        <div
          className="mt-3 rounded-md border border-line-soft bg-k-bg-2/40 px-2.5 py-2"
          data-testid="batch-queue-handoff"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-[9.5px] uppercase tracking-meta text-ink-3">
              Next
            </span>
            <Link
              href="/batches"
              className="font-mono text-[9.5px] uppercase tracking-meta text-ink-2 underline-offset-2 hover:text-ink hover:underline"
              data-testid="batch-queue-handoff-batches-link"
              title="Open Batches to see all draft + running batches"
            >
              All batches →
            </Link>
          </div>
          <p className="mt-1 text-[11px] leading-tight text-ink-2">
            Launching this draft creates a batch you&apos;ll track in{" "}
            <Link
              href="/batches"
              className="text-ink hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Batches
            </Link>
            . You can keep multiple drafts in parallel — each Pool
            selection starts its own batch.
          </p>
        </div>

        <Link
          href={`/batches/${batch.id}/compose`}
          className="mt-2 block w-full text-center font-mono text-[10px] uppercase tracking-meta text-ink-3 hover:text-ink-2"
          data-testid="batch-queue-open-compose-page"
          title="Open compose in a dedicated page (deep-link, Kie-only)"
        >
          Or open full compose page →
        </Link>
      </div>
    </aside>
    {/* Phase 62 — Split modal compose (v4 A6 canonical layout) */}
    <BatchComposeSplitModal
      batch={batch}
      open={composeModalOpen}
      onClose={() => setComposeModalOpen(false)}
      onLaunchSuccess={(batchId) => {
        setComposeModalOpen(false);
        router.push(`/batches/${batchId}`);
      }}
    />
    </>
  );
}

