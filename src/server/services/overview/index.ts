// R11.14 — Overview C3 server-side data aggregation.
//
// Source: docs/design-system/kivasy/ui_kits/kivasy/v6/screens-c3.jsx
// → C3Overview (4 block: Pipeline pulse · Pending actions · Active batches ·
// Recent activity).
//
// Disipline:
//   - Lightweight count query'leri (DB index dostu); cross-table aggregation
//     paralel Promise.all
//   - User-scoped: tüm sayımlar userId filter ile
//   - Empty state honest: data yoksa 0 / [] döner; UI placeholder copy gösterir
//   - Re-uses existing services: listRecentBatches, listInbox

import { db } from "@/server/db";
import { ListingStatus, MidjourneyJobState, SelectionSetStatus } from "@prisma/client";
import { listRecentBatches } from "@/server/services/midjourney/batches";
import { listInbox } from "@/server/services/settings/notifications-inbox.service";

const RUNNING_BATCH_STATES: MidjourneyJobState[] = [
  MidjourneyJobState.OPENING_BROWSER,
  MidjourneyJobState.SUBMITTING_PROMPT,
  MidjourneyJobState.WAITING_FOR_RENDER,
  MidjourneyJobState.COLLECTING_OUTPUTS,
  MidjourneyJobState.DOWNLOADING,
  MidjourneyJobState.IMPORTING,
];

// ── Pipeline Pulse — 6 stages

export interface PipelineStageCount {
  total: number;
  /** Operatöre alt-not olarak gösterilecek context */
  sub: string;
}

export interface PipelinePulseData {
  references: PipelineStageCount;
  batches: PipelineStageCount & { running: number };
  library: PipelineStageCount;
  selections: PipelineStageCount;
  products: PipelineStageCount;
  etsyDrafts: PipelineStageCount;
}

export async function getPipelinePulse(userId: string): Promise<PipelinePulseData> {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const [
    referencesTotal,
    referencesRecent,
    batchRunningJobs,
    batchesLast7d,
    libraryAssets,
    libraryKeptRecent,
    selectionsActive,
    selectionsMockupReady,
    productsActive,
    etsyDraftsRecent,
  ] = await Promise.all([
    // References: aktif (not soft-deleted) Reference row'ları
    db.reference.count({ where: { userId, deletedAt: null } }),
    db.reference.count({
      where: { userId, deletedAt: null, createdAt: { gte: sevenDaysAgo } },
    }),
    // Batches: şu an RUNNING state'inde olan MJ job'lar
    db.midjourneyJob.count({
      where: { userId, state: { in: RUNNING_BATCH_STATES } },
    }),
    listRecentBatches(userId, 200).then(
      (all) => all.filter((b) => b.createdAt >= sevenDaysAgo).length,
    ),
    // Library: tüm MidjourneyAsset (variation outputs) — userId üzerinden
    // filter MidjourneyJob relation'ıyla (Asset doğrudan userId tutmuyor).
    db.midjourneyAsset.count({
      where: { midjourneyJob: { userId } },
    }),
    db.midjourneyAsset.count({
      where: {
        midjourneyJob: { userId },
        variantKind: "VARIATION",
        importedAt: { gte: sevenDaysAgo },
      },
    }),
    // Selections: archive olmayan tüm set'ler
    db.selectionSet.count({ where: { userId, archivedAt: null } }),
    db.selectionSet.count({
      where: { userId, archivedAt: null, status: SelectionSetStatus.ready },
    }),
    // Products / Listings (DRAFT)
    db.listing.count({
      where: { userId, status: ListingStatus.DRAFT },
    }),
    // Etsy drafts: PUBLISHED + SCHEDULED (Etsy'de yayın aşamasında olanlar)
    db.listing.count({
      where: {
        userId,
        status: { in: [ListingStatus.PUBLISHED, ListingStatus.SCHEDULED] },
      },
    }),
  ]);

  return {
    references: {
      total: referencesTotal,
      sub:
        referencesRecent > 0
          ? `${referencesRecent} new · this week`
          : "no new references this week",
    },
    batches: {
      total: batchesLast7d,
      running: batchRunningJobs,
      sub:
        batchRunningJobs > 0
          ? `${batchRunningJobs} running · ${batchesLast7d} last 7d`
          : `${batchesLast7d} last 7d`,
    },
    library: {
      total: libraryAssets,
      sub:
        libraryKeptRecent > 0
          ? `${libraryKeptRecent} kept · this week`
          : `${libraryAssets} total`,
    },
    selections: {
      total: selectionsActive,
      sub:
        selectionsMockupReady > 0
          ? `${selectionsMockupReady} mockup-ready`
          : `${selectionsActive} active`,
    },
    products: {
      total: productsActive,
      sub:
        productsActive > 0
          ? `${productsActive} draft / ready`
          : "no products yet",
    },
    etsyDrafts: {
      total: etsyDraftsRecent,
      sub:
        etsyDraftsRecent > 0
          ? `${etsyDraftsRecent} sent`
          : "no drafts sent yet",
    },
  };
}

// ── Pending actions

export interface PendingActionRow {
  id: string;
  name: string;
  meta: string;
  href: string;
}

