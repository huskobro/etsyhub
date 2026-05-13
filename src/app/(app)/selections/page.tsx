import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { listSelectionsForIndex } from "@/server/services/selection/index-view";
import { SelectionsIndexClient } from "@/features/selections/components/SelectionsIndexClient";
import { getRecipeChainById } from "@/server/services/templates/recipes.service";

/**
 * /selections — Kivasy B2 Selections index (rollout-4).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b2-b3.jsx →
 * B2SelectionsIndex.
 *
 * Service layer reused: `listSets` (Pass 35) + 3-up composite + edited count
 * via `listSelectionsForIndex` thin wrapper.
 *
 * Surface boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Selections = curated sets, mockup-bound. NOT a clone of Library —
 *   Library has set CRUD only via "Add to Selection" handoff. Mockup
 *   üretimi ve listing burada yapılmaz; cross-link Products'a düşer.
 */

export const metadata = { title: "Selections · Kivasy" };
export const dynamic = "force-dynamic";

interface SearchParams {
  recipeId?: string;
  productTypeKey?: string;
}

export default async function SelectionsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // R10 — Recipe runner destination=selections-create geldiyse banner için
  // recipe lookup. Cross-tenant invariant: recipe hâlâ tüm user'lara açık
  // (system-scope), ownership filter yok.
  const recipeId = (searchParams?.recipeId ?? "").trim() || null;
  const productTypeKey =
    (searchParams?.productTypeKey ?? "").trim() || null;
  const recipeBanner = recipeId
    ? await getRecipeChainById(recipeId).catch(() => null)
    : null;

  // archived dahil değil — B2 default canlı set'leri gösterir; archived
  // filter ileride filter chip'in 5. değeri olacak (R5+).
  const [draftSets, readySets] = await Promise.all([
    listSelectionsForIndex({ userId: session.user.id, status: "draft" }),
    listSelectionsForIndex({ userId: session.user.id, status: "ready" }),
  ]);

  const rows = [...draftSets, ...readySets]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      itemCount: s.itemCount,
      editedItemCount: s.editedItemCount,
      thumbsComposite: s.thumbsComposite,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      finalizedAt: s.finalizedAt ? s.finalizedAt.toISOString() : null,
      lastExportedAt: s.lastExportedAt
        ? s.lastExportedAt.toISOString()
        : null,
      // Phase 50 — source batch lineage (resolved server-side)
      sourceBatchId: s.sourceBatchId ?? null,
      sourceReferenceId: s.sourceReferenceId ?? null,
    }));

  return (
    <SelectionsIndexClient
      rows={rows}
      recipeBanner={
        recipeBanner
          ? {
              recipeId: recipeBanner.id,
              recipeName: recipeBanner.name,
              productTypeKey:
                productTypeKey ?? recipeBanner.productTypeKey ?? null,
              productTypeDisplay: recipeBanner.productTypeDisplay,
            }
          : null
      }
    />
  );
}
