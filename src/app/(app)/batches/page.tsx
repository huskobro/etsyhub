import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { listRecentBatches } from "@/server/services/midjourney/batches";
import { BatchesIndexClient } from "@/features/batches/components/BatchesIndexClient";

/**
 * /batches — Kivasy A2 Batches index (rollout-3).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a1-a2.jsx
 * → A2BatchesIndex.
 *
 * Service layer reused: `listRecentBatches(userId, limit)` — already user-
 * scoped, computes per-batch counts from Job.metadata. No schema migration.
 *
 * Batch-first Phase 2 — opsiyonel `?referenceId=...` filter:
 *   Reference page kartlarından "view batches" linki bu yüzeye düşer.
 *   Server-side `listRecentBatches({ referenceId })` Job.metadata.referenceId
 *   üzerinden Prisma JSON path query ile filter eder. Reference adı /
 *   thumbnail prop'u client'a iletilir; filter chip + clear UX için.
 *
 * Surface boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Batches = generation runs + review workflows. NOT the long-term archive
 *   (that's Library). NOT a place for selection / mockup / listing.
 */

export const metadata = { title: "Batches · Kivasy" };
export const dynamic = "force-dynamic";

type SearchParams = { referenceId?: string };

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const resolved = await Promise.resolve(searchParams);
  const referenceIdFilter =
    typeof resolved.referenceId === "string" && resolved.referenceId.length > 0
      ? resolved.referenceId
      : null;

  // Batch-first Phase 2 — reference name resolution for filter chip.
  // Cross-user ID erişimini engellemek için userId scope'u zorunlu.
  // Bulunmazsa filter chip "Unknown reference" yerine sadece short-ID
  // gösterir; sessiz yutmak yerine operatöre nasıl olduğunu gösterir.
  let referenceFilter: {
    id: string;
    notes: string | null;
    assetId: string | null;
  } | null = null;
  if (referenceIdFilter) {
    const ref = await db.reference.findFirst({
      where: {
        id: referenceIdFilter,
        userId: session.user.id,
        deletedAt: null,
      },
      select: { id: true, notes: true, assetId: true },
    });
    referenceFilter = ref ?? null;
  }

  const batches = await listRecentBatches(
    session.user.id,
    50,
    referenceIdFilter ? { referenceId: referenceIdFilter } : undefined,
  );

  return (
    <BatchesIndexClient
      batches={batches}
      referenceFilter={
        referenceIdFilter
          ? {
              id: referenceIdFilter,
              label: referenceFilter?.notes ?? null,
              found: referenceFilter !== null,
            }
          : null
      }
    />
  );
}
