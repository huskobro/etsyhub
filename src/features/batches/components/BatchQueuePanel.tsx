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

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Sparkles,
  X,
  Layers,
} from "lucide-react";
import { AssetImage } from "@/components/ui/asset-image";
import { cn } from "@/lib/cn";
import {
  PROVIDER_CAPABILITIES,
  getProviderCapability,
  resolveDefaultProvider,
  midjourneyModeRequirements,
  type ImageProviderUiId,
  type MidjourneyMode,
} from "@/features/variation-generation/provider-capabilities";

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

type PanelMode = "queue" | "compose";
type AspectRatio = "1:1" | "2:3" | "3:2";
type Quality = "medium" | "high";

const SIMILARITY_STOPS = ["Close", "Medium", "Loose", "Inspired"] as const;
const COST_PER_VARIATION_CENTS = 24;

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

  /* Phase 47 — Inline compose mode. Default "queue". "Create Similar"
   * CTA mode'u "compose"'a çevirir; panel genişler, inline form render
   * eder. Back arrow → mode "queue"'a döner (data kalır, form state
   * kalır). Launch başarılı olunca → /batches/[id]. */
  const [mode, setMode] = useState<PanelMode>("queue");

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
      <aside
        className="sticky top-0 flex h-screen w-14 flex-shrink-0 flex-col border-l border-line bg-k-bg-2/30"
        data-testid="batch-queue-panel"
        data-collapsed="true"
        data-mode={mode}
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

  if (mode === "compose") {
    return (
      <ComposePanel
        batch={batch}
        referencesWithoutPublicUrl={referencesWithoutPublicUrl}
        onBack={() => setMode("queue")}
        onCollapse={toggleCollapsed}
        onLaunchSuccess={() => {
          // Operatör batch detail'a düşer; queue mode'a geri sıfırla
          // ki sıradaki staging yeni mode'la başlasın.
          setMode("queue");
          router.push(`/batches/${batch.id}`);
        }}
      />
    );
  }

  // Expanded queue mode
  return (
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
          onClick={() => setMode("compose")}
          className="k-btn k-btn--primary w-full"
          data-size="sm"
          data-testid="batch-queue-open-compose"
          title="Open the Create Similar compose form inline for this draft batch"
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
          title="Open compose in a dedicated page (deep-link)"
        >
          Or open full compose page →
        </Link>
      </div>
    </aside>
  );
}

/* ---------------- Compose panel (inline) ---------------- */

