import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { listProductsForIndex } from "@/server/services/products/index-view";
import { ProductsIndexClient } from "@/features/products/components/ProductsIndexClient";

/**
 * /products — Kivasy B4 Products index (rollout-5).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b4.jsx →
 * B4ProductsIndex.
 *
 * Boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Products = mockup'lanmış + listing-paketlenmiş + Etsy-bound dijital
 *   ürün. Schema'daki `Listing` model'i Product konsepti olarak
 *   görselleştirilir; yeni model yok. Variation generation / set CRUD
 *   burada DEĞİL — Selection → Apply Mockups → Product handoff.
 */

export const metadata = { title: "Products · Kivasy" };
export const dynamic = "force-dynamic";

interface SearchParams {
  fromSelection?: string;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const fromSelectionId =
    (searchParams?.fromSelection ?? "").trim() || undefined;

  const rows = await listProductsForIndex({
    userId: session.user.id,
    fromSelectionId,
  });

  return (
    <ProductsIndexClient rows={rows} fromSelectionId={fromSelectionId ?? null} />
  );
}
