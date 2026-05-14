// Phase 8 Task 23 — /selection/sets/[setId]/mockup/apply server entry.
// Phase 78 — Rol netleştirildi: Apply route artık "Quick pack render
// orchestrator". Canonical mockup/frame authoring yüzeyi Mockup Studio
// (`/selection/sets/[id]/mockup/studio`) — Phase 77 dark shell. Bu route:
//   - Quick pack default template fan-out + S7/S8 result view path
//     (Phase 8 baseline pipeline; bozulmadan kalır)
//   - Topbar primary "Open in Studio" CTA + Studio handoff banner ile
//     operatöre final ürün canonical entry'i gösterir
//   - Phase 76 SlotAssignmentPanel multi-design assignment hâlâ burada
//
// Server component:
//   - SSR ownership check (cross-user / yok → notFound() 404 disiplini).
//   - Sonra <S3ApplyView setId={setId} /> client component'ine devreder.
//
// Phase 7 emsali: src/app/(app)/selection/sets/[setId]/page.tsx.

import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { S3ApplyView } from "@/features/mockups/components/S3ApplyView";

export const metadata = { title: "Quick pack render · Kivasy" };

export default async function Page({
  params,
}: {
  params: { setId: string };
}) {
  const session = await auth();
  if (!session?.user) notFound();

  const { setId } = params;

  // SSR ownership check — cross-user / olmayan setId → 404.
  const set = await db.selectionSet.findFirst({
    where: { id: setId, userId: session.user.id },
    select: { id: true },
  });
  if (!set) notFound();

  return <S3ApplyView setId={setId} />;
}
