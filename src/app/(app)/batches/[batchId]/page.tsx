import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
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
 *
 * Batch-first Phase 2: parallel-fetches the source Reference (if any) so the
 * detail header can show a back-link to the originating reference. Reference
 * resolution is user-scoped + deletedAt:null (silent leak protection — soft-
 * deleted reference shouldn't appear as a clickable link).
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

  // Batch-first Phase 2 — resolve source reference (back-link target).
  // summary.referenceId Job.metadata'dan gelir; user ownership ve
  // deletedAt=null kontrolü ile resolve edilir. Hata path'i sessiz:
  // reference silinmiş veya yetkisiz ise back-link render edilmez —
  // batch sayfası kullanıcıya kapanmaz.
  let sourceReference: { id: string; label: string | null } | null = null;
  if (summary.referenceId) {
    const ref = await db.reference.findFirst({
      where: {
        id: summary.referenceId,
        userId: session.user.id,
        deletedAt: null,
      },
      select: { id: true, notes: true },
    });
    if (ref) {
      sourceReference = { id: ref.id, label: ref.notes };
    }
  }

  return (
    <BatchDetailClient
      summary={summary}
      existingSelectionSet={existingSelectionSet}
      sourceReference={sourceReference}
    />
  );
}
