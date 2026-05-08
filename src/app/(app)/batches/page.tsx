import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
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
 * Surface boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Batches = generation runs + review workflows. NOT the long-term archive
 *   (that's Library). NOT a place for selection / mockup / listing.
 */

export const metadata = { title: "Batches · Kivasy" };
export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const batches = await listRecentBatches(session.user.id, 50);

  return <BatchesIndexClient batches={batches} />;
}
