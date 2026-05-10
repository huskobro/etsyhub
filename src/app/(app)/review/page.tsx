// `/review` — canonical decision workspace.
//
// History
// ───────
// Phase 6 introduced `/review` as a tab-based grid over GeneratedDesign +
// LocalLibraryAsset (state: ReviewStatus). Rollout-3 added a separate
// `/batches/[id]/review` page hosting the keyboard-first dark workspace
// over MidjourneyAsset (state: MJReviewDecision). Two surfaces, two state
// machines, two write endpoints — operators saw two products.
//
// IA Phase 2 collapsed both onto `/review`:
//   • `/review`                       → tab grid (AI Designs / Local Library)
//   • `/review?batch=<cuid>`          → batch-scoped dark workspace
//                                       (keyboard K/D/U, MJReviewDecision)
//   • `/review?source=ai|local|midjourney` → alias for ?tab=
//   • `/review?item=<cuid>`           → drawer detail (alias for ?detail=)
//   • `/batches/[id]/review`          → redirects to `/review?batch=<id>`
//
// IA Phase 8 extended the dispatch — `?item=<midjourneyAssetId>` resolves
// to the parent batch and redirects to `?batch=&item=` so the cursor
// pre-positions on that asset.
//
// IA Phase 9 (review experience final unification) replaces the legacy
// drawer on the canonical user path. AI Generated and Local Library
// items now open the new `QueueReviewWorkspace` — the same dark
// fullscreen language as the batch workspace, with a source-aware
// info-rail (file path / DPI / transparency capability for Local;
// product type / reference for AI) and cross-page next/prev so the
// last item on page N + → jumps to the first item on page N+1
// (no wrap-around). The drawer file is kept in the codebase as a
// rollback fallback but page.tsx no longer imports it.
//
// Two render paths in this file (workspace vs grid) intentionally keep
// their own write endpoints for now — MJ items still use
// /api/midjourney/.../review, AI/Local items still use
// /api/review/decisions. The unified-review service-layer
// (`src/server/services/review/unified.ts`) is the seed for collapsing
// those, but UI consumes legacy paths until the adapter is end-to-end
// production-tested.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { ReviewQueueList } from "@/app/(app)/review/_components/ReviewQueueList";
import { BatchReviewWorkspace } from "@/features/batches/components/BatchReviewWorkspace";
import { QueueReviewWorkspace } from "@/features/review/components/QueueReviewWorkspace";
import {
  getBatchReviewSummary,
  getMidjourneyAssetBatchId,
  listBatchReviewItems,
} from "@/server/services/midjourney/review";
import {
  getAdjacentPendingFolders,
  getAdjacentPendingReferences,
  getNextPendingBatchId,
  getNextPendingFolderName,
  getTotalReviewPendingCount,
  listPendingScopes,
} from "@/server/services/review/next-scope";
import { db } from "@/server/db";

export const metadata = { title: "Review · Kivasy" };
export const dynamic = "force-dynamic";

type SearchParams = {
  // Legacy params
  tab?: string;
  detail?: string;
  page?: string;
  // IA Phase 2 canonical params
  batch?: string;
  source?: string;
  item?: string;
  decision?: string;
};

