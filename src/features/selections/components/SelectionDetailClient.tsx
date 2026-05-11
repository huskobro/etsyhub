"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  ArrowLeft,
  Copy,
  Image as ImageIconLucide,
  MoreHorizontal,
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

  const designs: DesignsTabItem[] = items.map((it) => ({
    id: it.id,
    sourceAssetId: it.sourceAssetId,
    editedAssetId: it.editedAssetId,
    aspectRatio: it.aspectRatio,
    productTypeKey: it.productTypeKey,
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
        {applyEnabled ? (
          <Link
            href={`/selection/sets/${set.id}/mockup/apply`}
            data-size="sm"
            className="k-btn k-btn--primary"
            data-testid="selection-detail-apply-mockups"
          >
            <ImageIconLucide className="h-3 w-3" aria-hidden />
            Apply Mockups
          </Link>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              data-size="sm"
              className="k-btn k-btn--primary cursor-not-allowed"
              disabled
              title={
                stage === "Sent"
                  ? "Set already sent — view in Product"
                  : "Finalize the selection (Mockup ready) before applying mockups"
              }
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
              {stage === "Sent"
                ? "Already sent · view in Product"
                : `Stage: ${stage} → finalize to enable`}
            </span>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-line bg-bg px-6">
        <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as TabId)} />
      </div>

      {/* Tab content */}
      {tab === "designs" ? (
        <DesignsTab setId={set.id} items={designs} />
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
 * Batch-first Phase 1 — Selection header'ında batch lineage linki.
 *
 * sourceMetadata iki kaynak taşıyabilir:
 *   1. mjOrigin (MJ kept handoff): mjOrigin.batchIds[0] → /batches/{batchId}
 *   2. variation-batch (quickStart): batchId doğrudan → /batches (genel)
 *      Not: variation-batch batchId'si Job.id — MJ batch sayfasına değil,
 *      ileride variation batch detail sayfasına yönlendirilecek.
 *
 * Schema-zero: JSON okuma, tablo değişikliği yok.
 */
function SelectionBatchLineage({ sourceMetadata }: { sourceMetadata?: unknown }) {
  if (!sourceMetadata || typeof sourceMetadata !== "object") return null;
  const meta = sourceMetadata as Record<string, unknown>;

  // MJ kept handoff: mjOrigin.batchIds[]
  const mjOrigin = meta["mjOrigin"];
  if (mjOrigin && typeof mjOrigin === "object") {
    const o = mjOrigin as Record<string, unknown>;
    if (o["kindFamily"] === "midjourney_kept") {
      const batchIds = Array.isArray(o["batchIds"])
        ? (o["batchIds"] as unknown[]).filter((x): x is string => typeof x === "string")
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
