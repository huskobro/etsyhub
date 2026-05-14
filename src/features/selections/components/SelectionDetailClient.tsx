"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Image as ImageIconLucide,
  MoreHorizontal,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import {
  canApplyMockups,
  deriveStage,
  stageBadgeTone,
} from "@/features/selections/state-helpers";
import { DesignsTab, type DesignsTabItem } from "./tabs/DesignsTab";
import { EditsTab } from "./tabs/EditsTab";
import { MockupsTab } from "./tabs/MockupsTab";
import { HistoryTab, type HistoryEvent } from "./tabs/HistoryTab";

/**
 * SelectionDetailClient — B3 Selection detail orchestrator.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b2-b3.jsx →
 * B3SelectionDetail.
 *
 * 4 tabs: Designs · Edits · Mockups (read-only) · History.
 * Header: back arrow → /selections, title + status badge + Duplicate
 * (placeholder), kebab (R5+), Apply Mockups primary CTA (gated on stage).
 */

export interface SelectionDetailItem {
  id: string;
  position: number;
  sourceAssetId: string;
  editedAssetId: string | null;
  status: "pending" | "selected" | "rejected";
  aspectRatio: string | null;
  productTypeKey: string | null;
  /** IA Phase 7 — heavy edit lock. Non-null while a BullMQ heavy job
   *  (background-remove / magic-eraser) is in flight on this item. The
   *  EditsTab uses this to drive its row-level processing UI. */
  activeHeavyJobId: string | null;
}

export interface SelectionDetailSet {
  id: string;
  name: string;
  status: "draft" | "ready" | "archived";
  itemCount: number;
  editedItemCount: number;
  finalizedAt: string | null;
  lastExportedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Batch-first Phase 1 — source lineage. JSON blob from SelectionSet.sourceMetadata. */
  sourceMetadata?: unknown;
}

interface Props {
  set: SelectionDetailSet;
  items: SelectionDetailItem[];
}

type TabId = "designs" | "edits" | "mockups" | "history";

const TAB_IDS: ReadonlySet<TabId> = new Set([
  "designs",
  "edits",
  "mockups",
  "history",
]);

function parseTab(raw: string | null): TabId {
  return raw && TAB_IDS.has(raw as TabId) ? (raw as TabId) : "designs";
}