function ComposePanel({
  batch,
  referencesWithoutPublicUrl,
  onBack,
  onCollapse,
  onLaunchSuccess,
}: {
  batch: DraftBatch;
  referencesWithoutPublicUrl: number;
  onBack: () => void;
  onCollapse: () => void;
  onLaunchSuccess: () => void;
}) {
  /* Phase 60 — Default provider Midjourney (operator preference).
   * resolveDefaultProvider helper'ı settings override + canonical fallback
   * mantığını tek yerden okur. Midjourney available=true; launch backend
   * dispatcher Phase 61 olduğunda launchBackendReady=true olur. */
  const [providerId, setProviderId] = useState<ImageProviderUiId>(() =>
    resolveDefaultProvider(),
  );
  const [aspect, setAspect] = useState<AspectRatio>("2:3");
  const [similarity, setSimilarity] = useState<number>(1); // Medium
  const [count, setCount] = useState<number>(6);
  const [quality, setQuality] = useState<Quality>("medium");
  const [brief, setBrief] = useState<string>("");

  /* Phase 60 — Midjourney-specific state. Diğer provider'larda kullanılmaz.
   * Default mode "sref" — Etsy/Pinterest reference workflow için en
   * doğal başlangıç (style reference; operator prompt eklemese de çalışır). */
  const [mjMode, setMjMode] = useState<MidjourneyMode>("sref");
  const [mjPrompt, setMjPrompt] = useState<string>("");

  const providerCap = getProviderCapability(providerId);
  const formFields = providerCap?.formFields;
  const supportsQuality =
    formFields?.showQuality === true &&
    (providerCap?.supportedQualities.length ?? 0) > 0;
  const isMidjourney = providerId === "midjourney";
  const mjReq = isMidjourney ? midjourneyModeRequirements(mjMode) : null;

  // Phase 48 — Multi-reference cost: N refs × M count.
  // Phase 61 — Describe mode: count ignored (1 describe per ref).
  //            Midjourney bridge: no API cost (operator's MJ subscription).
  const refCount = batch.items.length;
  const isDescribe = isMidjourney && mjMode === "describe";
  const effectiveCount = isDescribe ? 1 : count;
  const totalGenerations = refCount * effectiveCount;
  const totalCostCents = isMidjourney
    ? 0
    : COST_PER_VARIATION_CENTS * totalGenerations;
  const totalCostUSD = (totalCostCents / 100).toFixed(2);
  const estMinutes = Math.max(1, Math.round(totalGenerations * 0.5));

  const launchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/batches/${batch.id}/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerId,
          aspectRatio: aspect,
          ...(supportsQuality ? { quality } : {}),
          count,
          ...(brief.trim() ? { brief: brief.trim() } : {}),
          // Phase 61 — Midjourney provider-specific payload
          ...(isMidjourney
            ? {
                mjMode,
                ...(mjPrompt.trim() && mjMode !== "describe"
                  ? { mjPrompt: mjPrompt.trim() }
                  : {}),
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Failed to launch batch");
      }
      return (await res.json()) as {
        batchId: string;
        state: string;
        designIds: string[];
        failedDesignIds: string[];
        perReference: Array<{
          referenceId: string;
          designIds: string[];
          failedDesignIds: string[];
          error?: string;
        }>;
      };
    },
    onSuccess: (result) => {
      /* Phase 49 — Stash one-shot launch outcome for batch detail
       * banner. sessionStorage chosen because:
       *   - one-shot delivery (banner reads + deletes on mount)
       *   - survives navigation hop (queue panel → /batches/[id])
       *   - cleared on refresh, so banner doesn't haunt the page
       * CLAUDE.md Madde A "tek canonical surface": result görünür
       * yüzeyi yalnız batch detail; queue panel'inde değil. */
      try {
        const successRefs = result.perReference.filter(
          (r) => r.designIds.length > 0,
        ).length;
        const skippedRefs = result.perReference.filter(
          (r) => r.error && r.designIds.length === 0,
        ).length;
        const failedRefs = result.perReference.filter(
          (r) => r.error || r.failedDesignIds.length > 0,
        ).length;
        window.sessionStorage.setItem(
          `kivasy.launchOutcome.${result.batchId}`,
          JSON.stringify({
            ts: Date.now(),
            state: result.state,
            totalRefs: result.perReference.length,
            totalDesigns: result.designIds.length,
            totalFailed: result.failedDesignIds.length,
            successRefs,
            skippedRefs,
            failedRefs,
            perReference: result.perReference,
            composeParams: {
              count,
              aspectRatio: aspect,
              quality: supportsQuality ? quality : null,
              providerId,
            },
          }),
        );
      } catch {
        /* sessionStorage disabled — silent; redirect still works */
      }
      onLaunchSuccess();
    },
  });

  const hasItems = batch.items.length > 0;
  const someReferencesUnreachable = referencesWithoutPublicUrl > 0;
  /* Phase 60 — Honest backend disclosure.
   * Midjourney `available: true` ama `launchBackendReady: false` →
   * launch tetiklenemez; operator alternative path görür. Bu fake
   * disabled CTA DEĞİL (Phase 58 yasak): operator tıklayamaz, ama
   * NEDEN tıklayamadığını biliyor (honest hint) + NE YAPMASI gerektiğini
   * biliyor (switch to Kie). */
  const backendNotReady = providerCap?.launchBackendReady === false;
  const launchDisabled =
    !hasItems ||
    someReferencesUnreachable ||
    !providerCap?.available ||
    backendNotReady ||
    launchMutation.isPending;

  return (
    <aside
      className="sticky top-0 flex h-screen w-[440px] flex-shrink-0 flex-col border-l border-line bg-paper"
      data-testid="batch-queue-panel"
      data-collapsed="false"
      data-mode="compose"
      data-batch-id={batch.id}
    >
      <div className="flex items-center gap-2 border-b border-line bg-paper px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-k-bg hover:text-ink"
          aria-label="Back to draft queue"
          data-testid="batch-compose-inline-back"
          title="Back to draft queue"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2
              className="text-[13.5px] font-semibold text-ink"
              data-testid="batch-compose-inline-title"
            >
              Create Similar
            </h2>
            <span
              className="rounded-full bg-k-orange-soft px-1.5 font-mono text-[10.5px] font-semibold text-k-orange-ink"
              data-testid="batch-compose-inline-count"
            >
              {batch.items.length}
            </span>
          </div>
          <p className="mt-0.5 truncate font-mono text-[10.5px] tracking-wider text-ink-3">
            From draft · {batch.label ?? "Untitled batch"}
          </p>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-k-bg hover:text-ink"
          aria-label="Collapse panel"
          data-testid="batch-compose-inline-collapse"
          title="Collapse — keep working in Pool"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        data-testid="batch-compose-inline-form"
      >
        <div className="space-y-5">
          {/* Provider — provider-aware form root */}
          <FieldRow label="Provider">
            <select
              value={providerId}
              onChange={(e) =>
                setProviderId(e.target.value as ImageProviderUiId)
              }
              className="h-9 w-full rounded-md border border-line bg-paper px-2.5 text-[12.5px] text-ink"
              data-testid="batch-compose-inline-provider"
              data-provider={providerId}
            >
              {PROVIDER_CAPABILITIES.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.available}>
                  {p.label}
                  {p.available ? "" : " — coming soon"}
                </option>
              ))}
            </select>
            {/* Phase 60 — Honest backend disclosure.
             * Available + launchBackendReady=false durumda Kie fallback
             * link gösterilir; operator switch'i tek tıklamada. */}
            {backendNotReady && providerCap?.helperText ? (
              <div
                className="mt-2 rounded-md border border-warning/40 bg-warning-soft/30 px-2.5 py-2 text-[11.5px] text-ink"
                data-testid="batch-compose-inline-backend-disclosure"
              >
                <p className="text-ink-2">{providerCap.helperText}</p>
                <button
                  type="button"
                  onClick={() => setProviderId("kie-gpt-image-1.5")}
                  className="mt-1.5 inline-flex h-6 items-center gap-1 rounded-md border border-line bg-paper px-2 font-mono text-[10px] uppercase tracking-meta text-ink-2 hover:border-line-strong hover:text-ink"
                  data-testid="batch-compose-inline-switch-to-kie"
                >
                  Switch to Kie · GPT Image 1.5 →
                </button>
              </div>
            ) : null}
            {!providerCap?.available && providerCap?.helperText ? (
              <p className="mt-1 text-[11px] text-ink-3">
                {providerCap.helperText}
              </p>
            ) : null}
          </FieldRow>

          {/* Phase 60 — Midjourney mode picker (provider-aware) */}
          {isMidjourney && formFields?.showModeSelector ? (
            <FieldRow label="Generation mode" hint={mjReq?.hint}>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: "imagine", label: "/imagine" },
                    { id: "image-prompt", label: "Image prompt" },
                    { id: "sref", label: "--sref" },
                    { id: "oref", label: "--oref" },
                    { id: "cref", label: "--cref" },
                    { id: "describe", label: "Describe" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMjMode(m.id)}
                    className={cn(
                      "h-8 rounded-md border text-[11px] font-medium transition-colors",
                      mjMode === m.id
                        ? "border-k-orange bg-k-orange-soft text-k-orange-ink"
                        : "border-line bg-paper text-ink-2 hover:border-line-strong",
                    )}
                    data-testid="batch-compose-inline-mj-mode"
                    data-mode={m.id}
                    data-active={mjMode === m.id || undefined}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </FieldRow>
          ) : null}

          {/* Phase 60 — Prompt field (Midjourney) */}
          {isMidjourney && formFields?.showPrompt ? (
            <FieldRow
              label="Prompt"
              hint={
                mjReq?.promptDisabled
                  ? "Disabled in describe mode"
                  : mjReq?.promptRequired
                    ? "Required"
                    : "Optional · recommended"
              }
            >
              <textarea
                value={mjPrompt}
                onChange={(e) => setMjPrompt(e.target.value.slice(0, 800))}
                rows={3}
                disabled={mjReq?.promptDisabled === true}
                placeholder={
                  mjMode === "describe"
                    ? "Describe doesn't take a prompt — only the reference is sent."
                    : mjMode === "sref" || mjMode === "oref" || mjMode === "cref"
                      ? "e.g., 'soft floral wreath, nursery wall art, watercolor'"
                      : "e.g., 'boho line art bundle, beige palette, minimalist composition'"
                }
                className={cn(
                  "w-full resize-none rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-3",
                  mjReq?.promptDisabled && "opacity-50",
                )}
                data-testid="batch-compose-inline-mj-prompt"
              />
            </FieldRow>
          ) : null}

          <FieldRow label="Aspect ratio">
            <div className="flex gap-2">
              {(["1:1", "3:2", "2:3"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAspect(a)}
                  className={cn(
                    "h-9 flex-1 rounded-md border text-[12px] font-medium transition-colors",
                    aspect === a
                      ? "border-k-orange bg-k-orange-soft text-k-orange-ink"
                      : "border-line bg-paper text-ink-2 hover:border-line-strong",
                  )}
                  data-testid="batch-compose-inline-aspect"
                  data-aspect={a}
                  data-active={aspect === a || undefined}
                >
                  {a}
                </button>
              ))}
            </div>
          </FieldRow>

          <FieldRow label="Similarity" hint={SIMILARITY_STOPS[similarity]}>
            <div className="flex">
              {SIMILARITY_STOPS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSimilarity(i)}
                  className={cn(
                    "-ml-px h-9 flex-1 border border-line text-[11.5px] font-medium transition-colors first:ml-0 first:rounded-l-md last:rounded-r-md",
                    i === similarity
                      ? "z-10 relative border-k-orange bg-k-orange-soft text-k-orange-ink"
                      : "bg-paper text-ink-2 hover:border-line-strong",
                  )}
                  data-testid="batch-compose-inline-similarity"
                  data-active={i === similarity || undefined}
                >
                  {s}
                </button>
              ))}
            </div>
          </FieldRow>

          {formFields?.showCount ? (
            <FieldRow label="Count">
              <div className="flex">
                {[2, 3, 4, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={cn(
                      "-ml-px h-9 flex-1 border border-line text-[13px] font-semibold transition-colors first:ml-0 first:rounded-l-md last:rounded-r-md",
                      n === count
                        ? "z-10 relative border-k-orange bg-k-orange-soft text-k-orange-ink"
                        : "bg-paper text-ink-2 hover:border-line-strong",
                    )}
                    data-testid="batch-compose-inline-count-stop"
                    data-active={n === count || undefined}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </FieldRow>
          ) : null}

          {supportsQuality ? (
            <FieldRow label="Quality">
              <div className="flex">
                {(["medium", "high"] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuality(q)}
                    className={cn(
                      "-ml-px h-9 flex-1 border border-line text-[12.5px] font-medium capitalize transition-colors first:ml-0 first:rounded-l-md last:rounded-r-md",
                      q === quality
                        ? "z-10 relative border-k-orange bg-k-orange-soft text-k-orange-ink"
                        : "bg-paper text-ink-2 hover:border-line-strong",
                    )}
                    data-testid="batch-compose-inline-quality"
                    data-active={q === quality || undefined}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </FieldRow>
          ) : null}

          {/* Brief — Kie pattern (single text field), Midjourney'de gizli
              çünkü prompt zaten yukarıda */}
          {formFields?.showBrief ? (
            <FieldRow label="Brief" hint="Optional · max 500 chars">
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Optional style note — e.g., 'soft pastel palette' or 'add line art accents'"
                className="w-full resize-none rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-3"
                data-testid="batch-compose-inline-brief"
              />
            </FieldRow>
          ) : null}

          {someReferencesUnreachable ? (
            <div
              className="flex items-start gap-2 rounded-md border border-line-soft bg-k-bg-2/40 px-3 py-2 text-[11.5px] text-ink"
              data-testid="batch-compose-inline-url-warning"
            >
              <span
                className="mt-0.5 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-k-amber"
                aria-hidden
              />
              <span className="text-ink-2">
                {referencesWithoutPublicUrl === refCount
                  ? "All "
                  : `${referencesWithoutPublicUrl} of ${refCount} `}
                {referencesWithoutPublicUrl === 1 && refCount !== 1
                  ? "reference is"
                  : "references are"}{" "}
                local-only. AI launch needs URL-sourced references —{" "}
                remove the local items from the draft to launch the rest.
              </span>
            </div>
          ) : null}

          {launchMutation.isError ? (
            <div
              role="alert"
              className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-[12px] text-danger"
              data-testid="batch-compose-inline-error"
            >
              {(launchMutation.error as Error).message}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line bg-paper px-4 py-3">
        <span
          className="font-mono text-[10.5px] text-ink-3"
          data-testid="batch-compose-inline-cost"
        >
          {backendNotReady
            ? "Backend handoff pending"
            : isMidjourney
              ? isDescribe
                ? `${refCount} describe${refCount === 1 ? "" : "s"} · bridge (free)`
                : `${totalGenerations} gen${totalGenerations === 1 ? "" : "s"} · bridge (free) · est. ${estMinutes}m`
              : `${refCount > 1 ? `${totalGenerations} gens · ` : ""}~$${totalCostUSD} · est. ${estMinutes}m`}
        </span>
        <button
          type="button"
          className="k-btn k-btn--primary"
          data-size="sm"
          disabled={launchDisabled}
          onClick={() => launchMutation.mutate()}
          data-testid="batch-compose-inline-launch"
          title={
            backendNotReady
              ? "Backend handoff pending — switch provider to launch now."
              : isDescribe
                ? "Describe pipeline returns prompt suggestions (no generation)."
                : undefined
          }
        >
          <Sparkles className="h-3 w-3" aria-hidden />
          {launchMutation.isPending
            ? "Launching…"
            : backendNotReady
              ? "Awaiting backend handoff"
              : isDescribe
                ? `Describe ${refCount} reference${refCount === 1 ? "" : "s"}`
                : isMidjourney
                  ? refCount > 1
                    ? `Create Similar · ${refCount} × ${count}`
                    : `Create Similar · ${count}`
                  : refCount > 1
                    ? `Create Similar · ${refCount} × ${count}`
                    : `Create Similar · ${count}`}
        </button>
      </div>
    </aside>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-[12px] font-semibold text-ink">{label}</label>
        {hint ? (
          <span className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
