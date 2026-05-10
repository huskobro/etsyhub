import { redirect } from "next/navigation";

// IA Phase 2 — `/batches/[batchId]/review` collapsed onto canonical
// `/review?batch=<id>`. The dark-mode BatchReviewWorkspace component is
// still rendered, but it is now mounted under `/review` so operators see
// a single review experience. Exit links return to `/review` (passed via
// `exitHref` from the host page).
//
// This page survives only as a 308 redirect for stale CTAs, bookmarks,
// and external links. Once nothing in the codebase or shipped clients
// resolves to `/batches/[id]/review`, the route can be deleted entirely.

export const metadata = { title: "Review · Kivasy" };

export default async function BatchReviewLegacyRedirect({
  params,
}: {
  params: Promise<{ batchId: string }> | { batchId: string };
}): Promise<never> {
  const resolved = await Promise.resolve(params);
  redirect(`/review?batch=${encodeURIComponent(resolved.batchId)}`);
}
