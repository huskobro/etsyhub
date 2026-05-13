import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  getBatchSummary,
  findSelectionSetForBatch,
} from "@/server/services/midjourney/batches";
import { getBatchCostBreakdown } from "@/server/services/cost/batch-cost-breakdown";
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
  //
  // Phase 9 fit-and-finish — `assetId` projection eklendi. A3 canonical
  // summary strip "Reference" tile'ında thumbnail render etmek için.
  let sourceReference: {
    id: string;
    label: string | null;
    assetId: string | null;
  } | null = null;
  if (summary.referenceId) {
    const ref = await db.reference.findFirst({
      where: {
        id: summary.referenceId,
        userId: session.user.id,
        deletedAt: null,
      },
      select: { id: true, notes: true, assetId: true },
    });
    if (ref) {
      sourceReference = {
        id: ref.id,
        label: ref.notes,
        assetId: ref.assetId,
      };
    }
  }

  // Batch-first Phase 13 — batch cost breakdown.
  // CostUsage rows yalnız variation/review/edit worker'larında yazılır;
  // MJ bridge browser akışı CostUsage yazmaz. Helper boş array ile de
  // güvenli sonuç döner; UI fallback "no recorded provider usage" gösterir.
  const jobIds = summary.jobs.map((j) => j.jobId);
  const costBreakdown = await getBatchCostBreakdown(jobIds);

  // Phase 49 — Real Batch row context.
  // Phase 43+ launch'lar gerçek `Batch` row taşır; legacy synthetic-
  // batchId akışında bu row yok (UI multi-ref dili graceful fallback'a
  // düşer). Schema değişikliği yok, yalnız okuma.
  let batchContext: {
    itemCount: number;
    composeParams: {
      providerId?: string;
      aspectRatio?: string;
      quality?: string | null;
      count?: number;
      brief?: string | null;
      itemCount?: number;
    } | null;
  } | null = null;
  try {
    const realBatch = await db.batch.findFirst({
      where: {
        id: resolved.batchId,
        userId: session.user.id,
        deletedAt: null,
      },
      select: {
        composeParams: true,
        _count: { select: { items: true } },
      },
    });
    if (realBatch) {
      batchContext = {
        itemCount: realBatch._count.items,
        composeParams:
          (realBatch.composeParams as BatchContextComposeParams) ?? null,
      };
    }
  } catch {
    /* legacy batch — silent fallback; UI uses single-ref language */
  }

  return (
    <BatchDetailClient
      summary={summary}
      existingSelectionSet={existingSelectionSet}
      sourceReference={sourceReference}
      costBreakdown={costBreakdown}
      batchContext={batchContext}
    />
  );
}

type BatchContextComposeParams = {
  providerId?: string;
  aspectRatio?: string;
  quality?: string | null;
  count?: number;
  brief?: string | null;
  itemCount?: number;
};
