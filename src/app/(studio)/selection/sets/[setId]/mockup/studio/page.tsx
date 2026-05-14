// Phase 77 — Mockup Studio dark shell entry.
//
// Server component:
//   - SSR ownership check (cross-user / yok → notFound() 404).
//   - <MockupStudioShell setId={...} setName={...} /> client component'ine
//     devreder. Studio shell yalnız UI state taşır; render dispatch +
//     selection items + template binding Phase 78+ candidate.
//
// Coexists with:
//   - /selection/sets/[setId]/mockup/apply (Phase 8 light apply view)
//   - /selection/sets/[setId]/mockup/jobs/[jobId] (Phase 8 S7)
//
// Apply view ve job views Phase 77'de bozulmadan kalır.

import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { MockupStudioShell } from "@/features/mockups/studio/MockupStudioShell";

export const metadata = { title: "Mockup Studio · Kivasy" };

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
    select: { id: true, name: true },
  });
  if (!set) notFound();

  return <MockupStudioShell setId={set.id} setName={set.name} />;
}
