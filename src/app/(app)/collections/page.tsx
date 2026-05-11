import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { CollectionsPage } from "@/features/collections/components/collections-page";
import { ReferencesShellTabs } from "@/features/references/components/ReferencesShellTabs";
import { ReferencesTopbar } from "@/features/references/components/ReferencesTopbar";
import { getReferencesSubViewCounts } from "@/features/references/server/sub-view-counts";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const counts = await getReferencesSubViewCounts(session.user.id);

  return (
    <div className="-m-6 flex h-screen flex-col">
      <ReferencesTopbar
        subtitle={`COLLECTIONS · ${counts.collections} GROUP${counts.collections === 1 ? "" : "S"}`}
      />
      <ReferencesShellTabs counts={counts} active="collections" />
      <div className="flex-1 overflow-y-auto p-6">
        <CollectionsPage />
      </div>
    </div>
  );
}