function parseDecisionParam(
  raw: string | undefined,
): "undecided" | "kept" | "rejected" | undefined {
  const v = (raw ?? "").toLowerCase();
  if (v === "undecided" || v === "kept" || v === "rejected") return v;
  return undefined;
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const itemId = (searchParams.item ?? searchParams.detail ?? "").trim();
  const batchId = (searchParams.batch ?? "").trim();

  // Single-item focus shortcut — `?item=<id>` without a batch context.
  // If the id resolves to a MidjourneyAsset we redirect into the batch
  // workspace with the cursor pre-positioned on that item; otherwise
  // we fall through to the queue focus workspace below (the canonical
  // path for AI Generated and Local Library items).
  if (itemId && !batchId) {
    const session = await auth();
    if (!session?.user) redirect("/login");
    const resolvedBatchId = await getMidjourneyAssetBatchId(
      itemId,
      session.user.id,
    );
    if (resolvedBatchId) {
      redirect(
        `/review?batch=${encodeURIComponent(resolvedBatchId)}&item=${encodeURIComponent(itemId)}`,
      );
    }
  }

  // Workspace mode (Midjourney) — ?batch=<cuid>. Server-loads
  // MidjourneyAsset items and hands them to BatchReviewWorkspace. Exit
  // and back-link send the operator to plain `/review` so the unified
  // surface never feels like a deep nested route.
  if (batchId) {
    const session = await auth();
    if (!session?.user) redirect("/login");
    const userId = session.user.id;

    // IA Phase 12+20 — server-side resolves for the workspace anchor,
    // scope-completion auto-progress, and the batch scope picker.
    const [
      summary,
      page,
      totalReviewPending,
      nextBatch,
      pendingBatchList,
    ] = await Promise.all([
      getBatchReviewSummary(batchId, userId),
      listBatchReviewItems(batchId, userId, {
        decisions: ["UNDECIDED", "KEPT", "REJECTED"],
        limit: 200,
      }),
      getTotalReviewPendingCount(userId),
      getNextPendingBatchId({ userId, currentBatchId: batchId }),
      listPendingScopes({ userId, kind: "batch" }),
    ]);

    if (!summary) notFound();

    let initialCursor = 0;
    if (itemId) {
      const idx = page.items.findIndex(
        (it) => it.midjourneyAssetId === itemId,
      );
      if (idx >= 0) initialCursor = idx;
    }
    if (!itemId || initialCursor === 0) {
      const firstUndecided = page.items.findIndex(
        (it) => it.decision === "UNDECIDED",
      );
      if (firstUndecided >= 0 && !itemId) initialCursor = firstUndecided;
    }

    const nextScope = nextBatch
      ? {
          href: `/review?batch=${encodeURIComponent(nextBatch.batchId)}`,
          label: `batch ${nextBatch.batchId.slice(0, 8)}`,
          kind: "batch" as const,
        }
      : null;

    // IA Phase 20 — batch scope navigation. Picker entries +
    // adjacent prev/next from the alphabetically-stable pending
    // list. listPendingScopes already orders the result; we walk
    // from the active batch index for prev/next.
    const batchIdx = pendingBatchList.findIndex((b) => b.id === batchId);
    const prevBatch =
      batchIdx > 0 ? pendingBatchList[batchIdx - 1] ?? null : null;
    const nextBatchAdj =
      batchIdx >= 0 && batchIdx < pendingBatchList.length - 1
        ? pendingBatchList[batchIdx + 1] ?? null
        : null;
    const batchScopeNav = {
      prev: prevBatch
        ? {
            href: `/review?batch=${encodeURIComponent(prevBatch.id)}`,
            label: prevBatch.label,
          }
        : null,
      next: nextBatchAdj
        ? {
            href: `/review?batch=${encodeURIComponent(nextBatchAdj.id)}`,
            label: nextBatchAdj.label,
          }
        : null,
    };
    const batchPicker = {
      kind: "batch" as const,
      activeId: batchId,
      entries: pendingBatchList.map((b) => ({
        id: b.id,
        label: b.label,
        pendingCount: b.pendingCount,
        href: `/review?batch=${encodeURIComponent(b.id)}`,
      })),
    };

    return (
      <BatchReviewWorkspace
        batchId={batchId}
        summary={summary}
        items={page.items}
        initialCursor={initialCursor}
        exitHref="/review"
        exitLabel="Review"
        totalReviewPending={totalReviewPending}
        nextScope={nextScope}
        scopeNav={batchScopeNav}
        scopePicker={batchPicker}
      />
    );
  }

  // Grid mode — tab-based queue over GeneratedDesign + LocalLibraryAsset.
  //
  // ?source= is the canonical alias going forward; ?tab= remains a
  // fallback so existing links (and the ReviewTabs client component,
  // which still writes ?tab=) keep working. ?item= here means the
  // operator wants to focus a specific AI/Local item — we render the
  // canonical QueueReviewWorkspace instead of the queue grid.
  const sourceParam = (searchParams.source ?? "").toLowerCase();
  const tabParam = (searchParams.tab ?? "").toLowerCase();
  const activeTab: "ai" | "local" =
    sourceParam === "local" || tabParam === "local" ? "local" : "ai";
  const focusScope = activeTab === "ai" ? "design" : "local";
  const decision = parseDecisionParam(searchParams.decision);
  const pageRaw = searchParams.page;
  const pageNum = pageRaw && Number(pageRaw) > 0 ? Number(pageRaw) : 1;

  // Focus mode (AI / Local) — the canonical replacement for the
  // legacy ReviewDetailPanel drawer. Same dark fullscreen language as
  // the batch workspace, source-aware info-rail.
  if (itemId) {
    const session = await auth();
    if (!session?.user) redirect("/login");
    const userId = session.user.id;

    // IA Phase 19 — Scope identity resolve (folder for local,
    // reference for design). Page reads the current item's
    // scope identity so QueueReviewWorkspace can filter the queue
    // and the shell can resolve adjacent scopes / picker entries.
    let currentFolderName: string | null = null;
    let currentReferenceId: string | null = null;
    // IA-29 — item-not-found bug fix. Item'ın gerçek decision'u +
    // sayfası URL ile uyuşmuyorsa kullanıcıyı doğru URL'e redirect et.
    // Aksi halde grid + workspace farklı queryKey'lerden çalışıyor ve
    // workspace items.findIndex(itemId) -1 dönüyor → "Item not found".
    let itemActualStatus: string | null = null;
    if (focusScope === "local") {
      const local = await db.localLibraryAsset.findFirst({
        where: { id: itemId, userId, deletedAt: null, isUserDeleted: false },
        select: { folderName: true, reviewStatus: true, reviewStatusSource: true },
      });
      currentFolderName = local?.folderName ?? null;
      itemActualStatus = local?.reviewStatus ?? null;
    } else {
      const design = await db.generatedDesign.findFirst({
        where: { id: itemId, userId, deletedAt: null },
        select: { referenceId: true, reviewStatus: true, reviewStatusSource: true },
      });
      currentReferenceId = design?.referenceId ?? null;
      itemActualStatus = design?.reviewStatus ?? null;
    }

    // Item'ın gerçek decision'u URL filter'ından farklıysa, doğru
    // decision + page=1 ile redirect. (Page'i daima 1 yapıyoruz çünkü
    // doğru decision filter'ında item büyük olasılıkla ilk sayfada;
    // workspace cross-page navigation zaten desteklenir.)
    if (itemActualStatus !== null && decision) {
      const expectedDecision =
        itemActualStatus === "APPROVED"
          ? "kept"
          : itemActualStatus === "REJECTED"
            ? "rejected"
            : "undecided";
      if (expectedDecision !== decision) {
        const sp = new URLSearchParams();
        sp.set("source", focusScope === "design" ? "ai" : "local");
        sp.set("item", itemId);
        sp.set("decision", expectedDecision);
        // page=1 — workspace cross-page nav her zaman çalışır
        redirect(`/review?${sp.toString()}`);
      }
    }

    const [
      totalReviewPending,
      nextFolder,
      adjacentFolders,
      adjacentReferences,
      pickerScopes,
    ] = await Promise.all([
      getTotalReviewPendingCount(userId),
      focusScope === "local"
        ? getNextPendingFolderName({ userId, currentFolderName })
        : Promise.resolve(null),
      focusScope === "local"
        ? getAdjacentPendingFolders({ userId, currentFolderName })
        : Promise.resolve({ prev: null, next: null }),
      focusScope === "design"
        ? getAdjacentPendingReferences({
            userId,
            currentReferenceId,
          })
        : Promise.resolve({ prev: null, next: null }),
      // IA Phase 19 — scope picker data. Top-bar dropdown.
      listPendingScopes({
        userId,
        kind: focusScope === "local" ? "folder" : "reference",
      }),
    ]);

    // IA Phase 16 — auto-next deep-link: sıradaki folder'ın ilk
    // pending item'ına doğrudan iner.
    const nextScopeFolder = nextFolder
      ? nextFolder.firstPendingItemId
        ? {
            href: `/review?source=local&item=${encodeURIComponent(
              nextFolder.firstPendingItemId,
            )}`,
            label: nextFolder.folderName,
            kind: "folder" as const,
          }
        : {
            href: `/review?source=local`,
            label: nextFolder.folderName,
            kind: "folder" as const,
          }
      : null;

    // IA Phase 19 — same auto-next behaviour for AI design's
    // reference scope. Operatör reference X'i bitirdiğinde reference Y'ye
    // sıçrar.
    const nextScopeReference = adjacentReferences.next?.firstPendingItemId
      ? {
          href: `/review?source=ai&item=${encodeURIComponent(
            adjacentReferences.next.firstPendingItemId,
          )}`,
          label: `ref-${adjacentReferences.next.referenceId.slice(-6)}`,
          kind: "queue" as const, // shell typing union; canonical "next reference"
        }
      : null;

    const nextScope =
      focusScope === "local" ? nextScopeFolder : nextScopeReference;

    // IA Phase 18+19 — scope navigation (Madde M scope ekseni)
    // for both folder (local) and reference (design).
    const scopeNav =
      focusScope === "local"
        ? {
            prev: adjacentFolders.prev?.firstPendingItemId
              ? {
                  href: `/review?source=local&item=${encodeURIComponent(
                    adjacentFolders.prev.firstPendingItemId,
                  )}`,
                  label: adjacentFolders.prev.folderName,
                }
              : null,
            next: adjacentFolders.next?.firstPendingItemId
              ? {
                  href: `/review?source=local&item=${encodeURIComponent(
                    adjacentFolders.next.firstPendingItemId,
                  )}`,
                  label: adjacentFolders.next.folderName,
                }
              : null,
          }
        : {
            prev: adjacentReferences.prev?.firstPendingItemId
              ? {
                  href: `/review?source=ai&item=${encodeURIComponent(
                    adjacentReferences.prev.firstPendingItemId,
                  )}`,
                  label: `ref-${adjacentReferences.prev.referenceId.slice(-6)}`,
                }
              : null,
            next: adjacentReferences.next?.firstPendingItemId
              ? {
                  href: `/review?source=ai&item=${encodeURIComponent(
                    adjacentReferences.next.firstPendingItemId,
                  )}`,
                  label: `ref-${adjacentReferences.next.referenceId.slice(-6)}`,
                }
              : null,
          };

    // IA Phase 19 — scope picker entries (top-bar dropdown). Built
    // for the active scope kind so the picker swaps folder ↔
    // reference seamlessly. Each entry deep-links to first pending.
    const pickerEntries = pickerScopes
      .filter((s) => s.firstPendingItemId !== null)
      .map((s) => ({
        id: s.id,
        label: s.label,
        pendingCount: s.pendingCount,
        href:
          focusScope === "local"
            ? `/review?source=local&item=${encodeURIComponent(s.firstPendingItemId!)}`
            : `/review?source=ai&item=${encodeURIComponent(s.firstPendingItemId!)}`,
      }));

    return (
      <QueueReviewWorkspace
        scope={focusScope}
        itemId={itemId}
        page={pageNum}
        decision={decision}
        totalReviewPending={totalReviewPending}
        nextScope={nextScope}
        // IA Phase 16 — scope identity ZOOM (folder for local).
        focusFolderName={currentFolderName}
        // IA Phase 19 — scope identity ZOOM (reference for design).
        focusReferenceId={currentReferenceId}
        scopeNav={scopeNav}
        scopePicker={{
          kind: focusScope === "local" ? "folder" : "reference",
          activeId:
            focusScope === "local" ? currentFolderName : currentReferenceId,
          entries: pickerEntries,
        }}
      />
    );
  }

  // Queue grid mode (no item / batch focus). The unified ReviewQueueList
  // mounts the canonical toolbar (source segment + decision segment +
  // search) and the card grid; ReviewTabs was retired in IA Phase 13
  // because the source segment is now the canonical source switch.
  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-text">Review</h1>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">
              Decision workspace
            </span>
          </div>
          <p className="text-sm text-text-muted">
            Approve or reject generated and scanned visuals here. To produce
            new variants, use{" "}
            <strong>References &rsaquo; pick a reference &rsaquo; Create Variations</strong>.
            Batch-scoped review opens via{" "}
            <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs">
              ?batch=
            </code>
            .
          </p>
        </div>
      </header>
      <ReviewQueueList scope={focusScope} />
    </div>
  );
}
