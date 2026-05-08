import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import {
  getBatchReviewSummary,
  listBatchReviewItems,
} from "@/server/services/midjourney/review";
import { BatchReviewWorkspace } from "@/features/batches/components/BatchReviewWorkspace";

/**
 * /batches/[batchId]/review — Kivasy A4 dark-mode Batch Review workspace
 * (rollout-3).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a3-a4.jsx
 * → A4BatchReview.
 *
 * Service layer reused: `getBatchReviewSummary`, `listBatchReviewItems` —
 * already user-scoped via Asset.userId. We pass ALL undecided + decided
 * items to the workspace so the keyboard nav can flip between them; the
 * limit is bumped to 200 (MAX_LIMIT in the service).
 *
 * Surface boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Review = keep / reject decision. NO selection set CRUD here. The "S"
 *   shortcut for "Add to Selection" is a deferred handoff (rollout-4).
 */

export const metadata = { title: "Review · Kivasy" };
export const dynamic = "force-dynamic";

export default async function BatchReviewPage({
  params,
}: {
  params: Promise<{ batchId: string }> | { batchId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const resolved = await Promise.resolve(params);
  const batchId = resolved.batchId;

  const [summary, page] = await Promise.all([
    getBatchReviewSummary(batchId, userId),
    listBatchReviewItems(batchId, userId, {
      // Show all decisions — operator navigates between kept/rejected/pending
      // via keyboard. Filter chips at index level if needed.
      decisions: ["UNDECIDED", "KEPT", "REJECTED"],
      limit: 200,
    }),
  ]);

  if (!summary) notFound();

  // Find first undecided as initial cursor — operator immediately starts
  // where work is needed.
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
    />
  );
}
