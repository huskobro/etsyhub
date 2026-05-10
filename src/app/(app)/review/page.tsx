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
import { ReviewTabs } from "@/app/(app)/review/_components/ReviewTabs";
import { BatchReviewWorkspace } from "@/features/batches/components/BatchReviewWorkspace";
import { QueueReviewWorkspace } from "@/features/review/components/QueueReviewWorkspace";
import {
  getBatchReviewSummary,
  getMidjourneyAssetBatchId,
  listBatchReviewItems,
} from "@/server/services/midjourney/review";

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

    const [summary, page] = await Promise.all([
      getBatchReviewSummary(batchId, session.user.id),
      listBatchReviewItems(batchId, session.user.id, {
        decisions: ["UNDECIDED", "KEPT", "REJECTED"],
        limit: 200,
      }),
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

    return (
      <BatchReviewWorkspace
        batchId={batchId}
        summary={summary}
        items={page.items}
        initialCursor={initialCursor}
        exitHref="/review"
        exitLabel="Review"
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
    return (
      <QueueReviewWorkspace
        scope={focusScope}
        itemId={itemId}
        page={pageNum}
        decision={decision}
      />
    );
  }

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
      <ReviewTabs activeTab={activeTab} />
    </div>
  );
}
