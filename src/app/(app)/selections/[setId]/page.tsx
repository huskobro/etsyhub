import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { getSet } from "@/server/services/selection/sets.service";
import { NotFoundError } from "@/lib/errors";
import { SelectionDetailClient } from "@/features/selections/components/SelectionDetailClient";

/**
 * /selections/[setId] — Kivasy B3 Selection detail (rollout-4).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b2-b3.jsx →
 * B3SelectionDetail.
 *
 * 4 tabs: Designs · Edits · Mockups (read-only) · History.
 *
 * Service layer reused: `getSet(userId, setId)` — already returns items +
 * review join + asset metadata + activeExport. Cross-user / yok → 404.
 *
 * Boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Mockups tab is read-only — full mgmt lives in Products/[id]/Mockups.
 *   Listing CRUD never lives here.
 */

export const metadata = { title: "Selection · Kivasy" };
export const dynamic = "force-dynamic";

export default async function SelectionDetailPage({
  params,
}: {
  params: Promise<{ setId: string }> | { setId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const resolved = await Promise.resolve(params);

  let detail;
  try {
    detail = await getSet({ userId: session.user.id, setId: resolved.setId });
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const editedItemCount = detail.items.filter(
    (i) => i.editedAssetId !== null,
  ).length;

  return (
    <SelectionDetailClient
      set={{
        id: detail.id,
        name: detail.name,
        status: detail.status,
        itemCount: detail.items.length,
        editedItemCount,
        finalizedAt: detail.finalizedAt
          ? detail.finalizedAt.toISOString()
          : null,
        lastExportedAt: detail.lastExportedAt
          ? detail.lastExportedAt.toISOString()
          : null,
        createdAt: detail.createdAt.toISOString(),
        updatedAt: detail.updatedAt.toISOString(),
      }}
      items={detail.items.map((it) => ({
        id: it.id,
        position: it.position,
        sourceAssetId: it.sourceAssetId,
        editedAssetId: it.editedAssetId,
        status: it.status,
        aspectRatio: it.aspectRatio,
        productTypeKey: it.productTypeKey,
      }))}
    />
  );
}
