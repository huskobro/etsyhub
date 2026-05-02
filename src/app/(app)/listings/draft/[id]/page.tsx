/**
 * Phase 9 V1 Task 19 — Listing draft detail page (server entry, foundation slice).
 *
 * Flat path K4 lock: /listings/draft/[id] (no nested segment).
 * Spec §8.1.1 — Server entry routes listing detail request to client shell.
 * No server-side fetch; React Query handles all (client hook).
 *
 * Params: { id: string } — cuid listing identifier
 */

import { ListingDraftView } from "@/features/listings/ui/ListingDraftView";

export default function ListingDraftPage({
  params,
}: {
  params: { id: string };
}) {
  return <ListingDraftView id={params.id} />;
}
