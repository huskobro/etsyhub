import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { CollectionsPage } from "@/features/collections/components/collections-page";
import { ReferencesShellTabs } from "@/features/references/components/ReferencesShellTabs";
import { ReferencesTopbar } from "@/features/references/components/ReferencesTopbar";
import { ReferencesAddReferenceMount } from "@/features/references/components/references-add-reference-mount";
import { getReferencesSubViewCounts } from "@/features/references/server/sub-view-counts";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  /* Phase 33 — Collections sub-view'da Add Reference CTA parity. DS B5
   * niyeti screens-b1.jsx:31-34: Collections sub-view'unda secondary
   * "+ Collection" + primary "Add Reference". Phase 33 yalnız canonical
   * primary'yi ekler — "+ Collection" CTA `CollectionsPage` component'i
   * içinde mevcut (yeni koleksiyon dialog'u zaten orada). */
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
        subtitle={`COLLECTIONS · ${counts.collections} GROUP${counts.collections === 1 ? "" : "S"}`}
        actions={
          <Link
            href="/collections?add=ref"
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
      <ReferencesShellTabs counts={counts} active="collections" />
      <div className="flex-1 overflow-y-auto p-6">
        <CollectionsPage />
      </div>
      <ReferencesAddReferenceMount
        productTypes={productTypes}
        collections={collections}
      />
    </div>
  );
}
