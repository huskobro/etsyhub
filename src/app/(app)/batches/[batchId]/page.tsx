import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import {
  getBatchSummary,
  findSelectionSetForBatch,
} from "@/server/services/midjourney/batches";
import { BatchDetailClient } from "@/features/batches/components/BatchDetailClient";

/**
 * /batches/[batchId] — Kivasy A3 Batch detail (rollout-3).
 *
 * Batch-first Phase 1: parallel-fetches the existing selection set for this
 * batch so BatchDetailClient can render the correct stage-aware CTA
 * (CLAUDE.md Madde AA).
 */

export const metadata = { title: "Batch · Kivasy" };
export const dynamic = "force-dynamic";

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }> | { batchId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const resolved = await Promise.resolve(params);

  const [summary, existingSelectionSet] = await Promise.all([
    getBatchSummary(resolved.batchId, session.user.id),
    findSelectionSetForBatch(session.user.id, resolved.batchId),
  ]);

  if (!summary) notFound();

  return (
    <BatchDetailClient
      summary={summary}
      existingSelectionSet={existingSelectionSet}
    />
  );
}
