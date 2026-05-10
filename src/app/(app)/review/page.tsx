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
// IA Phase 2 (this rollout) collapses both onto `/review`:
//   • `/review`                       → tab grid (AI Designs / Local Library)
//   • `/review?batch=<cuid>`          → batch-scoped dark workspace
//                                       (keyboard K/D/U, MJReviewDecision)
//   • `/review?source=ai|local|midjourney` → alias for ?tab=, future canonical
//   • `/review?item=<cuid>`           → drawer detail (alias for ?detail=)
//   • `/batches/[id]/review`          → redirects to `/review?batch=<id>`
//
// The two render paths in this file (workspace vs grid) intentionally
// keep their own data model, write endpoints, and state machines for now.
// The unified-review service-layer (`src/server/services/review/unified.ts`)
// is the seed for collapsing those, but UI consumes legacy paths until the
// adapter is end-to-end production-tested.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { ReviewTabs } from "@/app/(app)/review/_components/ReviewTabs";
import { ReviewDetailPanel } from "@/app/(app)/review/_components/ReviewDetailPanel";
import { BatchReviewWorkspace } from "@/features/batches/components/BatchReviewWorkspace";
import {
  getBatchReviewSummary,
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

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Workspace mode — ?batch=<cuid>. Server-loads MidjourneyAsset items and
  // hands them to the existing dark-mode BatchReviewWorkspace component
  // (re-used as a sub-mode under the canonical `/review` route). Exit and
  // back-link send the operator to plain `/review` so the unified surface
  // never feels like a deep nested route.
  const batchId = (searchParams.batch ?? "").trim();
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

    const firstUndecided = page.items.findIndex(
      (it) => it.decision === "UNDECIDED",
    );
    const initialCursor = firstUndecided >= 0 ? firstUndecided : 0;

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
  // ?source= is the canonical alias going forward; ?tab= remains a fallback
  // so existing links (and the ReviewTabs client component, which still
  // writes ?tab=) keep working. ?item= is the canonical alias for ?detail=.
  const sourceParam = (searchParams.source ?? "").toLowerCase();
  const tabParam = (searchParams.tab ?? "").toLowerCase();
  const activeTab: "ai" | "local" =
    sourceParam === "local" || tabParam === "local" ? "local" : "ai";
  const detailId = searchParams.item ?? searchParams.detail;
  const detailScope = activeTab === "ai" ? "design" : "local";

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
      {detailId ? (
        <ReviewDetailPanel id={detailId} scope={detailScope} />
      ) : null}
    </div>
  );
}
