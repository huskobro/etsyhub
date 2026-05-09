import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { ProductDetailClient } from "@/features/products/components/ProductDetailClient";

/**
 * /products/[id] — Kivasy A5 Product detail (rollout-5).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a5.jsx →
 * A5ProductDetail.
 *
 * 4 tabs: Mockups · Listing · Files · History.
 *
 * Service layer reused: existing Phase 9 V1 listing draft pipeline
 * (`useListingDraft`, `useUpdateListingDraft`, `useSubmitListingDraft`,
 * `computeReadiness`, image upload diagnostics). New surface; no new
 * model, no new service.
 *
 * Boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Product detail owns mockup orchestration + listing builder + draft
 *   handoff. NO variation generation, NO set CRUD, NO references here.
 *   Etsy submit is a single CTA — full publishing pipeline (active
 *   publish, scheduling) NOT in scope.
 */

export const metadata = { title: "Product · Kivasy" };
export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const resolved = await Promise.resolve(params);
  if (!resolved.id) notFound();

  // Detail data tüm tab'larda React Query üzerinden çekilir; SSR'da yalnız
  // auth guard + parametre validation. Phase 9 emsali ListingDraftView ile
  // birebir patern.
  return <ProductDetailClient productId={resolved.id} />;
}