export function SelectionDetailClient({ set, items }: Props) {
  // IA Phase 4 — canonical edit entry uses URL state (?tab=edits) instead
  // of useState. Bookmarkable, deep-linkable, parity with the /review
  // canonical model (?source / ?item / ?decision). Default tab is
  // "designs" when the param is absent or invalid.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const setTab = useCallback(
    (next: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "designs") {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const stage = deriveStage({
    status: set.status,
    finalizedAt: set.finalizedAt,
    lastExportedAt: set.lastExportedAt,
    editedItemCount: set.editedItemCount,
  });

  const editsCount = set.editedItemCount;

  /* Phase 51 — Item-level status counts. Operatör Apply Mockups
   * disabled olduğunda "kaç item gerçekten finalize'a hazır?" sorusunun
   * cevabını alır + Finalize CTA gate clarity'si bu sayım üzerinden. */
  const selectedCount = items.filter((i) => i.status === "selected").length;
  const pendingCount = items.filter((i) => i.status === "pending").length;

  /* Phase 51 — Finalize mutation. POST /api/selection/sets/[setId]/finalize
   * (Phase 7 Task 22 endpoint) → status="ready" + finalizedAt.
   * Phase 52 — onSuccess artık sessionStorage one-shot key yazar
   * (kivasy.finalizeOutcome.{setId}) + router.refresh. Detail page mount
   * banner'ı okur + siler, operatöre "finalize başarılı · şimdi Apply
   * Mockups" handoff'unu net görsel olarak gösterir. */
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/selection/sets/${set.id}/finalize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Finalize failed");
      }
      return res.json();
    },
    onSuccess: () => {
      try {
        window.sessionStorage.setItem(
          `kivasy.finalizeOutcome.${set.id}`,
          JSON.stringify({
            ts: Date.now(),
            selectedCount,
            setName: set.name,
          }),
        );
      } catch {
        /* sessionStorage disabled — banner görünmez, akış bozulmaz */
      }
      router.refresh();
    },
  });

  /* Phase 52 — Finalize success banner state.
   *
   * `finalizeMutation` redirect değil refresh yapıyor (set yerinde
   * kalır, stage "Mockup ready"ye geçer). Operatöre "tamam, finalize
   * tamam, şimdi Apply Mockups'a in" handoff sinyali bu banner ile
   * verilir. sessionStorage one-shot pattern (Phase 49 LaunchOutcomeBanner
   * ile aile parity): mount'ta okunur + silinir, refresh sonrası
   * görünmez.
   */
  const [finalizeBanner, setFinalizeBanner] = useState<{
    setName: string;
    selectedCount: number;
  } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => {
    try {
      const key = `kivasy.finalizeOutcome.${set.id}`;
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        ts: number;
        setName: string;
        selectedCount: number;
      };
      window.sessionStorage.removeItem(key);
      // Stale > 5min ignore (operator bookmark'tan tekrar açabilir).
      if (Date.now() - parsed.ts < 5 * 60 * 1000) {
        setFinalizeBanner({
          setName: parsed.setName,
          selectedCount: parsed.selectedCount,
        });
      }
    } catch {
      /* sessionStorage disabled — silent */
    }
  }, [set.id]);
  /* finalizeReady: set draft durumunda (stage Curating veya Edits) +
   * en az 1 selected. Edits stage'i de geçerli — operatör edit yapmış
   * ama henüz finalize etmemiş olabilir. Mockup ready / Sent / Archived
   * durumunda zaten finalize'a gerek yok. */
  const finalizeReady =
    (stage === "Curating" || stage === "Edits") && selectedCount > 0;

  const designs: DesignsTabItem[] = items.map((it) => ({
    id: it.id,
    sourceAssetId: it.sourceAssetId,
    editedAssetId: it.editedAssetId,
    aspectRatio: it.aspectRatio,
    productTypeKey: it.productTypeKey,
    // Phase 51 — surface item-level decision state to DesignsTab so it
    // can render status badges + status-aware curation actions.
    status: it.status,
  }));

  // EditsTab needs the heavy lock state on top of the Designs view; we
  // build a parallel array so DesignsTab keeps its narrow row shape and
  // EditsTab gets the activeHeavyJobId field it needs.
  const editsItems = items.map((it) => ({
    id: it.id,
    sourceAssetId: it.sourceAssetId,
    editedAssetId: it.editedAssetId,
    aspectRatio: it.aspectRatio,
    productTypeKey: it.productTypeKey,
    activeHeavyJobId: it.activeHeavyJobId,
  }));

  const tabs: TabItem[] = [
    { id: "designs", label: "Designs", count: items.length },
    { id: "edits", label: "Edits", count: editsCount },
    // Mockups tab — read-only preview. Sayım R4'te static (mockup mgmt
    // Products'ta). R5'te Product detail'a join eklenince gerçek count
    // bağlanır.
    { id: "mockups", label: "Mockups" },
    { id: "history", label: "History" },
  ];

  const applyEnabled = canApplyMockups(stage);

  // History — R4 placeholder timeline (status snapshot'tan üretilir).
  // R5+'da Audit log entegrasyonu eklenecek.
  const history: HistoryEvent[] = buildPlaceholderHistory(set);

  return (
    <div
      className="-m-6 flex h-screen flex-col"
      data-testid="selection-detail-page"
    >
      {/* R11.14.7 — Detail header h1 17→24px parity (matches AppTopbar
       * canon used across index pages). Inline because detail header has
       * back-arrow + title + status badge + sub-copy combined; AppTopbar
       * subtitle slot is single-line so we keep this bespoke header but
       * align typography. */}
      <header className="flex h-16 flex-shrink-0 items-center gap-4 border-b border-line bg-bg pl-6 pr-5">
        <Link
          href="/selections"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-2 hover:border-line-strong hover:text-ink"
          aria-label="Back to selections"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <h1 className="truncate k-display text-[24px] font-semibold leading-none tracking-tight text-ink">
              {set.name}
            </h1>
            <Badge tone={stageBadgeTone(stage)} dot>
              {stage}
            </Badge>
            <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              SEL · {set.id.slice(0, 8)}
            </span>
            {/* Batch-first Phase 1 — batch lineage link. */}
            <SelectionBatchLineage sourceMetadata={set.sourceMetadata} />
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-50"
          disabled
          title="Duplicate this set as a new draft — coming soon."
        >
          <Copy className="h-3 w-3" aria-hidden />
          Duplicate
        </button>
        {/* R11.14.12 — More actions kebab visibility upgrade.
         * Önceden: 32×32 icon-only kebab → kullanıcı feedback'i
         * "ne işe yaradığı belli değil". Şimdi inline-label "More"
         * yanına icon (Duplicate ile aynı yükseklik + şekil), aria-label
         * korundu. Disabled state ve actionable tooltip aynı kalır. */}
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-50"
          aria-label="More actions"
          disabled
          title="More actions (rename, archive, export) — coming soon"
        >
          <MoreHorizontal className="h-3 w-3" aria-hidden />
          More
        </button>
        {/* Phase 51 — Mockup handoff stage gate.
         *
         * Önceden tek "Apply Mockups" button vardı, disabled durumunda
         * operatöre "Stage: Curating → finalize to enable" teknik hint'i
         * gösteriyordu — finalize aksiyonu görünür değildi (operatör
         * "nereden finalize edeceğim?" sorusuyla kalıyordu).
         *
         * Phase 51 stage-aware iki CTA:
         *   - stage = Mockup ready / Sent uygunsa → "Apply Mockups" primary
         *   - stage = Curating + selectedCount > 0 → "Finalize selection · N
         *     selected" primary (Phase 7 finalize endpoint'i wire'lı,
         *     POST /api/selection/sets/[setId]/finalize). Apply Mockups
         *     ghost button olarak görünür kalır + gerekçe.
         *   - selectedCount === 0 → finalize disabled + hint
         *     "Promote selected items first via the Designs tab"
         *
         * stage = Sent → "Already sent · view in Product" mevcut davranış
         * korunur. */}
        {applyEnabled ? (
          /* Phase 78 — Mockup Studio canonical entry.
           *
           * Final ürün kararı: Mockup Studio
           * (`/selection/sets/[id]/mockup/studio`) Kivasy'nin nihai
           * mockup çalışma yüzeyidir. Selection detail "Apply Mockups"
           * primary CTA artık doğrudan Studio'ya yönlendirir; Apply
           * orchestrator route'u Studio'ya çıkış sağlayan banner ile
           * canonical fallback olarak yaşar (Phase 8 baseline render
           * pipeline + S7/S8 result view'a Apply'dan da erişilebilir). */
          <Link
            href={`/selection/sets/${set.id}/mockup/studio`}
            data-size="sm"
            className="k-btn k-btn--primary"
            data-testid="selection-detail-apply-mockups"
          >
            <ImageIconLucide className="h-3 w-3" aria-hidden />
            Open in Studio
          </Link>
        ) : stage === "Sent" ? (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              data-size="sm"
              className="k-btn k-btn--primary cursor-not-allowed"
              disabled
              title="Set already sent — view in Product"
              data-testid="selection-detail-apply-mockups"
              data-apply-enabled="false"
            >
              <ImageIconLucide className="h-3 w-3" aria-hidden />
              Apply Mockups
            </button>
            <span
              className="font-mono text-xs uppercase tracking-meta text-ink-3"
              data-testid="selection-detail-apply-hint"
            >
              Already sent · view in Product
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              data-size="sm"
              className={
                finalizeReady
                  ? "k-btn k-btn--primary"
                  : "k-btn k-btn--primary cursor-not-allowed"
              }
              disabled={!finalizeReady || finalizeMutation.isPending}
              onClick={() => {
                if (finalizeReady) finalizeMutation.mutate();
              }}
              title={
                finalizeReady
                  ? `Finalize this set with ${selectedCount} selected item${
                      selectedCount === 1 ? "" : "s"
                    } — stage moves to Mockup ready.`
                  : "Promote at least one design to Selected via the Designs tab to finalize."
              }
              data-testid="selection-detail-finalize"
              data-finalize-ready={finalizeReady || undefined}
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              {finalizeMutation.isPending
                ? "Finalizing…"
                : selectedCount > 0
                  ? `Finalize selection · ${selectedCount}`
                  : "Finalize selection"}
            </button>
            <span
              className="font-mono text-xs uppercase tracking-meta text-ink-3"
              data-testid="selection-detail-apply-hint"
            >
              {finalizeReady ? (
                <>Next · Apply Mockups after finalize</>
              ) : pendingCount > 0 ? (
                <>{pendingCount} pending · promote in Designs tab</>
              ) : (
                <>Promote items via Designs tab to enable</>
              )}
            </span>
            {finalizeMutation.isError ? (
              <span
                className="font-mono text-[10.5px] text-danger"
                data-testid="selection-detail-finalize-error"
                role="alert"
              >
                {(finalizeMutation.error as Error).message}
              </span>
            ) : null}
          </div>
        )}
      </header>

      {/* Phase 52 — Finalize success banner.
       *
       * Operatör Finalize CTA'sına bastıktan sonra router.refresh ile
       * detail page yeniden render olur — stage badge "Edits"→"Mockup
       * ready"ye geçer, header Apply Mockups primary'ye çevrilir. Ama
       * bu transition silent: operatör "finalize başarılı mı, şimdi ne
       * yapacağım?" sorusuna görsel cevap almıyordu. Phase 52 banner:
       *   - success tone (k-orange-soft + check icon)
       *   - copy "N items finalized · Set is ready for mockups"
       *   - primary CTA "Apply Mockups" → mockup studio
       *   - dismiss (×) button
       * sessionStorage one-shot (Phase 49 LaunchOutcomeBanner pattern):
       * refresh sonrası banner kalmaz; mount okur + siler. */}
      {finalizeBanner && !bannerDismissed ? (
        <div
          className="flex items-start gap-3 border-b border-success/40 bg-success-soft/50 px-6 py-3 text-[12.5px] text-ink"
          data-testid="selection-finalize-banner"
          role="status"
        >
          <CheckCircle2
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-success"
            aria-hidden
          />
          <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="font-medium leading-tight text-ink">
              {finalizeBanner.selectedCount === 1
                ? "1 item finalized"
                : `${finalizeBanner.selectedCount} items finalized`}
              <span className="ml-1 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                set ready for mockups
              </span>
            </div>
            {/* Phase 78 — finalize success banner Studio'ya yönlenir
                (Phase 52 baseline'da Apply'a gidiyordu; final ürün
                kararıyla Studio canonical entry). */}
            <Link
              href={`/selection/sets/${set.id}/mockup/studio`}
              data-size="sm"
              className="k-btn k-btn--primary"
              data-testid="selection-finalize-banner-apply"
            >
              <ImageIconLucide className="h-3 w-3" aria-hidden />
              Open in Studio
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-paper hover:text-ink"
            aria-label="Dismiss finalize banner"
            data-testid="selection-finalize-banner-dismiss"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-line bg-bg px-6">
        <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as TabId)} />
      </div>

      {/* Tab content */}
      {tab === "designs" ? (
        <DesignsTab
          setId={set.id}
          items={designs}
          /* Phase 51 — finalize sonrası set kararı dondurulur (status
           * archived / ready). Operatör kart-level görünümü kaybetmez,
           * yalnız bulk-bar curation aksiyonları disabled. */
          readOnly={set.status !== "draft"}
        />
      ) : null}
      {tab === "edits" ? (
        <EditsTab setId={set.id} items={editsItems} setStatus={set.status} />
      ) : null}
      {tab === "mockups" ? <MockupsTab setId={set.id} stage={stage} /> : null}
      {tab === "history" ? <HistoryTab events={history} /> : null}
    </div>
  );
}

