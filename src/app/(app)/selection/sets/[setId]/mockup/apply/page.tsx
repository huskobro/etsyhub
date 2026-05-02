// Phase 8 Task 23 — /selection/sets/[setId]/mockup/apply server entry.
//
// Server component:
//   - SSR ownership check (cross-user / yok → notFound() 404 disiplini).
//   - Sonra <S3ApplyView setId={setId} /> client component'ine devreder; veri
//     client'ta `useSelectionSet` (Phase 7 hook), `useMockupTemplates` (Task 22),
//     `useMockupPackState` (Task 14) ile fetch edilir.
//
// Phase 7 emsali: src/app/(app)/selection/sets/[setId]/page.tsx.

import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { S3ApplyView } from "@/features/mockups/components/S3ApplyView";

export const metadata = { title: "Mockup Studio — EtsyHub" };

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
