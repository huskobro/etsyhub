import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { BookmarksPage } from "@/features/bookmarks/components/bookmarks-page";
import { ReferencesShellTabs } from "@/features/references/components/ReferencesShellTabs";
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
      <header className="flex flex-shrink-0 items-center gap-4 border-b border-line bg-bg px-6 py-4">
        <div className="flex-1">
          <h1 className="k-display text-lg font-semibold tracking-tight text-ink">
            References
          </h1>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-meta text-ink-3">
            INBOX · {counts.inbox} BOOKMARK
          </p>
        </div>
      </header>
      <ReferencesShellTabs counts={counts} active="inbox" />
      <div className="flex-1 overflow-y-auto p-6">
        <BookmarksPage productTypes={productTypes} />
      </div>
    </div>
  );
}
