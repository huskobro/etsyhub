// Phase 9 V1 — /listings index server entry.
//
// SSR auth guard (Phase 7/8 emsali). Client component ListingsIndexView'a
// devreder; veri TanStack Query üzerinden client'ta (useListings).
//
// Phase 8 emsali: src/app/(app)/selection/sets/[setId]/mockup/apply/page.tsx.

import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { ListingsIndexView } from "@/features/listings/components/ListingsIndexView";

export const metadata = { title: "Listingler — EtsyHub" };

export default async function Page() {
  const session = await auth();
  if (!session?.user) notFound();

  return <ListingsIndexView />;
}
