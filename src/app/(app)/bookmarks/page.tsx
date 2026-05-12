import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { BookmarksPage } from "@/features/bookmarks/components/bookmarks-page";
import { ReferencesShellTabs } from "@/features/references/components/ReferencesShellTabs";
import { ReferencesTopbar } from "@/features/references/components/ReferencesTopbar";
import { getReferencesSubViewCounts } from "@/features/references/server/sub-view-counts";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [productTypes, counts] = await Promise.all([
    db.productType.findMany({
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
    getReferencesSubViewCounts(session.user.id),
  ]);

  return (
    <div className="-m-6 flex h-screen flex-col">
      <ReferencesTopbar
        subtitle={`INBOX · ${counts.inbox} BOOKMARK${counts.inbox === 1 ? "" : "S"}`}
        actions={
          /* Phase 22 — Pool-canonical action slot pattern.
           * Pre-Phase 22 CTA BookmarksPage içinde ayrı satır olarak
           * render oluyordu → topbar ile content arası ekstra ~70px
           * boş row. Pool sayfası Add Reference'ı topbar action slot'una
           * geçirir; aynı pattern uygulandı. ?add=url query param
           * BookmarksPage client component'inde modal'ı tetikler
           * (stateless Link; page-level state lift gerekmez). */
          <Link
            href="/bookmarks?add=url"
            data-size="sm"
            className="k-btn k-btn--primary"
            data-testid="bookmarks-add-cta"
            title="Add a new bookmark from a URL"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Add from URL
          </Link>
        }
      />
      <ReferencesShellTabs counts={counts} active="inbox" />
      <div className="flex-1 overflow-y-auto p-6">
        <BookmarksPage productTypes={productTypes} />
      </div>
    </div>
  );
}