export interface PendingSection {
  title: string;
  total: number;
  rows: PendingActionRow[];
}

export interface PendingActionsData {
  needsReview: PendingSection;
  mockupReady: PendingSection;
  draftsToSend: PendingSection;
  failedBatches: PendingSection;
}

export async function getPendingActions(userId: string): Promise<PendingActionsData> {
  // Batches with FAILED jobs in last 24h
  const [pendingReviewBatches, mockupReadySets, draftsToSend, failedBatches] =
    await Promise.all([
      // Needs review: completed batches with items not yet reviewed
      // (varolan reviewedAt: null veya kept count < total — basit case: 7d
      // içindeki recent batches)
      listRecentBatches(userId, 5).then((all) =>
        all.filter(
          (b) =>
            b.counts.completed > 0 &&
            b.counts.failed === 0 &&
            b.counts.queued === 0 &&
            b.counts.running === 0,
        ),
      ),
      db.selectionSet.findMany({
        where: { userId, archivedAt: null, status: SelectionSetStatus.ready },
        select: { id: true, name: true, _count: { select: { items: true } } },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
      db.listing.findMany({
        where: { userId, status: ListingStatus.DRAFT },
        select: {
          id: true,
          title: true,
          status: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 3,
      }),
      // Last 24h failed batches
      listRecentBatches(userId, 30).then((all) =>
        all.filter((b) => b.counts.failed > 0).slice(0, 4),
      ),
    ]);

  return {
    needsReview: {
      title: "Needs review",
      total: pendingReviewBatches.length,
      rows: pendingReviewBatches.slice(0, 4).map((b) => ({
        id: b.batchId,
        name: `Batch ${b.batchId.slice(0, 8)}`,
        meta: `${b.counts.completed} of ${b.counts.total} completed`,
        href: `/batches/${b.batchId}/review`,
      })),
    },
    mockupReady: {
      title: "Mockup ready",
      total: mockupReadySets.length,
      rows: mockupReadySets.slice(0, 4).map((s) => ({
        id: s.id,
        name: s.name,
        meta: `${s._count.items} designs`,
        // Phase 58 — Direct handoff: Overview "Apply Mockups" CTA artık
        // doğrudan mockup studio'ya iniyor (Selection detail ara
        // durakta değil). Operatör Overview'dan tek tıkla mockup'ları
        // uygular; label ↔ destination tutarlı.
        href: `/selection/sets/${s.id}/mockup/apply`,
      })),
    },
    draftsToSend: {
      title: "Drafts to send",
      total: draftsToSend.length,
      rows: draftsToSend.slice(0, 3).map((l) => ({
        id: l.id,
        name: l.title || "(untitled draft)",
        meta: `Status · ${l.status}`,
        href: `/products/${l.id}`,
      })),
    },
    failedBatches: {
      title: "Failed batches",
      total: failedBatches.length,
      rows: failedBatches.slice(0, 4).map((b) => ({
        id: b.batchId,
        name: `Batch ${b.batchId.slice(0, 8)}`,
        meta: `${b.counts.failed} failed of ${b.counts.total}`,
        href: `/batches/${b.batchId}`,
      })),
    },
  };
}

// ── Active batches

export interface ActiveBatchRow {
  batchId: string;
  name: string;
  done: number;
  total: number;
  eta: string;
  href: string;
}

export async function getActiveBatches(userId: string): Promise<ActiveBatchRow[]> {
  const recent = await listRecentBatches(userId, 30);
  return recent
    .filter((b) => b.counts.running > 0 || b.counts.queued > 0 || b.counts.awaiting > 0)
    .slice(0, 5)
    .map((b) => ({
      batchId: b.batchId,
      name: b.promptTemplatePreview
        ? b.promptTemplatePreview.slice(0, 48)
        : `Batch ${b.batchId.slice(0, 8)}`,
      done: b.counts.completed,
      total: b.counts.total,
      eta:
        b.counts.running > 0
          ? "running"
          : b.counts.queued > 0
            ? "queued"
            : "awaiting",
      href: `/batches/${b.batchId}`,
    }));
}

// ── Recent activity (cross-surface log)

export interface RecentActivityRow {
  timestamp: Date;
  event: string;
  meta: string;
  tone: "success" | "warning" | "info" | "purple" | "neutral";
  href: string;
}

export async function getRecentActivity(userId: string, limit = 8): Promise<RecentActivityRow[]> {
  // Notifications inbox bizim cross-surface feed'imiz
  const inbox = await listInbox(userId);
  return inbox.slice(0, limit).map((n) => {
    const tone: RecentActivityRow["tone"] =
      n.kind === "batchCompleted"
        ? "success"
        : n.kind === "batchFailed"
          ? "warning"
          : n.kind === "listingSubmitted"
            ? "info"
            : n.kind === "mockupActivated" || n.kind === "magicEraser"
              ? "purple"
              : "neutral";
    return {
      timestamp: new Date(n.createdAt),
      event: n.title,
      meta: n.body ?? "",
      tone,
      href: n.href ?? "/settings?pane=notifications",
    };
  });
}
