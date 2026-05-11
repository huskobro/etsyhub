import { redirect } from "next/navigation";
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
      />
      <ReferencesShellTabs counts={counts} active="inbox" />
      <div className="flex-1 overflow-y-auto p-6">
        <BookmarksPage productTypes={productTypes} />
      </div>
    </div>
  );
}
