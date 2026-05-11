// Phase 7 Task 25 — /selection/sets/[setId] server entry.
//
// Server component:
//   - SSR ownership check (cross-user / yok → notFound() → 404 disiplini).
//     Phase 6 paterni: client TanStack Query da 404 handle ederdi, ama
//     SSR'da erkenden 404 daha temiz UX (404 sayfası, JS bekleme yok).
//   - Sonra StudioShell client component'ine setId geçer; veri client'ta
//     `useSelectionSet` ile fetch edilir.
//
// Next 14.2.35 — params senkron object (`Promise.resolve` gerekli değil).
// Next 15 migrasyonunda params Promise olur — o aşamada burası güncellenir.
//
// Auth: `requireUser` mantığı server.auth `auth()` üzerinden; yetkisiz →
// notFound (login redirect layout seviyesinde — emsalleri için
// `src/app/(app)/layout.tsx`).

import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { StudioShell } from "@/features/selection/components/StudioShell";

export const metadata = { title: "Selection Studio · Kivasy" };

export default async function Page({
  params,
}: {
  params: { setId: string };
}) {
  const session = await auth();
  if (!session?.user) notFound();

  const { setId } = params;

  // SSR ownership check — cross-user / olmayan setId → 404. Sızıntı yok
  // (Phase 6 disiplini: existence ve ownership tek 404'e çöker).
  const set = await db.selectionSet.findFirst({
    where: { id: setId, userId: session.user.id },
    select: { id: true },
  });
  if (!set) notFound();

  return <StudioShell setId={setId} />;
}
