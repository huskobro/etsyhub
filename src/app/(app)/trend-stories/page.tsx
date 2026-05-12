import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { assertTrendStoriesAvailable } from "@/features/trend-stories/services/feature-gate";
import { NotFoundError } from "@/lib/errors";
import { TrendStoriesPage } from "@/features/trend-stories/components/trend-stories-page";
import { ReferencesShellTabs } from "@/features/references/components/ReferencesShellTabs";
import { ReferencesTopbar } from "@/features/references/components/ReferencesTopbar";
import { ReferencesAddReferenceMount } from "@/features/references/components/references-add-reference-mount";
import { getReferencesSubViewCounts } from "@/features/references/server/sub-view-counts";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  try {
    await assertTrendStoriesAvailable();
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  /* Phase 33 — Stories sub-view'da Add Reference CTA parity. DS B5 niyeti
   * (screens-b1.jsx:24-34): Pool/Stories/Inbox/Shops/Collections HEPSİNDE
   * primary CTA `Add Reference`. Phase 26-31'de yalnız Pool + Inbox bağlıydı;
   * Phase 33'te kalan 3 sub-view tamamlanır. productTypes + collections
   * query trio'su Pool sayfasındaki canonical filter ile birebir aynı —
   * shared server helper'a almak küçük bir DRY kazanç olur ama Phase 33
   * scope'unda yeni abstraction yok kuralı gereği konservatif inline tutuluyor. */
  const [productTypes, counts, collections] = await Promise.all([
    db.productType.findMany({
      where: {
        isSystem: true,
        key: { in: ["clipart", "wall_art", "bookmark", "sticker", "printable"] },
      },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, key: true },
    }),
    getReferencesSubViewCounts(session.user.id),
    db.collection.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="-m-6 flex h-screen flex-col">
      <ReferencesTopbar
        subtitle={`STORIES · ${counts.stories} NEW LISTING${counts.stories === 1 ? "" : "S"} THIS WEEK`}
        actions={
          <Link
            href="/trend-stories?add=ref"
            data-size="sm"
            className="k-btn k-btn--primary"
            data-testid="references-add-cta"
            title="Add a new reference (URL, upload, or from Inbox bookmark)"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Add Reference
          </Link>
        }
      />
      <ReferencesShellTabs counts={counts} active="stories" />
      <div className="flex-1 overflow-y-auto p-6">
        <TrendStoriesPage />
      </div>
      <ReferencesAddReferenceMount
        productTypes={productTypes}
        collections={collections}
      />
    </div>
  );
}
