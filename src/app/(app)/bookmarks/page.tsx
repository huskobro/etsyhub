import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { BookmarksPage } from "@/features/bookmarks/components/bookmarks-page";
import { ReferencesShellTabs } from "@/features/references/components/ReferencesShellTabs";
import { ReferencesTopbar } from "@/features/references/components/ReferencesTopbar";
import { ReferencesAddReferenceMount } from "@/features/references/components/references-add-reference-mount";
import { getReferencesSubViewCounts } from "@/features/references/server/sub-view-counts";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [productTypes, counts, collections] = await Promise.all([
    db.productType.findMany({
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
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
        subtitle={`INBOX · ${counts.inbox} BOOKMARK${counts.inbox === 1 ? "" : "S"}`}
        actions={
          /* Phase 26 — DS B5 canonical CTA. Pool ile aynı `Add Reference`
           * adlandırması (sub-view-specific "Add from URL" Phase 22'den
           * geri sarıldı; DS canonical "page header CTA globally
           * consistent across sub-views" — screens-b1.jsx:7-9).
           * `?add=ref` ReferencesAddReferenceMount'u tetikler.
           *
           * Bridge: eski `?add=url` query (Phase 22 ImportUrlDialog) →
           * BookmarksPage hala dinler ama yeni canonical yol `?add=ref`.
           * BookmarksPage'in eski `?add=url` listener'ı bridge olarak
           * kalır (eski deep-link tolerance); başka surface'lerden
           * üretilmediği için yeni traffic almaz. İlerde temizlenecek
           * (CLAUDE.md Phase 26 notu). */
          <Link
            href="/bookmarks?add=ref"
            data-size="sm"
            className="k-btn k-btn--primary"
            data-testid="bookmarks-add-cta"
            title="Add a new reference (URL, upload, or from Inbox bookmark)"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Add Reference
          </Link>
        }
      />
      <ReferencesShellTabs counts={counts} active="inbox" />
      <div className="flex-1 overflow-y-auto p-6">
        <BookmarksPage productTypes={productTypes} />
      </div>

      {/* Phase 26 — canonical intake modal (DS v5 B5). Same component
       * as Pool/Stories/Shops/Collections. */}
      <ReferencesAddReferenceMount
        productTypes={productTypes}
        collections={collections}
      />
    </div>
  );
}
