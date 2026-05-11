import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { getBatchSummary, findSelectionSetForBatch } from "@/server/services/midjourney/batches";
import { BatchDetailClient } from "@/features/batches/components/BatchDetailClient";

/**
 * /batches/[batchId] — Kivasy A3 Batch detail (rollout-3).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a3-a4.jsx
 * → A3BatchDetail.
 *
 * Service layer reused: `getBatchSummary(batchId, userId)` — already user-
 * scoped, returns full BatchSummary { batchId, createdAt, templateId,
 * promptTemplate, retryOfBatchId, counts, jobs }.
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