function buildPlaceholderHistory(set: SelectionDetailSet): HistoryEvent[] {
  const events: HistoryEvent[] = [];

  events.push({
    timestamp: set.createdAt,
    label: "Selection created",
    meta: `${set.itemCount} initial items`,
  });

  if (set.editedItemCount > 0) {
    events.push({
      timestamp: set.updatedAt,
      label: "Edits applied",
      meta: `${set.editedItemCount} item(s) edited`,
    });
  }

  if (set.finalizedAt) {
    events.push({
      timestamp: set.finalizedAt,
      label: "Stage changed to Mockup ready",
      meta: "finalized for mockup",
    });
  }

  if (set.lastExportedAt) {
    events.push({
      timestamp: set.lastExportedAt,
      label: "Set exported",
      meta: "ZIP / draft package generated",
    });
  }

  // En yeni → en eski.
  return events.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/**
 * Batch-first Phase 1 — selection header'ında batch lineage linki.
 *
 * sourceMetadata iki kaynak taşıyabilir:
 *   1. mjOrigin (MJ kept handoff): mjOrigin.batchIds[0] → /batches/{batchId}
 *   2. variation-batch (quickStart): batchId doğrudan (variation batch)
 *
 * Schema-zero: JSON okuma, tablo değişikliği yok.
 */
function SelectionBatchLineage({
  sourceMetadata,
}: {
  sourceMetadata?: unknown;
}) {
  if (!sourceMetadata || typeof sourceMetadata !== "object") return null;
  const meta = sourceMetadata as Record<string, unknown>;

  // MJ kept handoff: mjOrigin.batchIds[]
  const mjOrigin = meta["mjOrigin"];
  if (mjOrigin && typeof mjOrigin === "object") {
    const o = mjOrigin as Record<string, unknown>;
    if (o["kindFamily"] === "midjourney_kept") {
      const batchIds = Array.isArray(o["batchIds"])
        ? (o["batchIds"] as unknown[]).filter(
            (x): x is string => typeof x === "string",
          )
        : [];
      if (batchIds.length > 0) {
        const primaryBatchId = batchIds[0]!;
        return (
          <Link
            href={`/batches/${primaryBatchId}`}
            className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-meta text-info underline-offset-2 hover:underline"
            title={`Source batch: ${primaryBatchId}`}
            data-testid="selection-batch-lineage"
          >
            ↗ BATCH {primaryBatchId.slice(0, 8).toUpperCase()}
          </Link>
        );
      }
    }
  }

  // variation-batch (quickStart): kind = "variation-batch" + batchId
  const kind = meta["kind"];
  const batchId = meta["batchId"];
  if (kind === "variation-batch" && typeof batchId === "string") {
    return (
      <span
        className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-meta text-ink-3"
        title={`Source batch: ${batchId}`}
        data-testid="selection-batch-lineage"
      >
        ↗ BATCH {batchId.slice(0, 8).toUpperCase()}
      </span>
    );
  }

  return null;
}
